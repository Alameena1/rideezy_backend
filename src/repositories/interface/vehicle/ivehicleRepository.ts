import { ClientSession } from "mongoose";
import { IVehicle } from "../../../models/vehicle.modal";

export interface IVehicleRepository {
  createVehicle(data: Partial<IVehicle>, options?: { session: ClientSession }): Promise<IVehicle>;
  findVehiclesByUserId(userId: string, options?: { session: ClientSession }): Promise<IVehicle[]>;
  findById(vehicleId: string, options?: { session: ClientSession }): Promise<IVehicle | null>;
  updateVehicle(vehicleId: string, data: Partial<IVehicle>, options?: { session: ClientSession }): Promise<IVehicle>;
  deleteVehicle(vehicleId: string, options?: { session: ClientSession }): Promise<void>;
}