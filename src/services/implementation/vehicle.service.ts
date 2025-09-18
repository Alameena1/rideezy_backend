import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IVehicle } from "../../models/vehicle.modal";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IVehicleService } from "../interfaces/vehicle/ivehicleService";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { Types } from "mongoose";
import UserModel from "../../models/user.model";

@injectable()
export default class VehicleService implements IVehicleService {
  private vehicleRepository: IVehicleRepository;
  private subscriptionService: ISubscriptionService;

  constructor(
    @inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository,
    @inject(TYPES.ISubscriptionService) subscriptionService: ISubscriptionService
  ) {
    this.vehicleRepository = vehicleRepository;
    this.subscriptionService = subscriptionService;
  }

  async addVehicle(userId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    const canRegister = await this.subscriptionService.canRegisterVehicle(userId);
    if (!canRegister) {
      throw new Error("Vehicle registration limit exceeded. Maximum 2 vehicles allowed.");
    }

    const userObjectId = new Types.ObjectId(userId);
    const vehicle = {
      ...vehicleData,
      user: userObjectId,
      seatCapacity: vehicleData.seatCapacity || 1, // Ensure seatCapacity is included
    };
    const createdVehicle = await this.vehicleRepository.createVehicle(vehicle);

    await UserModel.findByIdAndUpdate(userId, {
      $push: { vehicles: { vehicleId: createdVehicle._id } },
    });

    return createdVehicle;
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
    if (!userId) {
      throw new Error("User ID is required");
    }
    if (!vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    const existingVehicle = await this.vehicleRepository.findById(vehicleId);
    if (!existingVehicle || existingVehicle.user.toString() !== userId) {
      throw new Error("Vehicle not found or unauthorized to delete");
    }

    await this.vehicleRepository.deleteVehicle(vehicleId);

    await UserModel.findByIdAndUpdate(userId, {
      $pull: { vehicles: { vehicleId: new Types.ObjectId(vehicleId) } },
    });
  }

  async reapplyVehicle(userId: string, vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    if (!userId) {
      throw new Error("User ID is required");
    }
    if (!vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    const existingVehicle = await this.vehicleRepository.findById(vehicleId);
    if (!existingVehicle || existingVehicle.user.toString() !== userId) {
      throw new Error("Vehicle not found or unauthorized to reapply");
    }
    if (existingVehicle.status !== "Rejected") {
      throw new Error("Only rejected vehicles can be reapplied");
    }

    const updatedVehicle = await this.vehicleRepository.updateVehicle(vehicleId, {
      ...vehicleData,
      status: "Pending",
      note: "",
      updatedAt: new Date(),
    });
    
    return updatedVehicle;
  }
}