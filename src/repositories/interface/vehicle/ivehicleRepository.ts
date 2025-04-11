// repositories/interface/vehicle/ivehicleRepository.ts
import { IVehicle } from "../../../models/vehicle.modal";

export interface IVehicleRepository {
  createVehicle(vehicleData: Partial<IVehicle>): Promise<IVehicle>;
  findVehiclesByUserId(userId: string): Promise<IVehicle[]>;
  findById(vehicleId: string): Promise<IVehicle | null>; // Changed to string
  updateVehicle(vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle>; // Changed to string
}