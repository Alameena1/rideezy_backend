import { injectable, inject } from "inversify";
import { IAdminService } from "../interfaces/admin/interface";
import { IAdminRepository } from "../../repositories/interface/admin/interface";
import { generateAccessToken, generateRefreshToken } from "../../helpers/jwt.util";
import { TYPES } from "../../di/types";
import bcrypt from "bcrypt";
import { IUser } from "../../models/user.model";
import { ISubscriptionPlan } from "../../models/SubscriptionPlan";
import AdminModel, { IAdmin } from "../../models/admin";

@injectable()
export class AdminService implements IAdminService {
  private adminRepository: IAdminRepository;
  private refreshTokens: Map<string, string> = new Map();

  constructor(@inject(TYPES.IAdminRepository) adminRepository: IAdminRepository) {
    this.adminRepository = adminRepository;
  }

  async authenticateAdmin(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    console.log("Authenticating admin with email:", email, "and password:", password);
    if (!email || !password) {
      console.log("Missing email or password");
      throw new Error("Email and password are required");
    }

    try {
      const admin = await AdminModel.findOne({ email }).exec();
      console.log("Found admin:", admin);
      if (!admin) {
        console.log("Admin not found for email:", email);
        throw new Error("Invalid email or password");
      }

      if (!admin.password) {
        console.log("No password set for admin:", email);
        throw new Error("Invalid email or password");
      }

      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (!passwordMatch) {
        console.log("Password does not match for email:", email);
        throw new Error("Invalid email or password");
      }

      const accessToken = generateAccessToken(admin._id.toString(), admin.email, "admin");
      const refreshToken = generateRefreshToken(admin._id.toString(), "admin");

      await this.saveRefreshToken(admin._id.toString(), refreshToken);

      return { accessToken, refreshToken };
    } catch (error: any) {
      console.error("Error in authenticateAdmin:", error.message, error.stack);
      throw new Error("Server error");
    }
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    this.refreshTokens.set(refreshToken, userId);
    console.log(`Saved refresh token for userId ${userId}`);
  }

  async invalidateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    if (this.refreshTokens.has(refreshToken)) {
      this.refreshTokens.delete(refreshToken);
      console.log(`Invalidated refresh token for userId ${userId}`);
    }
  }

  async getAllUsers(): Promise<any[]> {
    return this.adminRepository.getAllUsers();
  }

  async updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    await this.adminRepository.updateUserStatus(userId, status);
  }

  async getAllVehicles(): Promise<any[]> {
    return this.adminRepository.getAllVehicles();
  }

  async updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void> {
    console.log("from service checking vehicle rejection note", note);
    await this.adminRepository.updateVehicleStatus(vehicleId, status, note);
  }

  async verifyGovId(userId: string, status: "Verified" | "Rejected", rejectionNote?: string): Promise<IUser> {
    console.log("verifying gov ID", rejectionNote);
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
        reason: rejectionNote ?? "",
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

  async getRideDetails(rideId: string): Promise<any> {
    return await this.adminRepository.getRideDetails(rideId);
  }

  async updateRideStatus(rideId: string, status: "Active" | "Blocked" | "Cancelled"): Promise<void> {
    await this.adminRepository.updateRideStatus(rideId, status);
  }

  async getAllRides(): Promise<any[]> {
    return this.adminRepository.getAllRides();
  }

  async getDashboardMetrics(params: { startDate?: Date; endDate?: Date }): Promise<{
    metrics: {
      totalUsers: number;
      subscribedUsers: number;
      nonSubscribedUsers: number;
      totalRides: number;
      totalRevenue: number;
    };
    userGrowth: { month: string; users: number }[];
    rideCount: { month: string; rides: number }[];
    revenueDistribution: { name: string; value: number }[];
  }> {
    console.log("Fetching dashboard metrics in AdminService");
    return await this.adminRepository.getDashboardMetrics(params);
  }
}
