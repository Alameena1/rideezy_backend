
import { IRide } from '../../../models/ride.model';
import { CreateRideDto } from '../../../dtos/create-ride.dto';

export interface IRideService {
  startRide(dto: CreateRideDto): Promise<IRide>;
  getRides(userId: string): Promise<IRide[]>; 
  joinRide(rideId: string, passengerId: string, pickupLocation: string): Promise<IRide>; 
}