// src/services/interfaces/tracking/itrackingService.ts
import { ITracking } from "../../../models/tracking.model";

export interface ITrackingService {
  startTracking(rideId: string, driverId: string, initialPosition: [number, number]): Promise<ITracking>;
  updateTrackingPosition(rideId: string, position: [number, number]): Promise<void>;
  getTrackingPosition(rideId: string): Promise<[number, number] | null>;
  stopTracking(rideId: string): Promise<void>;
  getTrackingStatus(rideId: string): Promise<ITracking | null>;
}