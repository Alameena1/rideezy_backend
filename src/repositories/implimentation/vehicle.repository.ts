import { injectable } from "inversify";
import { ClientSession } from "mongoose";
import { IVehicleRepository } from "../interface/vehicle/ivehicleRepository";
import { IVehicle } from "../../models/vehicle.modal";
import VehicleModel from "../../models/vehicle.modal";
import { BaseRepository } from "../base/base.repository";

@injectable()
export class VehicleRepository extends BaseRepository<IVehicle> implements IVehicleRepository {
  constructor() {
    super(VehicleModel);
  }

  async createVehicle(data: Partial<IVehicle>, options?: { session: ClientSession }): Promise<IVehicle> {
    return this.create(data, options);
  }

  async findVehiclesByUserId(userId: string, options?: { session: ClientSession }): Promise<IVehicle[]> {
    return this.find({ user: userId }, options);
  }

  async findById(vehicleId: string, options?: { session: ClientSession }): Promise<IVehicle | null> {
    console.log("[VehicleRepository] Finding vehicle with ID:", vehicleId); // Debug log
    return super.findById(vehicleId, options); // Delegate to BaseRepository
  }

  async updateVehicle(
    vehicleId: string,
    data: Partial<IVehicle>,
    options?: { session: ClientSession }
  ): Promise<IVehicle> {
    const vehicle = await this.updateById(vehicleId, data, options);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }
    return vehicle;
  }

  async deleteVehicle(vehicleId: string, options?: { session: ClientSession }): Promise<void> {
    const success = await this.deleteById(vehicleId, options);
    if (!success) {
      throw new Error("Vehicle not found");
    }
  }
}