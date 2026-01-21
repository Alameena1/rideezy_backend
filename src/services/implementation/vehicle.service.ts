import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IVehicle } from "../../models/vehicle.modal";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IVehicleService } from "../interfaces/vehicle/ivehicleService";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { INotificationService } from "../interfaces/notification/iNotificationService";
import { Types } from "mongoose";
import UserModel from "../../models/user.model";
import logger from "../../config/logger";

@injectable()
export default class VehicleService implements IVehicleService {
  private vehicleRepository: IVehicleRepository;
  private subscriptionService: ISubscriptionService;
  private notificationService: INotificationService;

  constructor(
    @inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository,
    @inject(TYPES.ISubscriptionService) subscriptionService: ISubscriptionService,
    @inject(TYPES.INotificationService) notificationService: INotificationService
  ) {
    this.vehicleRepository = vehicleRepository;
    this.subscriptionService = subscriptionService;
    this.notificationService = notificationService;
  }

  async addVehicle(userId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    try {
      logger.info(`Adding vehicle for user: ${userId}`);
      
      const canRegister = await this.subscriptionService.canRegisterVehicle(userId);
      console.log("opopopooo",canRegister)
      if (!canRegister) {
        logger.warn(`Vehicle registration limit exceeded for user: ${userId}`);
        throw new Error("Vehicle registration limit exceeded. Maximum 2 vehicles allowed.");
      }

      const userObjectId = new Types.ObjectId(userId);
      const vehicle = {
        ...vehicleData,
        user: userObjectId,
        seatCapacity: vehicleData.seatCapacity || 1,
      };
      
      const createdVehicle = await this.vehicleRepository.createVehicle(vehicle);
      await UserModel.findByIdAndUpdate(userId, {
        $push: { vehicles: { vehicleId: createdVehicle._id } },
      });

      logger.info(`Vehicle added successfully: ${createdVehicle._id} for user: ${userId}`);
      return createdVehicle;
    } catch (error) {
      logger.error(`Error adding vehicle for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserVehicles(
    userId: string, 
    page: number = 1, 
    limit: number = 10, 
    search: string = ''
  ): Promise<any> {
    try {
      if (!userId) {
        logger.error("User ID is required for getting vehicles");
        throw new Error("User ID is required");
      }

      const skip = (page - 1) * limit;
      const { vehicles, totalCount } = await this.vehicleRepository.findVehiclesByUserId(
        userId, 
        skip, 
        limit, 
        search
      );

      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.debug(`Retrieved ${vehicles.length} vehicles for user: ${userId}, page: ${page}`);
      
      return {
        vehicles,
        totalCount,
        currentPage: page,
        totalPages,
        hasNextPage,
        hasPrevPage,
      };
    } catch (error) {
      logger.error(`Error getting vehicles for user ${userId}:`, error);
      throw error;
    }
  }

 async updateVehicle(userId: string, vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
  try {
    if (!userId) {
      logger.error("User ID is required for updating vehicle");
      throw new Error("User ID is required");
    }
    if (!vehicleId) {
      logger.error("Vehicle ID is required for updating vehicle");
      throw new Error("Vehicle ID is required");
    }

    const existingVehicle = await this.vehicleRepository.findById(vehicleId);
    if (!existingVehicle || existingVehicle.user.toString() !== userId) {
      logger.warn(`Vehicle not found or unauthorized - Vehicle: ${vehicleId}, User: ${userId}`);
      throw new Error("Vehicle not found or unauthorized to update");
    }

    // Prepare update data, preserving existing images if not provided
    const updateData: Partial<IVehicle> = { ...vehicleData };

    // Handle insurance data - preserve existing image if not provided
    if (vehicleData.insurance) {
      // Create a new insurance object with existing data merged with updates
      const updatedInsurance = {
        number: vehicleData.insurance.number || existingVehicle.insurance.number,
        startDate: vehicleData.insurance.startDate || existingVehicle.insurance.startDate,
        endDate: vehicleData.insurance.endDate || existingVehicle.insurance.endDate,
        status: vehicleData.insurance.status || existingVehicle.insurance.status,
        // Use new image if provided, otherwise keep existing one
        image: vehicleData.insurance.image || existingVehicle.insurance.image,
      };
      
      updateData.insurance = updatedInsurance;
    }

    // Handle pollution data - preserve existing image if not provided
    if (vehicleData.pollution) {
      // Create a new pollution object with existing data merged with updates
      const updatedPollution = {
        number: vehicleData.pollution.number || existingVehicle.pollution.number,
        startDate: vehicleData.pollution.startDate || existingVehicle.pollution.startDate,
        endDate: vehicleData.pollution.endDate || existingVehicle.pollution.endDate,
        status: vehicleData.pollution.status || existingVehicle.pollution.status,
        // Use new image if provided, otherwise keep existing one
        image: vehicleData.pollution.image || existingVehicle.pollution.image,
      };
      
      updateData.pollution = updatedPollution;
    }

    // Handle vehicle image separately
    if (!vehicleData.vehicleImage && existingVehicle.vehicleImage) {
      // If no new vehicle image provided, preserve the existing one
      updateData.vehicleImage = existingVehicle.vehicleImage;
    }

    const updatedVehicle = await this.vehicleRepository.updateVehicle(vehicleId, updateData);
    logger.info(`Vehicle updated successfully: ${vehicleId} by user: ${userId}`);
    
    return updatedVehicle;
  } catch (error) {
    logger.error(`Error updating vehicle ${vehicleId} for user ${userId}:`, error);
    throw error;
  }
}

  async deleteVehicle(userId: string, vehicleId: string): Promise<void> {
    try {
      if (!userId) {
        logger.error("User ID is required for deleting vehicle");
        throw new Error("User ID is required");
      }
      if (!vehicleId) {
        logger.error("Vehicle ID is required for deleting vehicle");
        throw new Error("Vehicle ID is required");
      }

      const existingVehicle = await this.vehicleRepository.findById(vehicleId);
      if (!existingVehicle || existingVehicle.user.toString() !== userId) {
        logger.warn(`Vehicle not found or unauthorized for deletion - Vehicle: ${vehicleId}, User: ${userId}`);
        throw new Error("Vehicle not found or unauthorized to delete");
      }

      await this.vehicleRepository.deleteVehicle(vehicleId);

      await UserModel.findByIdAndUpdate(userId, {
        $pull: { vehicles: { vehicleId: new Types.ObjectId(vehicleId) } },
      });

      logger.info(`Vehicle deleted successfully: ${vehicleId} by user: ${userId}`);
    } catch (error) {
      logger.error(`Error deleting vehicle ${vehicleId} for user ${userId}:`, error);
      throw error;
    }
  }

  async reapplyVehicle(userId: string, vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    try {
      if (!userId) {
        logger.error("User ID is required for reapplying vehicle");
        throw new Error("User ID is required");
      }
      if (!vehicleId) {
        logger.error("Vehicle ID is required for reapplying vehicle");
        throw new Error("Vehicle ID is required");
      }

      const existingVehicle = await this.vehicleRepository.findById(vehicleId);
      if (!existingVehicle || existingVehicle.user.toString() !== userId) {
        logger.warn(`Vehicle not found or unauthorized for reapply - Vehicle: ${vehicleId}, User: ${userId}`);
        throw new Error("Vehicle not found or unauthorized to reapply");
      }
      
      if (existingVehicle.status !== "Rejected") {
        logger.warn(`Invalid reapply attempt - Vehicle status: ${existingVehicle.status}`);
        throw new Error("Only rejected vehicles can be reapplied");
      }

      const updatedVehicle = await this.vehicleRepository.updateVehicle(vehicleId, {
        ...vehicleData,
        status: "Pending",
        note: "",
        updatedAt: new Date(),
      });
      
      logger.info(`Vehicle reapplied successfully: ${vehicleId} by user: ${userId}`);
      return updatedVehicle;
    } catch (error) {
      logger.error(`Error reapplying vehicle ${vehicleId} for user ${userId}:`, error);
      throw error;
    }
  }

  async checkDocumentExpiry(vehicleId: string): Promise<{ isExpired: boolean; expiredDocuments: string[] }> {
    try {
      logger.debug(`Checking document expiry for vehicle: ${vehicleId}`);
      
      const vehicle = await this.vehicleRepository.findById(vehicleId);
      if (!vehicle) {
        logger.error(`Vehicle not found for document check: ${vehicleId}`);
        throw new Error("Vehicle not found");
      }

      const now = new Date();
      const expiredDocuments: string[] = [];

      if (vehicle.insurance.endDate < now) {
        expiredDocuments.push('insurance');
        logger.debug(`Insurance expired for vehicle: ${vehicleId}`);
      }
      
      if (vehicle.pollution.endDate < now) {
        expiredDocuments.push('pollution');
        logger.debug(`Pollution certificate expired for vehicle: ${vehicleId}`);
      }

      const result = {
        isExpired: expiredDocuments.length > 0,
        expiredDocuments
      };

      logger.debug(`Document expiry check result for ${vehicleId}:`, result);
      return result;
    } catch (error) {
      logger.error(`Error checking document expiry for vehicle ${vehicleId}:`, error);
      throw error;
    }
  }

  async sendDocumentExpiryNotifications(): Promise<void> {
    try {
      logger.info("Starting document expiry notifications check");
      
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const expiringVehicles = await this.vehicleRepository.findVehiclesWithExpiringDocuments(thirtyDaysFromNow);
      logger.info(`Found ${expiringVehicles.length} vehicles with expiring documents`);

      let notificationCount = 0;

      for (const vehicle of expiringVehicles) {
        const messages: string[] = [];
        
        if (vehicle.insurance.endDate <= thirtyDaysFromNow && vehicle.insurance.endDate > now) {
          const daysLeft = Math.ceil((vehicle.insurance.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          messages.push(`Insurance expires in ${daysLeft} days`);
        } else if (vehicle.insurance.endDate < now) {
          messages.push('Insurance has expired');
        }

        if (vehicle.pollution.endDate <= thirtyDaysFromNow && vehicle.pollution.endDate > now) {
          const daysLeft = Math.ceil((vehicle.pollution.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          messages.push(`Pollution certificate expires in ${daysLeft} days`);
        } else if (vehicle.pollution.endDate < now) {
          messages.push('Pollution certificate has expired');
        }

        if (messages.length > 0) {
          const message = `Vehicle ${vehicle.vehicleName} (${vehicle.licensePlate}): ${messages.join(', ')}. Please update your documents.`;
          
          await this.notificationService.triggerRideCancellationNotification(
            vehicle._id.toString(),
            vehicle.user.toString(),
            message
          );
          
          notificationCount++;
          logger.debug(`Sent document expiry notification for vehicle: ${vehicle._id}`);
        }
      }

      logger.info(`Document expiry notifications completed. Sent ${notificationCount} notifications`);
    } catch (error) {
      logger.error("Error sending document expiry notifications:", error);
      throw error;
    }
  }

  async updateDocumentStatuses(): Promise<void> {
    try {
      logger.info("Updating document statuses based on expiry dates");
      
      await this.vehicleRepository.updateExpiredDocumentStatuses();
      
      logger.info("Document statuses updated successfully");
    } catch (error) {
      logger.error("Error updating document statuses:", error);
      throw error;
    }
  }

  async getVehicleWithDocuments(vehicleId: string): Promise<IVehicle | null> {
    try {
      logger.debug(`Getting vehicle with documents: ${vehicleId}`);
      
      const vehicle = await this.vehicleRepository.findById(vehicleId);
      
      if (vehicle) {
        logger.debug(`Vehicle found with documents: ${vehicleId}`);
      } else {
        logger.debug(`Vehicle not found: ${vehicleId}`);
      }
      
      return vehicle;
    } catch (error) {
      logger.error(`Error getting vehicle with documents ${vehicleId}:`, error);
      throw error;
    }
  }
}