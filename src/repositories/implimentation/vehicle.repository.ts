import { injectable } from "inversify";
import { IVehicle } from "../../models/vehicle.modal";
import { IVehicleRepository } from "../interface/vehicle/ivehicleRepository";
import { BaseRepository } from "../base/base.repository";
import VehicleModel from "../../models/vehicle.modal"; 

@injectable()
export class VehicleRepository extends BaseRepository<IVehicle> implements IVehicleRepository {
  constructor() {
    super(VehicleModel);
  }

  async createVehicle(vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    return this.create(vehicleData) as Promise<IVehicle>;
  }

  async findVehiclesByUserId(userId: string): Promise<IVehicle[]> {
    return this.model.find({ user: userId }).populate("user", "-password").exec();
  } 

  async findById(vehicleId: string): Promise<IVehicle | null> {
    return super.findById(vehicleId); 
  }

  async updateVehicle(vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle> {
    const updatedVehicle = await this.updateById(vehicleId, vehicleData) as IVehicle;
    if (!updatedVehicle) {
      throw new Error("Vehicle not found");
    }
    return updatedVehicle;
  }
}

export default VehicleRepository;