import { ClientSession, FilterQuery, UpdateQuery, QueryOptions } from "mongoose";
import { IRide, RideCreationData } from "../../../models/ride.model";

export interface IInitiateRideRepository {
  count(query: FilterQuery<IRide>): Promise<number>;
  createRide(ride: RideCreationData, options?: { session: ClientSession }): Promise<IRide>;
  find(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide[]>;
  findOne(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide | null>;
  updateOne(query: FilterQuery<IRide>, update: UpdateQuery<IRide>, options?: QueryOptions & { session?: ClientSession }): Promise<IRide | null>;
  startSession(): Promise<ClientSession>;
}