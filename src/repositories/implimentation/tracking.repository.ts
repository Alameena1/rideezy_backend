// tracking.repository.ts
import { injectable } from "inversify";
import { ClientSession, Types } from "mongoose";
import { ITrackingRepository } from "../interface/tracking/itrackingRepository";
import { ITracking } from "../../models/tracking.model";
import { TrackingModel } from "../../models/tracking.model";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class TrackingRepository extends BaseRepository<ITracking> implements ITrackingRepository {
  constructor() {
    super(TrackingModel);
  }

  async startSession(): Promise<ClientSession> {
    return this.model.startSession();
  }

  async createTracking(tracking: Partial<ITracking>, options?: { session: ClientSession }): Promise<ITracking> {
    try {
      const newTracking = await this.create(tracking, options);
      console.log("[TrackingRepository] Created tracking for rideId:", newTracking.rideId);
      return newTracking;
    } catch (error) {
      console.error("[TrackingRepository] Error creating tracking:", (error as Error).message);
      throw new Error(`Failed to create tracking: ${(error as Error).message}`);
    }
  }

  async findOneByRideId(rideId: string | Types.ObjectId, options?: { session: ClientSession }): Promise<ITracking | null> {
  try {
    const queryRideId = typeof rideId === "string" ? new Types.ObjectId(rideId) : rideId;
    console.log("[TrackingRepository] Querying tracking by rideId:", queryRideId);
    const tracking = await this.findOne({ rideId: queryRideId }, options);
    if (!tracking) {
      console.warn("[TrackingRepository] No tracking found for rideId:", queryRideId);
    } else {
      console.log("[TrackingRepository] Found tracking for rideId:", queryRideId);
    }
    return tracking;
  } catch (error) {
    console.error("[TrackingRepository] Error finding tracking for rideId", rideId, ":", (error as Error).message);
    throw new Error(`Failed to find tracking: ${(error as Error).message}`);
  }
}

  async updateTracking(rideId: Types.ObjectId, update: Partial<ITracking>, options?: { session: ClientSession }): Promise<ITracking | null> {
    try {
      console.log("[TrackingRepository] Updating tracking for rideId:", rideId, "with:", update);
      const updatedTracking = await this.updateOne({ rideId }, update, options);
      if (!updatedTracking) {
        console.warn("[TrackingRepository] No tracking updated for rideId:", rideId);
      } else {
        console.log("[TrackingRepository] Updated tracking for rideId:", rideId);
      }
      return updatedTracking;
    } catch (error) {
      console.error("[TrackingRepository] Error updating tracking for rideId", rideId, ":", (error as Error).message);
      throw new Error(`Failed to update tracking: ${(error as Error).message}`);
    }
  }

  async deleteTracking(rideId: Types.ObjectId, options?: { session: ClientSession }): Promise<void> {
    try {
      console.log("[TrackingRepository] Deleting tracking for rideId:", rideId);
      await this.deleteById(rideId.toString(), options);
      console.log("[TrackingRepository] Deleted tracking for rideId:", rideId);
    } catch (error) {
      console.error("[TrackingRepository] Error deleting tracking for rideId", rideId, ":", (error as Error).message);
      throw new Error(`Failed to delete tracking: ${(error as Error).message}`);
    } 
  }    
}