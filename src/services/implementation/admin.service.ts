// src/services/implementation/admin.service.ts
import { IAdminService } from "../interfaces/admin/interface";
import { IAdminRepository } from "../../repositories/interface/admin/interface";
import { generateAccessToken, generateRefreshToken } from "../../helpers/jwt.util";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import bcrypt from "bcrypt";
import { IUser } from "../../models/user.model";
import { ISubscriptionPlan } from "../../models/SubscriptionPlan";

@injectable()
export class AdminService implements IAdminService {
  private adminRepository: IAdminRepository;
  private ADMIN_EMAIL: string = "alameena8841@gmail.com";
  private ADMIN_PASSWORD_HASH!: string;
  private refreshTokens: Map<string, string> = new Map();

  constructor(@inject(TYPES.IAdminRepository) adminRepository: IAdminRepository) {
    this.adminRepository = adminRepository;
    this.initializeAdminCredentials();
  }

  private async initializeAdminCredentials() {
    try {
      const plainPassword = "Al@12345";
      this.ADMIN_PASSWORD_HASH = await bcrypt.hash(plainPassword, 10);
      console.log("Admin credentials initialized:", {
        email: this.ADMIN_EMAIL,
        passwordHash: this.ADMIN_PASSWORD_HASH,
      });
    } catch (error) {
      console.error("Error initializing admin credentials:", error);
      throw new Error("Failed to initialize admin credentials");
    }
  }

  async authenticateAdmin(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    try {
      if (email.trim().toLowerCase() !== this.ADMIN_EMAIL.trim().toLowerCase()) {
        console.log("Email does not match admin email:", email, this.ADMIN_EMAIL);
        throw new Error("Invalid credentials");
      }

      const passwordMatch = await bcrypt.compare(password, this.ADMIN_PASSWORD_HASH);
      if (!passwordMatch) {
        console.log("Password does not match");
        throw new Error("Invalid credentials");
      }

      console.log("Generating access token for email:", email);
      const accessToken = generateAccessToken(email, email);
      const refreshToken = generateRefreshToken(email);
      console.log("Generated access token:", accessToken);

      await this.saveRefreshToken(email, refreshToken);

      return { accessToken, refreshToken };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error in authenticateAdmin:", error.message, error.stack);
        throw error;
      }
      console.error("Non-Error thrown in authenticateAdmin:", error);
      throw new Error("Unknown authentication error");
    }
  }

  async saveRefreshToken(email: string, refreshToken: string): Promise<void> {
    this.refreshTokens.set(refreshToken, email);
    console.log(`Saved refresh token for ${email}: ${refreshToken}`);
  }

  async invalidateRefreshToken(email: string, refreshToken: string): Promise<void> {
    if (this.refreshTokens.has(refreshToken)) {
      this.refreshTokens.delete(refreshToken);
      console.log(`Invalidated refresh token for ${email}: ${refreshToken}`);
    } else {
      console.log(`Refresh token not found for ${email}: ${refreshToken}`);
    }
  }

  async getAllUsers(): Promise<any[]> {
    return this.adminRepository.getAllUsers();
  }

  async updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    await this.adminRepository.updateUserStatus(userId, status); // Renamed to match IAdminRepository
  }

  async getAllVehicles(): Promise<any[]> {
    return this.adminRepository.getAllVehicles();
  }

  async updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void> {
    await this.adminRepository.updateVehicleStatus(vehicleId, status, note);
  }

  async verifyGovId(userId: string, status: "Verified" | "Rejected"): Promise<IUser> {
    const user = await this.adminRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.govId) {
      throw new Error("Government ID not submitted by user");
    }

    const updatedUser = await this.adminRepository.updateUser(userId, {
      govId: {
        ...user.govId,
        verificationStatus: status,
      },
    });

    if (!updatedUser) {
      throw new Error("Failed to update government ID status");
    }

    return updatedUser;
  }
  async createSubscriptionPlan(planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    return await this.adminRepository.createSubscriptionPlan(planData);
  }

  async updateSubscriptionPlan(planId: string, planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    return await this.adminRepository.updateSubscriptionPlan(planId, planData);
  }

  async deleteSubscriptionPlan(planId: string): Promise<void> {
    await this.adminRepository.deleteSubscriptionPlan(planId);
  }

  async getSubscriptionPlans(): Promise<ISubscriptionPlan[]> {
    return await this.adminRepository.getSubscriptionPlans();
  }

  async updateSubscriptionPlanStatus(planId: string, status: "Active" | "Blocked"): Promise<void> {
    await this.adminRepository.updateSubscriptionPlanStatus(planId, status);
  }
}

export default AdminService;