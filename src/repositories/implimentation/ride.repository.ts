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

  // Explicitly implement find to match IRideRepository
  async find(query: any): Promise<IRide[]> {
    return super.find(query);
  }

  // Explicitly implement findOne to match IRideRepository
  async findOne(query: any): Promise<IRide | null> {
    return super.findOne(query);
  }

  // updateOne is inherited from BaseRepository, no need to reimplement
}