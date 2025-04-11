// src/services/implementation/vehicle.service.ts
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IVehicle } from "../../models/vehicle.modal";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IVehicleService } from "../interfaces/vehicle/ivehicleService";
import { Types } from "mongoose"; // Import Types for ObjectId

@injectable()
export default class VehicleService implements IVehicleService {
  private vehicleRepository: IVehicleRepository;

  constructor(@inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository) {
    this.vehicleRepository = vehicleRepository;
  }

  async addVehicle(userId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const userObjectId = new Types.ObjectId(userId); // Convert string to ObjectId
    const vehicle = {
      ...vehicleData,
      user: userObjectId, // Use ObjectId for the user field
    };
    return this.vehicleRepository.createVehicle(vehicle);
  }

  async getUserVehicles(userId: string): Promise<IVehicle[]> {
    if (!userId) {
      throw new Error("User ID is required");
    }
    return this.vehicleRepository.findVehiclesByUserId(userId);
  }

  async updateVehicle(userId: string, vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    if (!userId) {
      throw new Error("User ID is required");
    }
    if (!vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    const existingVehicle = await this.vehicleRepository.findById(vehicleId);
    if (!existingVehicle || existingVehicle.user.toString() !== userId) {
      throw new Error("Vehicle not found or unauthorized to update");
    }

    const updatedVehicle = await this.vehicleRepository.updateVehicle(vehicleId, vehicleData);
    return updatedVehicle;
  }
}