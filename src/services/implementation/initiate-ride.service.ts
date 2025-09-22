import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IInitiateRideService } from "../interfaces/ride/iinitiate-ride.service";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IInitiateRideRepository } from "../../repositories/interface/ride/iinitiate-ride-repository";
import { IOSRMClient } from "../../infrastructure/map-api/osrm.client";
import { CreateRideDto } from "../../dtos/create-ride.dto";
import { IRide, RideCreationData } from "../../models/ride.model";
import { EditRideDto } from "../../dtos/edit-ride.dto";
import { INotificationService } from "../interfaces/notification/iNotificationService";
import { ITrackingService } from "../interfaces/tracking/itrackingService";
import { Types } from "mongoose";

@injectable()
export class InitiateRideService implements IInitiateRideService {
  constructor(
    @inject(TYPES.IUserRepository) private userRepo: IUserRepository,
    @inject(TYPES.IVehicleRepository) private vehicleRepo: IVehicleRepository,
    @inject(TYPES.IInitiateRideRepository) private rideRepo: IInitiateRideRepository,
    @inject(TYPES.ISubscriptionService) private subscriptionService: ISubscriptionService,
    @inject(TYPES.IOSRMClient) private osrmClient: IOSRMClient,
    @inject(TYPES.INotificationService) private notificationService: INotificationService,
    @inject(TYPES.ITrackingService) private trackingService: ITrackingService
  ) {}

   async startRide(dto: CreateRideDto): Promise<IRide> {
      const session = await this.userRepo.startSession();
      try {
        const result = await session.withTransaction(async () => {
          const driver = await this.userRepo.findUserById(dto.driverId!, { session });
          if (!driver) throw new Error("Driver not found");
          if (driver.govId?.verificationStatus !== "Verified")
            throw new Error("Driver must be verified");
  
          const canStart = await this.subscriptionService.canStartRide(dto.driverId!);
          if (!canStart) {
            const { startRides } = await this.subscriptionService.getRemainingRideCounts(dto.driverId!);
            if (startRides === 0) {
              throw new Error("Ride start limit exceeded. Please upgrade your subscription to start more rides.");
            } else {
              throw new Error(`Ride start limit exceeded. Remaining starts: ${startRides}`);
            }
          }
  
          const vehicle = await this.vehicleRepo.findById(dto.vehicleId, { session });
          if (!vehicle) throw new Error("Vehicle not found");
          if (vehicle.user.toString() !== dto.driverId)
            throw new Error("Vehicle mismatch");
          if (vehicle.status !== "Approved")
            throw new Error("Vehicle not approved");
          if (dto.passengerCount > vehicle.seatCapacity) {
            throw new Error(`Passenger count (${dto.passengerCount}) exceeds vehicle seat capacity (${vehicle.seatCapacity})`);
          }
  
          if (dto.startPoint === dto.endPoint)
            throw new Error("Start and end points cannot be the same");
  
          const newRideDate = new Date(dto.date);
          const newRideTime = dto.time.split(':').map(Number);
          const newRideStart = new Date(newRideDate.getFullYear(), newRideDate.getMonth(), newRideDate.getDate(), newRideTime[0], newRideTime[1]);
          const averageSpeedKmh = 50;
          const bufferMinutes = 30;
          const estimatedDurationHours = dto.distance / averageSpeedKmh;
          const estimatedEndTime = new Date(newRideStart.getTime() + estimatedDurationHours * 60 * 60 * 1000 + bufferMinutes * 60 * 1000);
  
          const existingRides = await this.rideRepo.find({
            driverId: dto.driverId,
            date: new Date(dto.date),
            status: { $in: ["Pending", "Started"] },
          });
  
          for (const existingRide of existingRides) {
            const existingTime = existingRide.time.split(':').map(Number);
            const existingStart = new Date(existingRide.date.getFullYear(), existingRide.date.getMonth(), existingRide.date.getDate(), existingTime[0], existingTime[1]);
            const existingEstimatedDurationHours = existingRide.distanceKm / averageSpeedKmh;
            const existingEnd = new Date(existingStart.getTime() + existingEstimatedDurationHours * 60 * 60 * 1000 + bufferMinutes * 60 * 1000);
  
            if (
              (newRideStart >= existingStart && newRideStart < existingEnd) ||
              (existingStart >= newRideStart && existingStart < estimatedEndTime)
            ) {
              throw new Error("You have a conflicting ride scheduled around this time. Please choose a different time.");
            }
          }
  
          const driverName = driver.fullName;
          const route = await this.osrmClient.getRoute(
            [dto.startPoint, dto.endPoint],
            dto.routeGeometry
          );
          const routeCoordinates = route.coordinates;
  
          if (routeCoordinates.length < 2)
            throw new Error("Invalid route coordinates");
  
          const [startLat, startLng] = dto.startPoint.split(",").map(Number);
          const [endLat, endLng] = dto.endPoint.split(",").map(Number);
          const startPlaceName = await this.osrmClient.reverseGeocode(
            startLat,
            startLng
          );
          const endPlaceName = await this.osrmClient.reverseGeocode(
            endLat,
            endLng
          );
  
          const distanceKm = dto.distance;
          const fuelNeeded = distanceKm / vehicle.mileage;
          let totalFuelCost = fuelNeeded * dto.fuelPrice;
          let platformFee = dto.platformFee || 0;
  
          const isSubscribed = await this.subscriptionService.hasActiveSubscription(dto.driverId!);
          if (!isSubscribed) {
            platformFee = Math.ceil(totalFuelCost * 0.1);
            if (!driver.wallet)
              throw new Error(
                "Driver's wallet is not initialized. Please contact support."
              );
            if (driver.wallet.balance < platformFee)
              throw new Error(
                `Insufficient wallet balance. Please add ₹${
                  platformFee - driver.wallet.balance
                } to your wallet.`
              );
            driver.wallet.balance -= platformFee;
            driver.wallet.transactions.push({
              transactionId: `TXN_${Date.now()}`,
              type: "WITHDRAWAL",
              amount: platformFee,
              status: "COMPLETED",
              createdAt: new Date(),
            });
            await this.userRepo.updateOne(
              { _id: driver._id },
              { $set: { wallet: driver.wallet } },
              { session }
            );
          }
  
          const totalRideCost = totalFuelCost + platformFee;
          const perKmRate = totalRideCost / distanceKm;
  
          let rideId: string;
          let existingRide: IRide | null;
          do {
            rideId = `RIDE_${Date.now()}`;
            existingRide = await this.rideRepo.findOne({ rideId }, { session });
          } while (existingRide);
  
          console.log(
            `[${new Date().toISOString()}] Calculated perKmRate for ride ${rideId}:`,
            { totalRideCost, distanceKm, perKmRate }
          );
  
          const rideData: RideCreationData = {
            rideId,
            driverId: dto.driverId!,
            driverName,
            vehicleId: dto.vehicleId,
            date: new Date(dto.date),
            time: dto.time,
            startPoint: dto.startPoint,
            startPlaceName: dto.startPlaceName || startPlaceName,
            endPoint: dto.endPoint,
            endPlaceName: dto.endPlaceName || endPlaceName, 
            distanceKm,
            mileage: vehicle.mileage,
            fuelPrice: dto.fuelPrice,
            passengerCount: dto.passengerCount,
            totalFuelCost,
            platformFee,
            totalRideCost,
            perKmRate,
            passengers: [],
            status: "Pending",
            routeGeometry: route.geometry,
            pickupPoints: [],
            dropoffPoints: [],
            routeCoordinates,
            passengerDistances: [],
            passengerCosts: [],
          };
  
          const createdRide = await this.rideRepo.createRide(rideData, { session });
  
          await this.subscriptionService.decrementStartRideCount(dto.driverId!);
  
          const startMessage = `You have initiated ride ${rideId}. Start: ${dto.startPlaceName || startPlaceName}, End: ${dto.endPlaceName || endPlaceName}, Date: ${dto.date} ${dto.time}`;
          await this.notificationService.triggerRideCancellationNotification(
            rideId,
            dto.driverId!,
            startMessage
          );
  
          return createdRide;
        });
        return result!;
      } catch (error) {
        console.error(
          `[RideService] Error starting ride: ${(error as Error).message}`
        );
        throw error;
      } finally {
        session.endSession();
      }
    }

  async editRide(
    rideId: string,
    driverId: string,
    dto: EditRideDto
  ): Promise<IRide> {
    const ride = await this.rideRepo.findOne({ rideId });
    if (!ride) throw new Error("Ride not found");
    if (ride.driverId !== driverId) throw new Error("Unauthorized");

    if (
      ride.status !== "Pending" &&
      (!dto.status || dto.status !== "Started")
    ) {
      throw new Error("Only Pending rides editable or can be started");
    }

    const newDateTime =
      dto.date && dto.time ? new Date(`${dto.date}T${dto.time}:00`) : undefined;
    if (newDateTime && newDateTime <= new Date() && !dto.status) {
      throw new Error("Future date required for date/time changes");
    }

    await this.rideRepo.updateOne(
      { rideId },
      {
        date: dto.date ? new Date(dto.date) : ride.date,
        time: dto.time || ride.time,
        status: dto.status || ride.status,
      }
    );

    const updatedRide = await this.rideRepo.findOne({ rideId })!;
    if (updatedRide) {
      const message = `Ride ${rideId} has been updated. New date: ${dto.date || ride.date.toISOString().split('T')[0]}, New time: ${dto.time || ride.time}, Status: ${dto.status || ride.status}`;
      for (const passenger of updatedRide.passengers) {
        await this.notificationService.triggerRideCancellationNotification(
          rideId,
          passenger.passengerId,
          message
        );
      }
    }

    return updatedRide!;
  }

  async cancelRide(rideId: string, driverId: string): Promise<void> {
    const session = await this.rideRepo.startSession();
    try {
      await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne({ rideId }, { session });
        if (!ride) throw new Error("Ride not found");
        if (ride.driverId !== driverId) throw new Error("Unauthorized");
        if (ride.status !== "Pending")
          throw new Error("Only Pending rides cancellable");

        const driver = await this.userRepo.findUserById(ride.driverId, {
          session,
        });
        if (!driver) throw new Error("Driver not found");
        if (!driver.wallet)
          throw new Error(
            "Driver's wallet is not initialized. Please contact support."
          );

        const totalRefund = ride.passengerCosts.reduce((sum, pc) => sum + pc.cost, 0);
        if (driver.wallet.balance < totalRefund) {
          throw new Error(
            `Driver's wallet has insufficient balance for refund. Please contact support.`
          );
        }

        for (const passenger of ride.passengers) {
          const passengerData = await this.userRepo.findUserById(
            passenger.passengerId,
            { session }
          );
          if (!passengerData) {
            console.error(
              `[${new Date().toISOString()}] Passenger not found: ${passenger.passengerId}`
            );
            continue;
          }
          if (!passengerData.wallet) {
            console.error(
              `[${new Date().toISOString()}] Passenger wallet not initialized: ${passenger.passengerId}`
            );
            continue;
          }
          const passengerCost = ride.passengerCosts.find((pc) => pc.passengerId === passenger.passengerId)?.cost || 0;
          passengerData.wallet.balance += passengerCost;
          passengerData.wallet.transactions.push({
            transactionId: `TXN_${Date.now()}`,
            type: "REFUND",
            amount: passengerCost,
            status: "COMPLETED",
            createdAt: new Date(),
          });
          await this.userRepo.updateOne(
            { _id: passengerData._id },
            { $set: { wallet: passengerData.wallet } },
            { session }
          );

          await this.notificationService.triggerRideCancellationNotification(
            rideId,
            passenger.passengerId,
            `Ride ${rideId} has been cancelled by the driver. Refund of ${passengerCost} credited to your wallet.`
          );
        }

        driver.wallet.balance -= totalRefund;
        driver.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "WITHDRAWAL",
          amount: totalRefund,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this.userRepo.updateOne(
          { _id: driver._id },
          { $set: { wallet: driver.wallet } },
          { session }
        );

        await this.rideRepo.updateOne(
          { rideId },
          { status: "Cancelled" },
          { session }
        );
      });
    } catch (error) {
      console.error(
        `[RideService] Error cancelling ride ${rideId}: ${(error as Error).message}`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

 async getRides(userId: string): Promise<IRide[]> {
    const rides = await this.rideRepo.find({ driverId: userId });
    const sortedRides = rides.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    console.log("Sorted rides:", sortedRides);
    return sortedRides;
  }

   async findById(rideId: string): Promise<IRide | null> {
      try {
        console.log("[RideService] Finding ride by _id:", rideId);
        if (!Types.ObjectId.isValid(rideId)) {
          console.warn(`[RideService] Invalid ObjectId: ${rideId}`);
          return null;
        }
        const ride = await this.rideRepo.findOne({
          _id: new Types.ObjectId(rideId),
        });
        if (!ride) {
          console.warn(`[RideService] No ride found for _id: ${rideId}`);
          return null;
        }
        console.log("[RideService] Found ride:", ride);
        return ride;
      } catch (error) {
        console.error(
          `[RideService] Error fetching ride with _id ${rideId}:`,
          (error as Error).message
        );
        throw new Error(`Failed to fetch ride: ${(error as Error).message}`);
      }
    }

  async startTracking(rideId: string, driverId: string): Promise<IRide> {
    const session = await this.rideRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne({ rideId }, { session });
        if (!ride) {
          console.error("[RideService] No ride found in database for rideId:", rideId);
          throw new Error("Ride not found");
        }
        if (ride.driverId !== driverId) throw new Error("Unauthorized");
        if (ride.status !== "Pending") throw new Error("Only Pending rides can be started");

        const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
        if (new Date() < rideDateTime) {
          console.warn("Starting tracking before scheduled time");
        }

        await this.rideRepo.updateOne({ rideId }, { status: "Started" }, { session });

        // Notify all passengers that the ride has started
        for (const passenger of ride.passengers) {
          await this.notificationService.triggerRideCancellationNotification(
            rideId,
            passenger.passengerId,
            `Ride ${rideId} has started. Get ready for your trip!`
          );
        }

        return (await this.rideRepo.findOne({ rideId }, { session }))!;
      });
      return result!;
    } catch (error) {
      console.error(`[RideService] Error starting tracking for ride ${rideId}: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

async updateRide(rideId: string, driverId: string, updates: { passengerId?: string; action?: "picked" | "dropped"; status?: string; currentPosition?: [number, number] }): Promise<IRide> {
  console.log("[RideService] updateRide called with:", { rideId, driverId, updates });
  
  if (!Types.ObjectId.isValid(rideId)) {
    throw new Error("Invalid ride ID");
  }

  const session = await this.rideRepo.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
      console.log("[RideService] Found ride:", ride);
      
      if (!ride) throw new Error("Ride not found");
      if (ride.driverId !== driverId) throw new Error("Unauthorized");

      // Handle status updates
      if (updates.status) {
        console.log("[RideService] Updating status to:", updates.status);
        await this.rideRepo.updateOne(
          { _id: new Types.ObjectId(rideId) },
          { status: updates.status },
          { session }
        );
      }
      
      // Handle passenger actions (picked/dropped)
      if (updates.action && updates.passengerId) {
        console.log("[RideService] Processing action:", updates.action);
        // Your existing logic for handling passenger actions
        const passengerIndex = ride.passengers.findIndex(p => p.passengerId === updates.passengerId);
        if (passengerIndex === -1) throw new Error("Passenger not found");
        
        if (updates.action === "picked") {
          ride.passengers[passengerIndex].pickedUp = true;
        } else if (updates.action === "dropped") {
          ride.passengers[passengerIndex].droppedOff = true;
        }
        
        await this.rideRepo.updateOne(
          { _id: new Types.ObjectId(rideId) },
          { passengers: ride.passengers },
          { session }
        );
      }

      const updatedRide = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
      if (!updatedRide) throw new Error("Updated ride not found");
      return updatedRide;
    });
    return result!;
  } catch (error) {
    console.error(`[RideService] Error updating ride ${rideId}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
}
}