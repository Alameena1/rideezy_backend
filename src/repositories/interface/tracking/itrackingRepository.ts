import { ClientSession, Types } from "mongoose";
import { ITracking } from "../../../models/tracking.model";

export interface ITrackingRepository {
  startSession(): Promise<ClientSession>;
  createTracking(tracking: Partial<ITracking>, options?: { session: ClientSession }): Promise<ITracking>;
  findOneByRideId(rideId: string | Types.ObjectId, options?: { session: ClientSession }): Promise<ITracking | null>;
  updateTracking(rideId: string | Types.ObjectId, update: Partial<ITracking>, options?: { session: ClientSession }): Promise<ITracking | null>;
  deleteTracking(rideId: string | Types.ObjectId, options?: { session: ClientSession }): Promise<void>;
}