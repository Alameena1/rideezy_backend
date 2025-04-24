import { IAdminService } from "../interfaces/admin/interface";
import { IAdminRepository } from "../../repositories/interface/admin/interface";
import { generateAccessToken, generateRefreshToken } from "../../helpers/jwt.util";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import bcrypt from "bcrypt"; 

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
    const admin = this.adminRepository.getAdminCredentials();  
       console.log("uierjfuwhg8e",admin)

    if (!admin ) {
      throw new Error("Invalid credentials");
    }

    const accessToken = generateAccessToken(email);
    const refreshToken = generateRefreshToken(email);

    // Save refresh token if using rotation (optional)
    await this.saveRefreshToken(email, refreshToken);

    return { accessToken, refreshToken };
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

  async saveRefreshToken(email: string, refreshToken: string): Promise<void> {
    // Implement database storage (e.g., MongoDB)
    // Example: await this.adminRepository.saveRefreshToken(email, refreshToken);
    console.log(`Saving refresh token for ${email}: ${refreshToken}`);
  }

  async invalidateRefreshToken(email: string, refreshToken: string): Promise<void> {
    // Implement database invalidation (e.g., MongoDB)
    // Example: await this.adminRepository.invalidateRefreshToken(email, refreshToken);
    console.log(`Invalidating refresh token for ${email}: ${refreshToken}`);
  }
}