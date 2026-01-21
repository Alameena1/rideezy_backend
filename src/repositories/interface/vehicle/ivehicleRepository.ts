import { ClientSession } from "mongoose";
import { IVehicle } from "../../../models/vehicle.modal";

interface VehicleListResult {
  vehicles: IVehicle[];
  totalCount: number;
}

export interface IVehicleRepository {
  createVehicle(data: Partial<IVehicle>, options?: { session: ClientSession }): Promise<IVehicle>;
  findVehiclesByUserId(
    userId: string, 
    skip?: number, 
    limit?: number, 
    search?: string,
    options?: { session: ClientSession }
  ): Promise<VehicleListResult>;
  findById(vehicleId: string, options?: { session: ClientSession }): Promise<IVehicle | null>;
  updateVehicle(vehicleId: string, data: Partial<IVehicle>, options?: { session: ClientSession }): Promise<IVehicle>;
  deleteVehicle(vehicleId: string, options?: { session: ClientSession }): Promise<void>;
  findVehiclesWithExpiringDocuments(expiryDate: Date): Promise<IVehicle[]>;
  updateExpiredDocumentStatuses(): Promise<void>;
}