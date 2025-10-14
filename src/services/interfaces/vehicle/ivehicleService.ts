import { IVehicle } from "../../../models/vehicle.modal";

interface VehicleListResponse {
  vehicles: IVehicle[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface IVehicleService {
  addVehicle(userId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle>;
  getUserVehicles(
    userId: string, 
    page?: number, 
    limit?: number, 
    search?: string
  ): Promise<VehicleListResponse>;
  updateVehicle(userId: string, vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle>;
  deleteVehicle(userId: string, vehicleId: string): Promise<void>;
  reapplyVehicle(userId: string, vehicleId: string, vehicleData: Partial<IVehicle>): Promise<IVehicle>;
  checkDocumentExpiry(vehicleId: string): Promise<{ isExpired: boolean; expiredDocuments: string[] }>;
  sendDocumentExpiryNotifications(): Promise<void>;
  updateDocumentStatuses(): Promise<void>;
  getVehicleWithDocuments(vehicleId: string): Promise<IVehicle | null>;
}