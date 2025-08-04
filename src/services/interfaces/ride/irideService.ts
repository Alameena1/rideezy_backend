import { IRide } from "../../../models/ride.model";
import { CreateRideDto } from "../../../dtos/create-ride.dto";
import { JoinedRideDto } from "../../../dtos/joined-ride.dto";
import { EditRideDto } from "../../../dtos/edit-ride.dto";

export interface IRideService {
  findByRideId(rideId: string): Promise<any>;
  findById(rideId: string): Promise<IRide | null>;
  startRide(dto: CreateRideDto): Promise<IRide>;
  joinRide(
    rideId: string,
    passengerId: string,
    pickupLocation: string,
    dropoffLocation: string
  ): Promise<IRide>;
  getRides(userId: string): Promise<IRide[]>;
  getJoinedRides(passengerId: string): Promise<JoinedRideDto[]>;
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
  editRide(rideId: string, driverId: string, dto: EditRideDto): Promise<IRide>;
  cancelRide(rideId: string, driverId: string): Promise<void>;
  cancelJoinedRide(rideId: string, passengerId: string): Promise<void>;
  startTracking(rideId: string, driverId: string): Promise<IRide>;
  updateRide(
    rideId: string,
    updates: {
      passengerId?: string;
      action?: "picked" | "dropped";
      status?: string;
      currentPosition?: [number, number];
    },
    driverId: string
  ): Promise<IRide>;
}