import { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
import { IRide } from "../../../models/ride.model";

export interface IJoinRideRepository {
  count(arg0: { "passengers.passengerId": string; status: { $in: string[]; }; createdAt: { $gte: Date; $lt: Date; }; }): unknown;
  find(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide[]>;
  findOne(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide | null>;
  updateOne(query: FilterQuery<IRide>, update: UpdateQuery<IRide>, options?: { session: ClientSession }): Promise<IRide | null>;
  findJoinedRidesByPassengerId(passengerId: string, options?: { session: ClientSession }): Promise<IRide[]>;
  startSession(): Promise<ClientSession>;
}