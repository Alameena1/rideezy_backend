import { IRide } from '../../../models/ride.model';

export interface IRideRepository {
  createRide(ride: Partial<IRide>): Promise<IRide>;
  find(query: any): Promise<IRide[]>; 
}