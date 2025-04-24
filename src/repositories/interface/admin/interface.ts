export interface IAdminRepository {
  getAdminCredentials(): {
    email: string;
    password: string;
  };
  getAllUsers(): Promise<any[]>;
  updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
  getAllVehicles(): Promise<any[]>;
  updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void>; // Add this line
}