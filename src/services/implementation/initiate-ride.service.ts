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
          console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",vehicle?.status)
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


async emergencyStopRide(rideId: string, driverId: string, reason: string, currentPosition: [number, number]): Promise<IRide> {
    const session = await this.rideRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        if (!ride) throw new Error("Ride not found");
        if (ride.driverId !== driverId) throw new Error("Unauthorized");
        if (ride.status !== "Started") throw new Error("Only started rides can be emergency stopped");

        // Calculate distance traveled and remaining distance
        const totalDistanceTraveled = await this.calculateDistanceTraveled(ride, currentPosition);
        const estimatedRemainingDistance = Math.max(0, ride.distanceKm - totalDistanceTraveled);
        
        // Calculate refund percentage based on distance traveled
        const refundPercentage = this.calculateRefundPercentage(totalDistanceTraveled, ride.distanceKm);
        
        // Update ride with emergency stop details
        const emergencyStop = {
          reason,
          stoppedAt: new Date(),
          currentPosition,
          totalDistanceTraveled,
          estimatedRemainingDistance,
          refundPercentage,
        };

        await this.rideRepo.updateOne(
          { _id: new Types.ObjectId(rideId) },
          { 
            status: "EmergencyStopped",
            emergencyStop,
            currentPosition,
            totalDistanceTraveled
          },
          { session }
        );

        const updatedRide = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        if (!updatedRide) throw new Error("Updated ride not found");

        // Stop tracking
        try {
          await this.trackingService.stopTracking(rideId);
        } catch (error) {
          console.warn(`[RideService] Error stopping tracking for emergency stop: ${error}`);
        }

        // Process refunds and get the total refund amount
        const totalRefundAmount = await this.processEmergencyRefunds(rideId, session);

        // Notify all passengers
        for (const passenger of updatedRide.passengers) {
          const refundAmount = passenger.cost * (refundPercentage / 100);
          await this.notificationService.triggerRideCancellationNotification(
            rideId,
            passenger.passengerId,
            `🚨 Ride Emergency Stop: ${reason}. You have received a ${refundPercentage}% refund (₹${refundAmount.toFixed(2)}) credited to your wallet.`
          );
        }

        // Notify driver
        await this.notificationService.triggerRideCancellationNotification(
          rideId,
          driverId,
          `Ride emergency stopped: ${reason}. Total refund of ₹${totalRefundAmount.toFixed(2)} has been deducted from your wallet and credited to passengers.`
        );

        return updatedRide;
      });
      return result!;
    } catch (error) {
      console.error(`[RideService] Error emergency stopping ride ${rideId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async processEmergencyRefunds(rideId: string, session?: any): Promise<number> { 
    const useExternalSession = !session;
    const internalSession = useExternalSession ? await this.rideRepo.startSession() : session;
    
    try {
      if (useExternalSession) {
        return await internalSession.withTransaction(async () => {
          return await this._processEmergencyRefunds(rideId, internalSession);
        });
      } else {
        return await this._processEmergencyRefunds(rideId, internalSession);
      }
    } finally {
      if (useExternalSession) {
        internalSession.endSession();
      }
    }
  }

  private async _processEmergencyRefunds(rideId: string, session: any): Promise<number> { // CHANGE RETURN TYPE TO number
    const ride = await this.rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
    if (!ride || !ride.emergencyStop) {
      throw new Error("Ride not found or no emergency stop recorded");
    }

    const { refundPercentage } = ride.emergencyStop;

    // First, get the driver's wallet to deduct refunds from
    const driver = await this.userRepo.findUserById(ride.driverId, { session });
    if (!driver || !driver.wallet) {
      throw new Error("Driver wallet not found");
    }

    let totalRefundAmount = 0;

    for (const passenger of ride.passengers) {
      try {
        const passengerUser = await this.userRepo.findUserById(passenger.passengerId, { session });
        if (!passengerUser || !passengerUser.wallet) {
          console.error(`[RideService] Passenger wallet not found for: ${passenger.passengerId}`);
          continue;
        }

        const refundAmount = passenger.cost * (refundPercentage / 100);
        totalRefundAmount += refundAmount;

        // 1. Deduct from driver's wallet
        if (driver.wallet.balance < refundAmount) {
          console.error(`[RideService] Insufficient balance in driver wallet for refund. Driver: ${driver.wallet.balance}, Required: ${refundAmount}`);
          throw new Error(`Insufficient balance in driver wallet for refund processing`);
        }

        driver.wallet.balance -= refundAmount;
        driver.wallet.transactions.push({
          transactionId: `REFUND_DRIVER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: "REFUND_PAYOUT", // NOW THIS WILL WORK
          amount: refundAmount, // Use positive amount, the type indicates it's a payout
          status: "COMPLETED",
          createdAt: new Date(),
          description: `Emergency ride stop refund to passenger ${passenger.passengerName} - Ride ${ride.rideId}`
        });

        // 2. Credit to passenger's wallet
        passengerUser.wallet.balance += refundAmount;
        passengerUser.wallet.transactions.push({
          transactionId: `REFUND_PASSENGER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: "REFUND",
          amount: refundAmount,
          status: "COMPLETED",
          createdAt: new Date(),
          description: `Emergency ride stop refund - Ride ${ride.rideId}`
        });

        // Update passenger wallet
        await this.userRepo.updateOne(
          { _id: passengerUser._id },
          { $set: { wallet: passengerUser.wallet } },
          { session }
        );

        // Update passenger refund details in ride
        const passengerIndex = ride.passengers.findIndex(p => p.passengerId === passenger.passengerId);
        if (passengerIndex !== -1) {
          ride.passengers[passengerIndex].refundAmount = refundAmount;
          ride.passengers[passengerIndex].refundStatus = "processed";
        }

        console.log(`[RideService] Refund processed for passenger ${passenger.passengerId}: ₹${refundAmount} (deducted from driver, credited to passenger)`);
      } catch (error) {
        console.error(`[RideService] Error processing refund for passenger ${passenger.passengerId}:`, error);
        
        // Mark refund as failed
        const passengerIndex = ride.passengers.findIndex(p => p.passengerId === passenger.passengerId);
        if (passengerIndex !== -1) {
          ride.passengers[passengerIndex].refundStatus = "failed";
        }
      }
    }

    // Update driver's wallet with all deductions
    await this.userRepo.updateOne(
      { _id: driver._id },
      { $set: { wallet: driver.wallet } },
      { session }
    );

    // Update ride with refund details
    await this.rideRepo.updateOne(
      { _id: new Types.ObjectId(rideId) },
      { passengers: ride.passengers },
      { session }
    );

    console.log(`[RideService] Total refund amount processed: ₹${totalRefundAmount} deducted from driver ${ride.driverId}`);
    
    return totalRefundAmount; // RETURN THE TOTAL AMOUNT
  }

  private async calculateDistanceTraveled(ride: IRide, currentPosition: [number, number]): Promise<number> {
    try {
      // Get the route coordinates
      const routeCoordinates = ride.routeCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      
      // Find the nearest point on the route to current position
      let nearestIndex = 0;
      let minDistance = Infinity;
      
      for (let i = 0; i < routeCoordinates.length; i++) {
        const distance = this.calculateHaversineDistance(currentPosition, routeCoordinates[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }

      // Calculate cumulative distance from start to nearest point
      let totalDistance = 0;
      for (let i = 1; i <= nearestIndex; i++) {
        const segmentDistance = this.calculateHaversineDistance(routeCoordinates[i-1], routeCoordinates[i]);
        totalDistance += segmentDistance;
      }

      return totalDistance;
    } catch (error) {
      console.error("[RideService] Error calculating distance traveled:", error);
      // Fallback: estimate based on time if route calculation fails
      const rideStartTime = new Date(`${ride.date.toISOString().split('T')[0]}T${ride.time}:00`);
      const now = new Date();
      const hoursElapsed = (now.getTime() - rideStartTime.getTime()) / (1000 * 60 * 60);
      const estimatedDistance = hoursElapsed * 40; // Assume 40 km/h average speed
      return Math.min(estimatedDistance, ride.distanceKm);
    }
  }

  private calculateRefundPercentage(distanceTraveled: number, totalDistance: number): number {
    const percentageTraveled = (distanceTraveled / totalDistance) * 100;
    
    // Refund logic based on distance traveled:
    if (percentageTraveled <= 25) {
      return 80; // 80% refund if less than 25% traveled
    } else if (percentageTraveled <= 50) {
      return 60; // 60% refund if 25-50% traveled
    } else if (percentageTraveled <= 75) {
      return 40; // 40% refund if 50-75% traveled
    } else {
      return 20; // 20% refund if more than 75% traveled
    }
  }

  private calculateHaversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }


}