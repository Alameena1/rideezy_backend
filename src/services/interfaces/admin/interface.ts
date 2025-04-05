// src/services/interfaces/admin/interface.ts
export interface IAdminService {
  authenticateAdmin(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }>;
  getAllUsers(): Promise<any[]>;
  toggleUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
}