import { injectable } from "inversify";
import { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
import { IJoinRideRepository } from "../interface/ride/ijoin-ride-repository";
import { IRide } from "../../models/ride.model";
import { RideModel } from "../../models/ride.model";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class JoinRideRepository extends BaseRepository<IRide> implements IJoinRideRepository {
  constructor() {
    super(RideModel);
  }

  async startSession(): Promise<ClientSession> {
    return RideModel.startSession();
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

  async findJoinedRidesByPassengerId(passengerId: string, options?: { session: ClientSession }): Promise<IRide[]> {
    try {
      const rides = await this.find({ "passengers.passengerId": passengerId }, options);
      return rides;
    } catch (error) {
      throw new Error(`Error fetching joined rides: ${(error as Error).message}`);
    }
  }
   async count(filter: FilterQuery<any>): Promise<number> {
    try {
      return await RideModel.countDocuments(filter);
    } catch (error) {
      console.error("Error counting documents:", error);
      throw error;
    }
  }
}