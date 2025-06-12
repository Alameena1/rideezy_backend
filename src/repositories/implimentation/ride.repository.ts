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
    return super.find(query);
  }

  async findOne(query: any): Promise<IRide | null> {
    return super.findOne(query);
  }

  async updateOne(query: any, update: any): Promise<IRide | null> {
    return super.updateOne(query, update);
  }

  async findJoinedRidesByPassengerId(passengerId: string): Promise<IRide[]> {
    try {
      return await RideModel.find({ 'passengers.passengerId': passengerId }).exec();
    } catch (error) {
      throw new Error(`Error fetching joined rides: ${(error as Error).message}`);
    }
  }
}