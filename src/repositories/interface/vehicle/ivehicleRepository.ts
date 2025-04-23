import { IVehicle } from "../../../models/vehicle.modal";

export interface IVehicleRepository {
  createVehicle(vehicleData: Partial<IVehicle>): Promise<IVehicle>;
  findVehiclesByUserId(userId: string): Promise<IVehicle[]>;
  findById(vehicleId: string): Promise<IVehicle | null>; 
  updateVehicle(vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle>; 
  deleteVehicle(vehicleId: string): Promise<void>;
}