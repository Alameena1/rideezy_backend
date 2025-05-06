// src/repositories/interface/admin/interface.ts
import { IUser } from "../../../models/user.model";

export interface IAdminRepository {
  getAllUsers(): Promise<any[]>;
  updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
  getAllVehicles(): Promise<any[]>;
  updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void>;
  findUserById(userId: string): Promise<IUser | null>;
  updateUser(userId: string, updatedData: Partial<IUser>): Promise<IUser | null>;
}