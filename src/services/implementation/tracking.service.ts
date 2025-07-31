
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ITrackingService } from "../interfaces/tracking/itrackingService";
import { ITrackingRepository } from "../../repositories/interface/tracking/itrackingRepository";
import { ITracking } from "../../models/tracking.model";
import { Types } from "mongoose";
import { IRideRepository } from "../../repositories/interface/ride/irideRepository";

@injectable()
export class TrackingService implements ITrackingService {
  constructor(
    @inject(TYPES.ITrackingRepository) private trackingRepo: ITrackingRepository,
    @inject(TYPES.IRideRepository) private rideRepo: IRideRepository
  ) {
    console.log("[TrackingService] Initialized with trackingRepo and rideRepo");
  }

  async getTrackingStatus(rideId: string): Promise<ITracking> {
    try {
      console.log("[TrackingService] Fetching tracking status for rideId (MongoDB _id):", rideId);
      const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) });
      if (!ride) {
        console.error("[TrackingService] Ride not found for _id:", rideId);
        throw new Error("Ride not found");
      }
      console.log("[TrackingService] Resolved ride _id:", ride._id.toString());
      const tracking = await this.trackingRepo.findOneByRideId(ride._id);
      if (!tracking) {
        console.log("[TrackingService] No tracking found for rideId:", rideId, "mongoId:", ride._id.toString());
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

  async startTracking(rideId: string, driverId: string, initialPosition: [number, number]): Promise<ITracking> {
    const session = await this.trackingRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        console.log("[TrackingService] Starting tracking for rideId (MongoDB _id):", rideId, "driverId:", driverId, "initialPosition:", initialPosition);
        const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        if (!ride) {
          console.error("[TrackingService] Ride not found for _id:", rideId);
          throw new Error("Ride not found");
        }
        console.log("[TrackingService] Resolved ride _id:", ride._id.toString());
        const existingTracking = await this.trackingRepo.findOneByRideId(ride._id, { session });
        if (existingTracking && existingTracking.status === "Started") {
          console.error("[TrackingService] Tracking already active for rideId:", rideId);
          throw new Error("Tracking already active for this ride");
        }
        if (existingTracking) {
          console.log("[TrackingService] Deleting existing tracking record for rideId:", rideId);
          await this.trackingRepo.deleteTracking(existingTracking.rideId, { session });
        }
        const newTracking = await this.trackingRepo.createTracking(
          {
            rideId: ride._id,
            currentPosition: initialPosition,
            status: "Started",
            driverId: new Types.ObjectId(driverId),
          },
          { session }
        );
        console.log("[TrackingService] Created new tracking:", newTracking);
        return newTracking;
      });
      return result;
    } catch (error) {
      console.error("[TrackingService] Error starting tracking:", {
        rideId,
        driverId,
        initialPosition,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateTrackingPosition(rideId: string, position: [number, number]): Promise<void> {
    const session = await this.trackingRepo.startSession();
    try {
      await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        if (!ride) {
          throw new Error("Ride not found");
        }
        const tracking = await this.trackingRepo.findOneByRideId(ride._id, { session });
        if (!tracking) {
          throw new Error("Tracking record not found");
        }
        await this.trackingRepo.updateTracking(ride._id, { currentPosition: position }, { session });
        console.log(`[TrackingService] Updated tracking position for ride ${rideId} to ${position}`);
      });
    } catch (error) {
      console.error(`[TrackingService] Error updating tracking position for ride ${rideId}:`, {
        rideId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getTrackingPosition(rideId: string): Promise<[number, number] | null> {
    try {
      console.log("[TrackingService] Fetching tracking position for rideId (MongoDB _id):", rideId);
      const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) });
      if (!ride) {
        console.error("[TrackingService] Ride not found for _id:", rideId);
        throw new Error("Ride not found");
      }
      const tracking = await this.trackingRepo.findOneByRideId(ride._id);
      return tracking ? tracking.currentPosition : null;
    } catch (error) {
      console.error(`[TrackingService] Error fetching tracking position for ride ${rideId}:`, {
        rideId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  async stopTracking(rideId: string): Promise<void> {
  const session = await this.trackingRepo.startSession();
  try {
    console.log("[TrackingService] Received rideId:", rideId);
    await session.withTransaction(async () => {
      const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
      if (!ride) {
        throw new Error("Ride not found for ID: " + rideId);
      }
      console.log("[TrackingService] Found ride:", ride._id);
      const tracking = await this.trackingRepo.findOneByRideId(ride._id, { session });
      if (!tracking) {
        throw new Error("Tracking record not found for ride: " + ride._id);
      }
      await this.trackingRepo.updateTracking(ride._id, { status: "Completed" }, { session });
      console.log(`[TrackingService] Stopped tracking for ride ${rideId}`);
    });
  } catch (error) {
    console.error(`[TrackingService] Error stopping tracking for ride ${rideId}:`, {
      rideId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  } finally {
    session.endSession();
  }
}

}
