import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IVehicle } from "../../models/vehicle.modal";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IVehicleService } from "../interfaces/vehicle/ivehicleService";
import { Types } from "mongoose"; 

@injectable()
export default class VehicleService implements IVehicleService {
  private vehicleRepository: IVehicleRepository;

  constructor(@inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository) {
    this.vehicleRepository = vehicleRepository;
  }

  async addVehicle(userId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    console.log("dyfgdscdsfdisuyfi")
    const userObjectId = new Types.ObjectId(userId);
    const vehicle = {
      ...vehicleData,
      user: userObjectId,
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

  async deleteVehicle(userId: string, vehicleId: string): Promise<void> {
    if(!userId) {
      throw new Error("User Id is required");
    }

    if(!vehicleId) {
      throw new Error("Vehicle Id is required")
    }

    const existingVehicle = await this.vehicleRepository.findById(vehicleId);
    if(!existingVehicle || existingVehicle.user.toString() !== userId) {
      throw new Error("vehicle not found or unotherized to delete");
    }

    await this.vehicleRepository.deleteVehicle(vehicleId)
  }
}