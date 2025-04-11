import { IVehicle } from "../../../models/vehicle.modal";

export interface IVehicleService {
  addVehicle(userId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle>;
  getUserVehicles(userId: string): Promise<IVehicle[]>;
  updateVehicle(userId: string, vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle>;
}