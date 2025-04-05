// src/repositories/interface/admin/interface.ts
export interface IAdminRepository {
  getAdminCredentials(): {
    email: string;
    password: string;
  };
  getAllUsers(): Promise<any[]>;
  updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
}