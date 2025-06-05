import { IRide } from '../../../models/ride.model';
import { CreateRideDto } from '../../../dtos/create-ride.dto';

export interface IRideService {
  startRide(dto: CreateRideDto): Promise<IRide>;
  joinRide(rideId: string, passengerId: string, pickupLocation: string, dropoffLocation: string): Promise<IRide>;
  getRides(userId: string): Promise<IRide[]>;
  findNearestRides(
    userLocation: string,
    destination: string,
    maxDistanceToRouteKm?: number,
    maxDistanceToEndKm?: number
  ): Promise<IRide[]>;
  createRidePaymentOrder(rideId: string): Promise<any>;
  verifyAndJoinRide(
    rideId: string,
    passengerId: string,
    pickupLocation: string,
    dropoffLocation: string,
    paymentId: string,
    orderId: string,
    signature: string
  ): Promise<IRide>;
}