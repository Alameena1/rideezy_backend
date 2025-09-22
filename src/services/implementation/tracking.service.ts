import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ITrackingService } from "../interfaces/tracking/itrackingService";
import { ITrackingRepository } from "../../repositories/interface/tracking/itrackingRepository";
import { IInitiateRideRepository } from "../../repositories/interface/ride/iinitiate-ride-repository";
import { OSRMClient } from "../../infrastructure/map-api/osrm.client";
import retry from "async-retry";
import mongoose, { ClientSession, Types } from "mongoose";
import { ITracking } from "../../models/tracking.model";

interface MongoError extends Error {
  code?: number;
}

@injectable()
export class TrackingService implements ITrackingService {
  constructor(
    @inject(TYPES.ITrackingRepository) private trackingRepo: ITrackingRepository,
    @inject(TYPES.IInitiateRideRepository) private rideRepo: IInitiateRideRepository,
    @inject(TYPES.IOSRMClient) private osrmClient: OSRMClient
  ) {
    console.log(
      "[TrackingService] Initialized with trackingRepo, rideRepo, and osrmClient"
    );
  }

  async updateTrackingPosition(
    rideId: string,
    position: [number, number]
  ): Promise<void> {
    if (
      !position ||
      position.length !== 2 ||
      isNaN(position[0]) ||
      isNaN(position[1])
    ) {
      throw new Error("Invalid position coordinates");
    }

    await retry(
      async (bail, attempt) => {
        console.log(
          `[TrackingService] Attempt ${attempt} to update tracking position for ride ${rideId}`
        );
        const startTime = Date.now();
        const session: ClientSession = await this.trackingRepo.startSession();
        try {
          await session.withTransaction(async () => {
            const ride = await this.rideRepo.findOne(
              { _id: new Types.ObjectId(rideId) },
              { session }
            );
            if (!ride) throw new Error("Ride not found");
            const tracking = await this.trackingRepo.findOneByRideId(ride._id, {
              session,
            });
            if (!tracking) throw new Error("Tracking record not found");

            await this.trackingRepo.updateTracking(
              ride._id,
              { currentPosition: position },
              { session }
            );
            console.log(
              `[TrackingService] Updated tracking position for ride ${rideId} to ${position} in ${
                Date.now() - startTime
              }ms`
            );
          });
        } catch (error: unknown) {
          const err = error as MongoError;
          console.error(`[TrackingService] Attempt ${attempt} failed:`, {
            rideId,
            error: err.message,
            code: err.code,
          });
          if (err.code === 112) {
            throw err; // Retry on write conflict
          } else {
            bail(err); // Stop retrying on other errors
          }
        } finally {
          try {
            await session.endSession();
          } catch (endSessionError) {
            console.error(
              "[TrackingService] Failed to end session:",
              endSessionError
            );
          }
        }
      },
      {
        retries: 5,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
      }
    );
  }
  
  async getTrackingStatus(rideId: string): Promise<ITracking> {
    try {
      console.log(
        "[TrackingService] Fetching tracking status for rideId (MongoDB _id):",
        rideId
      );
      const ride = await this.rideRepo.findOne({
        _id: new Types.ObjectId(rideId),
      });
      if (!ride) {
        console.error("[TrackingService] Ride not found for _id:", rideId);
        throw new Error("Ride not found");
      }
      console.log("[TrackingService] Resolved ride _id:", ride._id.toString());
      const tracking = await this.trackingRepo.findOneByRideId(ride._id);
      if (!tracking) {
        console.log(
          "[TrackingService] No tracking found for rideId:",
          rideId,
          "mongoId:",
          ride._id.toString()
        );
        throw new Error("No tracking found for this ride");
      }
      console.log("[TrackingService] Tracking found:", tracking);
      return tracking;
    } catch (error) {
      console.error("[TrackingService] Error fetching tracking status:", {
        rideId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  async startTracking(
    rideId: string,
    driverId: string,
    initialPosition: [number, number]
  ): Promise<ITracking> {
    const session: ClientSession = await this.trackingRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        console.log("[TrackingService] Starting tracking for rideId:", rideId);
        const ride = await this.rideRepo.findOne(
          { _id: new Types.ObjectId(rideId) },
          { session }
        );
        if (!ride) throw new Error("Ride not found");

        const existingTracking = await this.trackingRepo.findOneByRideId(
          ride._id,
          { session }
        );
        if (existingTracking && existingTracking.status === "Started") {
          throw new Error("Tracking already active for this ride");
        }
        if (existingTracking) {
          await this.trackingRepo.deleteTracking(existingTracking.rideId, {
            session,
          });
        }

        // Initialize pickup and dropoff actions
        const pickupActions = ride.pickupPoints.map((point: { passengerId: string; location: string }) => ({
          passengerId: point.passengerId,
          location: point.location,
          status: "Pending" as "Pending" | "Completed",
        }));
        const dropoffActions = ride.dropoffPoints.map((point: { passengerId: string; location: string }) => ({
          passengerId: point.passengerId,
          location: point.location,
          status: "Pending" as "Pending" | "Completed",
        }));

        const newTracking = await this.trackingRepo.createTracking(
          {
            rideId: ride._id,
            currentPosition: initialPosition,
            status: "Started",
            driverId: new Types.ObjectId(driverId),
            pickupActions,
            dropoffActions,
          },
          { session }
        );
        return newTracking;
      });
      return result;
    } catch (error) {
      console.error("[TrackingService] Error starting tracking:", error);
      throw error;
    } finally {
      try {
        await session.endSession();
      } catch (endSessionError) {
        console.error(
          "[TrackingService] Failed to end session:",
          endSessionError
        );
      }
    }
  }

  async updateTrackingAction(
    rideId: string,
    passengerId: string,
    action: "picked" | "dropped"
  ): Promise<void> {
    const session: ClientSession = await this.trackingRepo.startSession();
    try {
      await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne(
          { _id: new Types.ObjectId(rideId) },
          { session }
        );
        if (!ride) throw new Error("Ride not found");
        const tracking = await this.trackingRepo.findOneByRideId(ride._id, {
          session,
        });
        if (!tracking) throw new Error("Tracking record not found");

        const updateField =
          action === "picked" ? "pickupActions" : "dropoffActions";
        const actions = tracking[updateField].map((a) =>
          a.passengerId === passengerId ? { ...a, status: "Completed" } : a
        );

        const status = actions.every((a) => a.status === "Completed")
          ? "Started"
          : "Paused";
        await this.trackingRepo.updateTracking(
          ride._id,
          { [updateField]: actions, status },
          { session }
        );
        console.log(
          `[TrackingService] Updated ${action} action for passenger ${passengerId} on ride ${rideId}`
        );
      });
    } catch (error) {
      console.error("[TrackingService] Error updating tracking action:", error);
      throw error;
    } finally {
      try {
        await session.endSession();
      } catch (endSessionError) {
        console.error(
          "[TrackingService] Failed to end session:",
          endSessionError
        );
      }
    }
  }

  async getTrackingPosition(rideId: string): Promise<[number, number] | null> {
    try {
      console.log(
        "[TrackingService] Fetching tracking position for rideId (MongoDB _id):",
        rideId
      );
      const ride = await this.rideRepo.findOne({
        _id: new Types.ObjectId(rideId),
      });
      if (!ride) {
        console.error("[TrackingService] Ride not found for _id:", rideId);
        throw new Error("Ride not found");
      }
      const tracking = await this.trackingRepo.findOneByRideId(ride._id);
      return tracking ? tracking.currentPosition : null;
    } catch (error) {
      console.error(
        `[TrackingService] Error fetching tracking position for ride ${rideId}:`,
        {
          rideId,
          error: (error as Error).message,
          stack: (error as Error).stack,
        }
      );
      throw error;
    }
  }

  // In TrackingService - stopTracking method
async stopTracking(rideId: string): Promise<void> {
  const session: ClientSession = await this.trackingRepo.startSession();
  try {
    await session.withTransaction(async () => {
      const ride = await this.rideRepo.findOne(
        { _id: new Types.ObjectId(rideId) },
        { session }
      );
      if (!ride) {
        console.log('[TrackingService] Ride not found, might already be completed');
        return; // Just return instead of throwing error
      }
      
      const tracking = await this.trackingRepo.findOneByRideId(ride._id, {
        session,
      });
      
      if (!tracking) {
        console.log('[TrackingService] Tracking record not found, might already be completed');
        return; // Just return instead of throwing error
      }
      
      await this.trackingRepo.updateTracking(
        ride._id,
        { status: "Completed" },
        { session }
      );
      console.log(`[TrackingService] Stopped tracking for ride ${rideId}`);
    });
  } catch (error) {
    console.error(
      `[TrackingService] Error stopping tracking for ride ${rideId}:`,
      error
    );
    throw error;
  } finally {
    try {
      await session.endSession();
    } catch (endSessionError) {
      console.error(
        "[TrackingService] Failed to end session:",
        endSessionError
      );
    }
  }
}
}