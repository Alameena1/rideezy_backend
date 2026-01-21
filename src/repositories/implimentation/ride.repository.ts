// // src/repositories/implimentation/ride.repository.ts
// import { injectable } from "inversify";
// import { ClientSession, FilterQuery, UpdateQuery } from "mongoose";
// import { IRideRepository } from "../interface/ride/irideRepository";
// import { IRide, RideCreationData } from "../../models/ride.model";
// import { RideModel } from "../../models/ride.model";
// import { BaseRepository } from "../base/base.repository";

// interface MongoUpdateOptions {
//   session?: ClientSession;
//   arrayFilters?: { [key: string]: any }[];
//   new?: boolean;
//   runValidators?: boolean;
//   [key: string]: any;
// }

// @injectable()
// export class RideRepository extends BaseRepository<IRide> implements IRideRepository {
//   constructor() {
//     super(RideModel);
//   }

//   async startSession(): Promise<ClientSession> {
//     return RideModel.startSession();
//   }

//   async count(query: FilterQuery<IRide>): Promise<number> {
//     try {
//       const count = await RideModel.countDocuments(query).exec();
//       console.log(`[RideRepository] Counted ${count} rides with query:`, query);
//       return count;
//     } catch (error) {
//       console.error(`[RideRepository] Error counting rides with query ${JSON.stringify(query)}: ${(error as Error).message}`);
//       throw new Error(`Failed to count rides: ${(error as Error).message}`);
//     }
//   }

//   async createRide(ride: RideCreationData, options?: { session: ClientSession }): Promise<IRide> {
//     try {
//       const newRide = await this.create(ride, options);
//       console.log(`[RideRepository] Created ride with rideId: ${newRide.rideId}`);
//       return newRide;
//     } catch (error) {
//       console.error(`[RideRepository] Error creating ride: ${(error as Error).message}`);
//       throw new Error(`Failed to create ride: ${(error as Error).message}`);
//     }
//   }

//   async find(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide[]> {
//     try {
//       const rides = await super.find(query, options);
//       console.log(`[RideRepository] Found ${rides.length} rides with query:`, query);
//       return rides;
//     } catch (error) {
//       console.error(`[RideRepository] Error finding rides with query ${JSON.stringify(query)}: ${(error as Error).message}`);
//       throw new Error(`Failed to find rides: ${(error as Error).message}`);
//     }
//   }

//   async findOne(query: FilterQuery<IRide>, options?: { session: ClientSession }): Promise<IRide | null> {
//     try {
//       const ride = await super.findOne(query, options);
//       if (!ride) {
//         console.warn(`[RideRepository] No ride found with query: ${JSON.stringify(query)}`);
//       } else {
//         console.log(`[RideRepository] Found ride with rideId: ${ride.rideId} for query:`, query);
//       }
//       return ride;
//     } catch (error) {
//       console.error(`[RideRepository] Error finding ride with query ${JSON.stringify(query)}: ${(error as Error).message}`);
//       throw new Error(`Failed to find ride: ${(error as Error).message}`);
//     }
//   }

//   async updateOne(query: FilterQuery<IRide>, update: UpdateQuery<IRide>, options?: MongoUpdateOptions): Promise<IRide | null> {
//     try {
//       const updatedRide = await super.updateOne(query, update, options);
//       if (!updatedRide) {
//         console.warn(`[RideRepository] No ride updated with query: ${JSON.stringify(query)}`);
//       } else {
//         console.log(`[RideRepository] Updated ride with rideId: ${updatedRide.rideId} for query:`, query);
//       }
//       return updatedRide;
//     } catch (error) {
//       console.error(`[RideRepository] Error updating ride with query ${JSON.stringify(query)}: ${(error as Error).message}`);
//       throw new Error(`Failed to update ride: ${(error as Error).message}`);
//     }
//   }

//   async findJoinedRidesByPassengerId(passengerId: string, options?: { session: ClientSession }): Promise<IRide[]> {
//     try {
//       const rides = await this.find({ "passengers.passengerId": passengerId }, options);
//       console.log(`[RideRepository] Found ${rides.length} joined rides for passengerId: ${passengerId}`);
//       return rides;
//     } catch (error) {
//       console.error(`[RideRepository] Error fetching joined rides for passengerId ${passengerId}: ${(error as Error).message}`);
//       throw new Error(`Error fetching joined rides: ${(error as Error).message}`);
//     }
//   }
// }