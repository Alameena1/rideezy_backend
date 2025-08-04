import { ITracking } from "../../../models/tracking.model";

export interface ITrackingService {
  startTracking(rideId: string, driverId: string, initialPosition: [number, number]): Promise<ITracking>;
  getTrackingStatus(rideId: string): Promise<ITracking>;
  getTrackingPosition(rideId: string): Promise<[number, number] | null>;
  updateTrackingPosition(rideId: string, position: [number, number]): Promise<void>;
  stopTracking(rideId: string): Promise<void>;
  updateTrackingAction(rideId: string, passengerId: string, action: "picked" | "dropped"): Promise<void>;
}