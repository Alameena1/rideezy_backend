// src/repositories/interface/ride/irideRepository.ts
import { IRide } from '../../../models/ride.model';

export interface IRideRepository {
  createRide(ride: Partial<IRide>): Promise<IRide>;
  find(query: any): Promise<IRide[]>;
  findOne(query: any): Promise<IRide | null>;
  updateOne(query: any, update: any): Promise<IRide | null>;
}