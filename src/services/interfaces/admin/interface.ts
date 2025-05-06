// src/services/interfaces/admin/interface.ts
import { IUser } from "../../../models/user.model";

export interface IAdminService {
  authenticateAdmin(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }>;
  saveRefreshToken(email: string, refreshToken: string): Promise<void>;
  invalidateRefreshToken(email: string, refreshToken: string): Promise<void>;
  getAllUsers(): Promise<any[]>;
  updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
  getAllVehicles(): Promise<any[]>;
  updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void>;
  verifyGovId(userId: string, status: "Verified" | "Rejected"): Promise<IUser>;
}