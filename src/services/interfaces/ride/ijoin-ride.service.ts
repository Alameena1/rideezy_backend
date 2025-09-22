import { IRide } from "../../../models/ride.model";
import { JoinedRideDto } from "../../../dtos/joined-ride.dto";

export interface IJoinRideService {
  joinRide(rideId: string, passengerId: string, pickupLocation: string, dropoffLocation: string): Promise<IRide>;
  getJoinedRides(passengerId: string): Promise<JoinedRideDto[]>;
  findNearestRides(userLocation: string, destination: string, maxDistanceToRouteKm?: number, maxDistanceToEndKm?: number): Promise<IRide[]>;
  createRidePaymentOrder(rideId: string, passengerId: string): Promise<any>;
  verifyAndJoinRide(rideId: string, passengerId: string, pickupLocation: string, dropoffLocation: string, paymentId: string, orderId: string, signature: string): Promise<IRide>;
  cancelJoinedRide(rideId: string, passengerId: string): Promise<void>;
  handleJoinRequest(rideId: string, driverId: string, passengerId: string, action: "accept" | "reject"): Promise<void>;
}