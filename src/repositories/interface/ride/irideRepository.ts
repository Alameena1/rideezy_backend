import { ClientSession } from "mongoose";
import { IRide, RideCreationData } from "../../../models/ride.model";

export interface IRideRepository {
  createRide(ride: RideCreationData, options?: { session: ClientSession }): Promise<IRide>;
  find(query: any, options?: { session: ClientSession }): Promise<IRide[]>;
  findOne(query: any, options?: { session: ClientSession }): Promise<IRide | null>;
  updateOne(query: any, update: any, options?: { session: ClientSession }): Promise<IRide | null>;
  findJoinedRidesByPassengerId(passengerId: string, options?: { session: ClientSession }): Promise<IRide[]>;
  startSession(): Promise<ClientSession>;
}