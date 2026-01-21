import { IRide } from "../../../models/ride.model";
import { CreateRideDto } from "../../../dtos/create-ride.dto";
import { EditRideDto } from "../../../dtos/edit-ride.dto";

export interface IInitiateRideService {
  startRide(dto: CreateRideDto): Promise<IRide>;
  editRide(rideId: string, driverId: string, dto: EditRideDto): Promise<IRide>;
  cancelRide(rideId: string, driverId: string): Promise<void>;
  getRides(driverId: string): Promise<IRide[]>;
  findById(rideId: string): Promise<IRide | null>;
  startTracking(rideId: string, driverId: string): Promise<IRide>;
  updateRide(rideId: string, driverId: string, updates: any): Promise<IRide>;
  // New method for emergency stop
  emergencyStopRide(rideId: string, driverId: string, reason: string, currentPosition: [number, number]): Promise<IRide>;
  // Updated method to process refunds - now returns number
  processEmergencyRefunds(rideId: string): Promise<number>; // CHANGE FROM Promise<void> TO Promise<number>
}