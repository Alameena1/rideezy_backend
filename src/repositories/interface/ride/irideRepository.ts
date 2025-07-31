import { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
import { IRide, RideCreationData } from "../../../models/ride.model";

interface MongoUpdateOptions {
  session?: ClientSession;
  arrayFilters?: { [key: string]: any }[];
  new?: boolean;
  runValidators?: boolean;
  [key: string]: any;
}

export interface IRideRepository {
  createRide(ride: RideCreationData, options?: { session: ClientSession }): Promise<IRide>;
  find(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide[]>;
  findOne(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide | null>;
  updateOne(
    query: FilterQuery<IRide>,
    update: UpdateQuery<IRide>,
    options?: MongoUpdateOptions
  ): Promise<IRide | null>;
  findJoinedRidesByPassengerId(passengerId: string, options?: { session: ClientSession }): Promise<IRide[]>;
  startSession(): Promise<ClientSession>;
}