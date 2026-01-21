import { injectable } from "inversify";
import { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
import { IInitiateRideRepository } from "../interface/ride/iinitiate-ride-repository";
import { IRide, RideCreationData } from "../../models/ride.model";
import { RideModel } from "../../models/ride.model";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class InitiateRideRepository extends BaseRepository<IRide> implements IInitiateRideRepository {
  constructor() {
    super(RideModel);
  }
  

  async startSession(): Promise<ClientSession> {
    return RideModel.startSession();
  }

  async count(query: FilterQuery<IRide>): Promise<number> {
    try {
      const count = await RideModel.countDocuments(query).exec();
      return count;
    } catch (error) {
      throw new Error(`Failed to count rides: ${(error as Error).message}`);
    }
  }

  async createRide(ride: RideCreationData, options?: { session: ClientSession }): Promise<IRide> {
    try {
      const newRide = await this.create(ride, options);
      return newRide;
    } catch (error) {
      throw new Error(`Failed to create ride: ${(error as Error).message}`);
    }
  }

  async find(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide[]> {
    try {
      const rides = await super.find(query, options);
      return rides;
    } catch (error) {
      throw new Error(`Failed to find rides: ${(error as Error).message}`);
    }
  }

  async findOne(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide | null> {
    try {
      const ride = await super.findOne(query, options);
      return ride;
    } catch (error) {
      throw new Error(`Failed to find ride: ${(error as Error).message}`);
    }
  }

  async updateOne(query: FilterQuery<IRide>, update: UpdateQuery<IRide>, options?: { session: ClientSession }): Promise<IRide | null> {
    try {
      const updatedRide = await super.updateOne(query, update, options);
      return updatedRide;
    } catch (error) {
      throw new Error(`Failed to update ride: ${(error as Error).message}`);
    }
  }
}