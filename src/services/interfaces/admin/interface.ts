export interface IAdminService {
  authenticateAdmin(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }>;
  getAllUsers(): Promise<any[]>;
  toggleUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
  getAllVehicles(): Promise<any[]>;
  updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void>;
  invalidateRefreshToken?(email: string, refreshToken: string): Promise<void>; // Add for logout
}