import { injectable } from 'inversify';
import { IRideRepository } from '../interface/ride/irideRepository';
import { IRide } from '../../models/ride.model';
import { RideModel } from '../../models/ride.model';
import { BaseRepository } from '../base/base.repository';

@injectable()
export class RideRepository extends BaseRepository<IRide> implements IRideRepository {
  constructor() {
    super(RideModel);
  }

  async createRide(ride: Partial<IRide>): Promise<IRide> {
    const newRide = new RideModel(ride); 
    return newRide.save(); 
  }

  async find(query: any): Promise<IRide[]> {
    return this.model.find(query).lean().exec();
  }
}