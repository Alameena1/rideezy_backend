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
    try {
      const savedRide = await newRide.save();
      console.log(`[RideRepository] Created ride with rideId: ${savedRide.rideId}`);
      return savedRide;
    } catch (error) {
      console.error(`[RideRepository] Error creating ride: ${(error as Error).message}`);
      throw new Error(`Failed to create ride: ${(error as Error).message}`);
    }
  }

  async find(query: any): Promise<IRide[]> {
    try {
      const rides = await super.find(query);
      console.log(`[RideRepository] Found ${rides.length} rides with query:`, query);
      return rides;
    } catch (error) {
      console.error(`[RideRepository] Error finding rides with query ${JSON.stringify(query)}: ${(error as Error).message}`);
      throw new Error(`Failed to find rides: ${(error as Error).message}`);
    }
  }

  async findOne(query: any): Promise<IRide | null> {
    try {
      const ride = await super.findOne(query);
      if (!ride) {
        console.warn(`[RideRepository] No ride found with query: ${JSON.stringify(query)}`);
      } else {
        console.log(`[RideRepository] Found ride with rideId: ${ride.rideId} for query:`, query);
      }
      return ride;
    } catch (error) {
      console.error(`[RideRepository] Error finding ride with query ${JSON.stringify(query)}: ${(error as Error).message}`);
      throw new Error(`Failed to find ride: ${(error as Error).message}`);
    }
  }

  async updateOne(query: any, update: any): Promise<IRide | null> {
    try {
      const updatedRide = await super.updateOne(query, update);
      if (!updatedRide) {
        console.warn(`[RideRepository] No ride updated with query: ${JSON.stringify(query)}`);
      } else {
        console.log(`[RideRepository] Updated ride with rideId: ${updatedRide.rideId} for query:`, query);
      }
      return updatedRide;
    } catch (error) {
      console.error(`[RideRepository] Error updating ride with query ${JSON.stringify(query)}: ${(error as Error).message}`);
      throw new Error(`Failed to update ride: ${(error as Error).message}`);
    }
  }

  async findJoinedRidesByPassengerId(passengerId: string): Promise<IRide[]> {
    try {
      const rides = await RideModel.find({ 'passengers.passengerId': passengerId }).exec();
      console.log(`[RideRepository] Found ${rides.length} joined rides for passengerId: ${passengerId}`);
      return rides;
    } catch (error) {
      console.error(`[RideRepository] Error fetching joined rides for passengerId ${passengerId}: ${(error as Error).message}`);
      throw new Error(`Error fetching joined rides: ${(error as Error).message}`);
    }
  }
}