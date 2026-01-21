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
import logger from "../../config/logger";

@injectable()
export class InitiateRideService implements IInitiateRideService {
  private userRepository: IUserRepository;
  private vehicleRepository: IVehicleRepository;
  private rideRepository: IInitiateRideRepository;
  private subscriptionService: ISubscriptionService;
  private osrmClient: IOSRMClient;
  private notificationService: INotificationService;
  private trackingService: ITrackingService;

  constructor(
    @inject(TYPES.IUserRepository) userRepository: IUserRepository,
    @inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository,
    @inject(TYPES.IInitiateRideRepository) rideRepository: IInitiateRideRepository,
    @inject(TYPES.ISubscriptionService) subscriptionService: ISubscriptionService,
    @inject(TYPES.IOSRMClient) osrmClient: IOSRMClient,
    @inject(TYPES.INotificationService) notificationService: INotificationService,
    @inject(TYPES.ITrackingService) trackingService: ITrackingService
  ) {
    this.userRepository = userRepository;
    this.vehicleRepository = vehicleRepository;
    this.rideRepository = rideRepository;
    this.subscriptionService = subscriptionService;
    this.osrmClient = osrmClient;
    this.notificationService = notificationService;
    this.trackingService = trackingService;
  }

  async startRide(dto: CreateRideDto): Promise<IRide> {
    const session = await this.userRepository.startSession();
    
    try {
      logger.info(`Starting ride creation process for driver: ${dto.driverId}`);
      
      const result = await session.withTransaction(async () => {
        const driver = await this.userRepository.findUserById(dto.driverId!, { session });
        if (!driver) {
          logger.error(`Driver not found: ${dto.driverId}`);
          throw new Error("Driver not found");
        }
        
        if (driver.govId?.verificationStatus !== "Verified") {
          logger.warn(`Driver verification failed for: ${dto.driverId}`);
          throw new Error("Driver must be verified");
        }

        // Validate vehicle documents
        const documentValidation = await this.validateVehicleDocuments(dto.vehicleId);
        if (!documentValidation.isValid) {
          logger.warn(`Vehicle document validation failed for vehicle: ${dto.vehicleId}`, {
            errors: documentValidation.errors
          });
          throw new Error(`Cannot start ride: ${documentValidation.errors.join(', ')}`);
        }

        const canStart = await this.subscriptionService.canStartRide(dto.driverId!);
        if (!canStart) {
          const { startRides } = await this.subscriptionService.getRemainingRideCounts(dto.driverId!);
          if (startRides === 0) {
            logger.warn(`Ride start limit exceeded for driver: ${dto.driverId}`);
            throw new Error("Ride start limit exceeded. Please upgrade your subscription to start more rides.");
          } else {
            logger.warn(`Ride start limit exceeded for driver: ${dto.driverId}, remaining: ${startRides}`);
            throw new Error(`Ride start limit exceeded. Remaining starts: ${startRides}`);
          }
        }

        const vehicle = await this.vehicleRepository.findById(dto.vehicleId, { session });
        logger.debug(`Vehicle lookup result: ${vehicle ? 'Found' : 'Not found'}`);
        
        if (!vehicle) {
          logger.error(`Vehicle not found: ${dto.vehicleId}`);
          throw new Error("Vehicle not found");
        }
        
        if (vehicle.user.toString() !== dto.driverId) {
          logger.warn(`Vehicle mismatch - Vehicle user: ${vehicle.user}, Driver: ${dto.driverId}`);
          throw new Error("Vehicle mismatch");
        }
        
        if (vehicle.status !== "Approved") {
          logger.warn(`Vehicle not approved - Status: ${vehicle.status}`);
          throw new Error("Vehicle not approved");
        }
        
        if (dto.passengerCount > vehicle.seatCapacity) {
          logger.warn(`Passenger count exceeds capacity - Requested: ${dto.passengerCount}, Capacity: ${vehicle.seatCapacity}`);
          throw new Error(`Passenger count (${dto.passengerCount}) exceeds vehicle seat capacity (${vehicle.seatCapacity})`);
        }

        if (dto.startPoint === dto.endPoint) {
          logger.warn(`Start and end points are the same: ${dto.startPoint}`);
          throw new Error("Start and end points cannot be the same");
        }

        const newRideDate = new Date(dto.date);
        const newRideTime = dto.time.split(':').map(Number);
        const newRideStart = new Date(
          newRideDate.getFullYear(), 
          newRideDate.getMonth(), 
          newRideDate.getDate(), 
          newRideTime[0], 
          newRideTime[1]
        );
        
        const averageSpeedKmh = 50;
        const bufferMinutes = 30;
        const estimatedDurationHours = dto.distance / averageSpeedKmh;
        const estimatedEndTime = new Date(
          newRideStart.getTime() + estimatedDurationHours * 60 * 60 * 1000 + bufferMinutes * 60 * 1000
        );

        const existingRides = await this.rideRepository.find({
          driverId: dto.driverId,
          date: new Date(dto.date),
          status: { $in: ["Pending", "Started"] },
        });

        for (const existingRide of existingRides) {
          const existingTime = existingRide.time.split(':').map(Number);
          const existingStart = new Date(
            existingRide.date.getFullYear(), 
            existingRide.date.getMonth(), 
            existingRide.date.getDate(), 
            existingTime[0], 
            existingTime[1]
          );
          
          const existingEstimatedDurationHours = existingRide.distanceKm / averageSpeedKmh;
          const existingEnd = new Date(
            existingStart.getTime() + existingEstimatedDurationHours * 60 * 60 * 1000 + bufferMinutes * 60 * 1000
          );

          if (
            (newRideStart >= existingStart && newRideStart < existingEnd) ||
            (existingStart >= newRideStart && existingStart < estimatedEndTime)
          ) {
            logger.warn(`Ride time conflict detected for driver: ${dto.driverId}`);
            throw new Error("You have a conflicting ride scheduled around this time. Please choose a different time.");
          }
        }

        const driverName = driver.fullName;
        const route = await this.osrmClient.getRoute(
          [dto.startPoint, dto.endPoint],
          dto.routeGeometry
        );
        
        const routeCoordinates = route.coordinates;

        if (routeCoordinates.length < 2) {
          logger.error(`Invalid route coordinates for ride: ${routeCoordinates.length} points`);
          throw new Error("Invalid route coordinates");
        }

        const [startLat, startLng] = dto.startPoint.split(",").map(Number);
        const [endLat, endLng] = dto.endPoint.split(",").map(Number);
        
        const startPlaceName = await this.osrmClient.reverseGeocode(startLat, startLng);
        const endPlaceName = await this.osrmClient.reverseGeocode(endLat, endLng);

        const distanceKm = dto.distance;
        const fuelNeeded = distanceKm / vehicle.mileage;
        const totalFuelCost = fuelNeeded * dto.fuelPrice;
        let platformFee = dto.platformFee || 0;

        const isSubscribed = await this.subscriptionService.hasActiveSubscription(dto.driverId!);
        if (!isSubscribed) {
          platformFee = Math.ceil(totalFuelCost * 0.1);
          if (!driver.wallet) {
            logger.error(`Driver wallet not initialized: ${dto.driverId}`);
            throw new Error("Driver's wallet is not initialized. Please contact support.");
          }
          
          if (driver.wallet.balance < platformFee) {
            logger.warn(`Insufficient wallet balance - Current: ${driver.wallet.balance}, Required: ${platformFee}`);
            throw new Error(
              `Insufficient wallet balance. Please add ₹${
                platformFee - driver.wallet.balance
              } to your wallet.`
            );
          }
          
          driver.wallet.balance -= platformFee;
          driver.wallet.transactions.push({
            transactionId: `TXN_${Date.now()}`,
            type: "WITHDRAWAL",
            amount: platformFee,
            status: "COMPLETED",
            createdAt: new Date(),
          });
          
          await this.userRepository.updateOne(
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
          existingRide = await this.rideRepository.findOne({ rideId: rideId }, { session });
        } while (existingRide);

        logger.debug(`Calculated ride costs for ${rideId}`, {
          totalRideCost,
          distanceKm,
          perKmRate
        });

        const rideData: RideCreationData = {
          rideId: rideId,
          driverId: dto.driverId!,
          driverName: driverName,
          vehicleId: dto.vehicleId,
          date: new Date(dto.date),
          time: dto.time,
          startPoint: dto.startPoint,
          startPlaceName: dto.startPlaceName || startPlaceName,
          endPoint: dto.endPoint,
          endPlaceName: dto.endPlaceName || endPlaceName, 
          distanceKm: distanceKm,
          mileage: vehicle.mileage,
          fuelPrice: dto.fuelPrice,
          passengerCount: dto.passengerCount,
          totalFuelCost: totalFuelCost,
          platformFee: platformFee,
          totalRideCost: totalRideCost,
          perKmRate: perKmRate,
          passengers: [],
          status: "Pending",
          routeGeometry: route.geometry,
          pickupPoints: [],
          dropoffPoints: [],
          routeCoordinates: routeCoordinates,
          passengerDistances: [],
          passengerCosts: [],
        };

        const createdRide = await this.rideRepository.createRide(rideData, { session });
        await this.subscriptionService.decrementStartRideCount(dto.driverId!);

        const startMessage = `You have initiated ride ${rideId}. Start: ${dto.startPlaceName || startPlaceName}, End: ${dto.endPlaceName || endPlaceName}, Date: ${dto.date} ${dto.time}`;
        await this.notificationService.triggerRideCancellationNotification(
          rideId,
          dto.driverId!,
          startMessage
        );

        logger.info(`Ride created successfully: ${rideId} for driver: ${dto.driverId}`);
        return createdRide;
      });
      
      return result!;
    } catch (error) {
      logger.error(`Error starting ride for driver ${dto.driverId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async validateVehicleDocuments(vehicleId: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      logger.debug(`Validating documents for vehicle: ${vehicleId}`);
      
      const vehicle = await this.vehicleRepository.findById(vehicleId);
      if (!vehicle) {
        logger.error(`Vehicle not found for document validation: ${vehicleId}`);
        throw new Error("Vehicle not found");
      }

      const errors: string[] = [];
      const now = new Date();

      if (vehicle.insurance.endDate < now) {
        errors.push("Insurance has expired");
        logger.warn(`Insurance expired for vehicle: ${vehicleId}`);
      }

      if (vehicle.pollution.endDate < now) {
        errors.push("Pollution certificate has expired");
        logger.warn(`Pollution certificate expired for vehicle: ${vehicleId}`);
      }

      if (vehicle.status !== "Approved") {
        errors.push("Vehicle is not approved");
        logger.warn(`Vehicle not approved: ${vehicleId}, status: ${vehicle.status}`);
      }

      const result = {
        isValid: errors.length === 0,
        errors
      };

      logger.debug(`Document validation result for ${vehicleId}:`, result);
      return result;
    } catch (error) {
      logger.error(`Error validating vehicle documents for ${vehicleId}:`, error);
      throw error;
    }
  }

  async editRide(rideId: string, driverId: string, dto: EditRideDto): Promise<IRide> {
    try {
      logger.info(`Editing ride: ${rideId} by driver: ${driverId}`);
      
      const ride = await this.rideRepository.findOne({ rideId });
      if (!ride) {
        logger.error(`Ride not found for editing: ${rideId}`);
        throw new Error("Ride not found");
      }
      
      if (ride.driverId !== driverId) {
        logger.warn(`Unauthorized edit attempt - Ride driver: ${ride.driverId}, Requested by: ${driverId}`);
        throw new Error("Unauthorized");
      }

      if (ride.status !== "Pending" && (!dto.status || dto.status !== "Started")) {
        logger.warn(`Invalid edit attempt - Ride status: ${ride.status}, Requested status: ${dto.status}`);
        throw new Error("Only Pending rides editable or can be started");
      }

      const newDateTime = dto.date && dto.time ? new Date(`${dto.date}T${dto.time}:00`) : undefined;
      if (newDateTime && newDateTime <= new Date() && !dto.status) {
        logger.warn(`Invalid date/time for ride edit - New date: ${newDateTime}, Current: ${new Date()}`);
        throw new Error("Future date required for date/time changes");
      }

      await this.rideRepository.updateOne(
        { rideId },
        {
          date: dto.date ? new Date(dto.date) : ride.date,
          time: dto.time || ride.time,
          status: dto.status || ride.status,
        }
      );

      const updatedRide = await this.rideRepository.findOne({ rideId });
      
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

      logger.info(`Ride edited successfully: ${rideId}`);
      return updatedRide!;
    } catch (error) {
      logger.error(`Error editing ride ${rideId}:`, error);
      throw error;
    }
  }

  async cancelRide(rideId: string, driverId: string): Promise<void> {
    const session = await this.rideRepository.startSession();
    
    try {
      logger.info(`Cancelling ride: ${rideId} by driver: ${driverId}`);
      
      await session.withTransaction(async () => {
        const ride = await this.rideRepository.findOne({ rideId }, { session });
        if (!ride) {
          logger.error(`Ride not found for cancellation: ${rideId}`);
          throw new Error("Ride not found");
        }
        
        if (ride.driverId !== driverId) {
          logger.warn(`Unauthorized cancellation attempt - Ride driver: ${ride.driverId}, Requested by: ${driverId}`);
          throw new Error("Unauthorized");
        }
        
        if (ride.status !== "Pending") {
          logger.warn(`Invalid cancellation attempt - Ride status: ${ride.status}`);
          throw new Error("Only Pending rides cancellable");
        }

        const driver = await this.userRepository.findUserById(ride.driverId, {
          session,
        });
        if (!driver) {
          logger.error(`Driver not found during cancellation: ${ride.driverId}`);
          throw new Error("Driver not found");
        }
        
        if (!driver.wallet) {
          logger.error(`Driver wallet not initialized during cancellation: ${ride.driverId}`);
          throw new Error("Driver's wallet is not initialized. Please contact support.");
        }

        const totalRefund = ride.passengerCosts.reduce((sum, passengerCost) => sum + passengerCost.cost, 0);
        if (driver.wallet.balance < totalRefund) {
          logger.warn(`Insufficient wallet balance for refund - Current: ${driver.wallet.balance}, Required: ${totalRefund}`);
          throw new Error(`Driver's wallet has insufficient balance for refund. Please contact support.`);
        }

        for (const passenger of ride.passengers) {
          const passengerData = await this.userRepository.findUserById(
            passenger.passengerId,
            { session }
          );
          
          if (!passengerData) {
            logger.error(`Passenger not found during cancellation: ${passenger.passengerId}`);
            continue;
          }
          
          if (!passengerData.wallet) {
            logger.error(`Passenger wallet not initialized: ${passenger.passengerId}`);
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
          
          await this.userRepository.updateOne(
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
        
        await this.userRepository.updateOne(
          { _id: driver._id },
          { $set: { wallet: driver.wallet } },
          { session }
        );

        await this.rideRepository.updateOne(
          { rideId },
          { status: "Cancelled" },
          { session }
        );
      });
      
      logger.info(`Ride cancelled successfully: ${rideId}`);
    } catch (error) {
      logger.error(`Error cancelling ride ${rideId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getRides(userId: string): Promise<IRide[]> {
    try {
      logger.debug(`Getting rides for user: ${userId}`);
      
      const rides = await this.rideRepository.find({ driverId: userId });
      const sortedRides = rides.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      logger.debug(`Retrieved ${sortedRides.length} rides for user: ${userId}`);
      return sortedRides;
    } catch (error) {
      logger.error(`Error getting rides for user ${userId}:`, error);
      throw error;
    }
  }

  async findById(rideId: string): Promise<IRide | null> {
  try {
    console.log("[RideService] Finding ride by _id:", rideId);
    if (!Types.ObjectId.isValid(rideId)) {
      console.warn(`[RideService] Invalid ObjectId: ${rideId}`);
      return null;
    }
    const ride = await this.rideRepository.findOne({
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
    const session = await this.rideRepository.startSession();
    
    try {
      logger.info(`Starting tracking for ride: ${rideId} by driver: ${driverId}`);
      
      const result = await session.withTransaction(async () => {
        const ride = await this.rideRepository.findOne({ rideId }, { session });
        if (!ride) {
          logger.error(`No ride found in database for rideId: ${rideId}`);
          throw new Error("Ride not found");
        }
        
        if (ride.driverId !== driverId) {
          logger.warn(`Unauthorized tracking start - Ride driver: ${ride.driverId}, Requested by: ${driverId}`);
          throw new Error("Unauthorized");
        }
        
        if (ride.status !== "Pending") {
          logger.warn(`Invalid tracking start - Ride status: ${ride.status}`);
          throw new Error("Only Pending rides can be started");
        }

        const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
        if (new Date() < rideDateTime) {
          logger.warn(`Starting tracking before scheduled time for ride: ${rideId}`);
        }

        await this.rideRepository.updateOne({ rideId }, { status: "Started" }, { session });

        // Notify all passengers that the ride has started
        for (const passenger of ride.passengers) {
          await this.notificationService.triggerRideCancellationNotification(
            rideId,
            passenger.passengerId,
            `Ride ${rideId} has started. Get ready for your trip!`
          );
        }

        return (await this.rideRepository.findOne({ rideId }, { session }))!;
      });
      
      logger.info(`Tracking started successfully for ride: ${rideId}`);
      return result!;
    } catch (error) {
      logger.error(`Error starting tracking for ride ${rideId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateRide(rideId: string, driverId: string, updates: { passengerId?: string; action?: "picked" | "dropped"; status?: string; currentPosition?: [number, number] }): Promise<IRide> {
    logger.debug(`Updating ride: ${rideId} with updates:`, updates);
    
    if (!Types.ObjectId.isValid(rideId)) {
      logger.error(`Invalid ride ID: ${rideId}`);
      throw new Error("Invalid ride ID");
    }

    const session = await this.rideRepository.startSession();
    
    try {
      const result = await session.withTransaction(async () => {
        const ride = await this.rideRepository.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        logger.debug(`Found ride for update: ${ride ? ride.rideId : 'Not found'}`);
        
        if (!ride) {
          throw new Error("Ride not found");
        }
        
        if (ride.driverId !== driverId) {
          throw new Error("Unauthorized");
        }

        // Handle status updates
        if (updates.status) {
          logger.debug(`Updating status to: ${updates.status}`);
          await this.rideRepository.updateOne(
            { _id: new Types.ObjectId(rideId) },
            { status: updates.status },
            { session }
          );
        }
        
        // Handle passenger actions (picked/dropped)
        if (updates.action && updates.passengerId) {
          logger.debug(`Processing action: ${updates.action} for passenger: ${updates.passengerId}`);
          
          const passengerIndex = ride.passengers.findIndex(p => p.passengerId === updates.passengerId);
          if (passengerIndex === -1) {
            throw new Error("Passenger not found");
          }
          
          if (updates.action === "picked") {
            ride.passengers[passengerIndex].pickedUp = true;
          } else if (updates.action === "dropped") {
            ride.passengers[passengerIndex].droppedOff = true;
          }
          
          await this.rideRepository.updateOne(
            { _id: new Types.ObjectId(rideId) },
            { passengers: ride.passengers },
            { session }
          );
        }

        const updatedRide = await this.rideRepository.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        if (!updatedRide) {
          throw new Error("Updated ride not found");
        }
        
        return updatedRide;
      });
      
      logger.info(`Ride updated successfully: ${rideId}`);
      return result!;
    } catch (error) {
      logger.error(`Error updating ride ${rideId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async emergencyStopRide(rideId: string, driverId: string, reason: string, currentPosition: [number, number]): Promise<IRide> {
    const session = await this.rideRepository.startSession();
    
    try {
      logger.info(`Emergency stopping ride: ${rideId} by driver: ${driverId}, reason: ${reason}`);
      
      const result = await session.withTransaction(async () => {
        const ride = await this.rideRepository.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        if (!ride) {
          throw new Error("Ride not found");
        }
        
        if (ride.driverId !== driverId) {
          throw new Error("Unauthorized");
        }
        
        if (ride.status !== "Started") {
          throw new Error("Only started rides can be emergency stopped");
        }

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
          totalDistanceTraveled: totalDistanceTraveled,
          estimatedRemainingDistance: estimatedRemainingDistance,
          refundPercentage: refundPercentage,
        };

        await this.rideRepository.updateOne(
          { _id: new Types.ObjectId(rideId) },
          { 
            status: "EmergencyStopped",
            emergencyStop: emergencyStop,
            currentPosition,
            totalDistanceTraveled: totalDistanceTraveled
          },
          { session }
        );

        const updatedRide = await this.rideRepository.findOne({ _id: new Types.ObjectId(rideId) }, { session });
        if (!updatedRide) {
          throw new Error("Updated ride not found");
        }

        // Stop tracking
        try {
          await this.trackingService.stopTracking(rideId);
          logger.debug(`Tracking stopped for emergency stopped ride: ${rideId}`);
        } catch (error) {
          logger.warn(`Error stopping tracking for emergency stop: ${error}`);
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
      
      logger.info(`Ride emergency stopped successfully: ${rideId}`);
      return result!;
    } catch (error) {
      logger.error(`Error emergency stopping ride ${rideId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async processEmergencyRefunds(rideId: string, session?: any): Promise<number> {
    const useExternalSession = !session;
    const internalSession = useExternalSession ? await this.rideRepository.startSession() : session;
    
    try {
      if (useExternalSession) {
        return await internalSession.withTransaction(async () => {
          return await this.processEmergencyRefundsInternal(rideId, internalSession);
        });
      } else {
        return await this.processEmergencyRefundsInternal(rideId, internalSession);
      }
    } finally {
      if (useExternalSession) {
        internalSession.endSession();
      }
    }
  }

  private async processEmergencyRefundsInternal(rideId: string, session: any): Promise<number> {
    logger.debug(`Processing emergency refunds for ride: ${rideId}`);
    
    const ride = await this.rideRepository.findOne({ _id: new Types.ObjectId(rideId) }, { session });
    if (!ride || !ride.emergencyStop) {
      logger.error(`Ride not found or no emergency stop recorded: ${rideId}`);
      throw new Error("Ride not found or no emergency stop recorded");
    }

    const { refundPercentage } = ride.emergencyStop;

    // First, get the driver's wallet to deduct refunds from
    const driver = await this.userRepository.findUserById(ride.driverId, { session });
    if (!driver || !driver.wallet) {
      logger.error(`Driver wallet not found for emergency refund: ${ride.driverId}`);
      throw new Error("Driver wallet not found");
    }

    let totalRefundAmount = 0;

    for (const passenger of ride.passengers) {
      try {
        const passengerUser = await this.userRepository.findUserById(passenger.passengerId, { session });
        if (!passengerUser || !passengerUser.wallet) {
          logger.error(`Passenger wallet not found for: ${passenger.passengerId}`);
          continue;
        }

        const refundAmount = passenger.cost * (refundPercentage / 100);
        totalRefundAmount += refundAmount;

        // 1. Deduct from driver's wallet
        if (driver.wallet.balance < refundAmount) {
          logger.error(`Insufficient balance in driver wallet for refund. Driver: ${driver.wallet.balance}, Required: ${refundAmount}`);
          throw new Error(`Insufficient balance in driver wallet for refund processing`);
        }

        driver.wallet.balance -= refundAmount;
        driver.wallet.transactions.push({
          transactionId: `REFUND_DRIVER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: "REFUND_PAYOUT",
          amount: refundAmount,
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
        await this.userRepository.updateOne(
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

        logger.debug(`Refund processed for passenger ${passenger.passengerId}: ₹${refundAmount}`);
      } catch (error) {
        logger.error(`Error processing refund for passenger ${passenger.passengerId}:`, error);
        
        // Mark refund as failed
        const passengerIndex = ride.passengers.findIndex(p => p.passengerId === passenger.passengerId);
        if (passengerIndex !== -1) {
          ride.passengers[passengerIndex].refundStatus = "failed";
        }
      }
    }

    // Update driver's wallet with all deductions
    await this.userRepository.updateOne(
      { _id: driver._id },
      { $set: { wallet: driver.wallet } },
      { session }
    );

    // Update ride with refund details
    await this.rideRepository.updateOne(
      { _id: new Types.ObjectId(rideId) },
      { passengers: ride.passengers },
      { session }
    );

    logger.info(`Total refund amount processed: ₹${totalRefundAmount} deducted from driver ${ride.driverId}`);
    
    return totalRefundAmount;
  }

  private async calculateDistanceTraveled(ride: IRide, currentPosition: [number, number]): Promise<number> {
    try {
      logger.debug(`Calculating distance traveled for ride: ${ride.rideId}`);
      
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

      logger.debug(`Calculated distance traveled: ${totalDistance}km for ride: ${ride.rideId}`);
      return totalDistance;
    } catch (error) {
      logger.error("Error calculating distance traveled:", error);
      // Fallback: estimate based on time if route calculation fails
      const rideStartTime = new Date(`${ride.date.toISOString().split('T')[0]}T${ride.time}:00`);
      const now = new Date();
      const hoursElapsed = (now.getTime() - rideStartTime.getTime()) / (1000 * 60 * 60);
      const estimatedDistance = hoursElapsed * 40; // Assume 40 km/h average speed
      const result = Math.min(estimatedDistance, ride.distanceKm);
      
      logger.debug(`Using fallback distance calculation: ${result}km`);
      return result;
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