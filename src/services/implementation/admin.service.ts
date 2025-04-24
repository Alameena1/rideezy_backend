import { IAdminService } from "../interfaces/admin/interface";
import { IAdminRepository } from "../../repositories/interface/admin/interface";
import { generateAccessToken, generateRefreshToken } from "../../helpers/jwt.util";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";

@injectable()
export class AdminService implements IAdminService {
  private adminRepository: IAdminRepository;

  constructor(@inject(TYPES.IAdminRepository) adminRepository: IAdminRepository) {
    this.adminRepository = adminRepository;
  }

  async authenticateAdmin(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { email: adminEmail, password: adminPassword } = this.adminRepository.getAdminCredentials();
    if (email === adminEmail && password === adminPassword) {
      const refreshToken = generateRefreshToken(email);
      const accessToken = generateAccessToken(email);
      return { accessToken, refreshToken };
    } else {
      throw new Error("Invalid credentials");
    }
  }

  async getAllUsers(): Promise<any[]> {
    return this.adminRepository.getAllUsers();
  }

  async toggleUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    await this.adminRepository.updateUserStatus(userId, status);
  }

  async getAllVehicles(): Promise<any[]> {
    return this.adminRepository.getAllVehicles();
  }

  async updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void> {
    await this.adminRepository.updateVehicleStatus(vehicleId, status, note);
  }
}