import { injectable, inject } from "inversify";
import { IAdminService } from "../interfaces/admin/interface";
import { IAdminRepository } from "../../repositories/interface/admin/interface";
import { generateAccessToken, generateRefreshToken } from "../../helpers/jwt.util";
import { TYPES } from "../../di/types";
import bcrypt from "bcrypt";
import { IUser } from "../../models/user.model";
import { ISubscriptionPlan } from "../../models/SubscriptionPlan";
import AdminModel, { IAdmin } from "../../models/admin";
import { SubscriptionPlanModel } from "../../models/SubscriptionPlan";
import { PaginationQueryDtoType, RideSearchQueryDtoType, UserSearchQueryDtoType, VehicleSearchQueryDtoType, BlockRideDtoType, UserResponseDto, UserResponseDtoType } from "../../dtos/admin.dto";
import { DashboardMetrics, DashboardParams } from "../../types/dashboard";

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
    adminId: string;
  }> {
    console.log("🔐 Authenticating admin with email:", email);
    
    if (!email || !password) {
      console.log("❌ Missing email or password");
      throw new Error("Email and password are required");
    }

    try {
      const admin = await AdminModel.findOne({ email }).exec();
      console.log("📋 Found admin:", admin ? "Yes" : "No");
      
      if (!admin) {
        console.log("❌ Admin not found for email:", email);
        throw new Error("Invalid email or password");
      }

      if (!admin.password) {
        console.log("❌ No password set for admin:", email);
        throw new Error("Invalid email or password");
      }

      console.log("🔑 Comparing passwords...");
      const passwordMatch = await bcrypt.compare(password, admin.password);
      
      if (!passwordMatch) {
        console.log("❌ Password does not match for email:", email);
        throw new Error("Invalid email or password");
      }

      console.log("✅ Password matched, generating tokens...");
      const accessToken = generateAccessToken(admin._id.toString(), admin.email, "admin");
      const refreshToken = generateRefreshToken(admin._id.toString(), "admin");

      await this.saveRefreshToken(admin._id.toString(), refreshToken);

      console.log("🎉 Admin authentication successful");
      
      return { 
        accessToken, 
        refreshToken,
        adminId: admin._id.toString()
      };
    } catch (error: any) {
      console.error("💥 Error in authenticateAdmin:", error.message, error.stack);
      throw new Error("Server error");
    }
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    this.refreshTokens.set(refreshToken, userId);
    console.log(`💾 Saved refresh token for userId ${userId}`);
  }

  async invalidateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    if (this.refreshTokens.has(refreshToken)) {
      this.refreshTokens.delete(refreshToken);
      console.log(`🗑️ Invalidated refresh token for userId ${userId}`);
    }
  }


async getAllUsers(params: UserSearchQueryDtoType): Promise<{
  data: UserResponseDtoType[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean; 
    hasPrev: boolean;
  };
}> {
  const result = await this.adminRepository.getAllUsers(params);
  
  // Use safeParse for more lenient validation
  const validatedData = result.data.map(user => {
    const validation = UserResponseDto.safeParse(user);
    if (validation.success) {
      return validation.data;
    } else {
      console.warn('User validation warning:', validation.error.errors);
      // Manual transformation for problematic fields
      return {
        ...user,
        subscription: user.subscription ? {
          ...user.subscription,
          planId: user.subscription.planId?.toString() || user.subscription.planId
        } : undefined,
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
        updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt
      } as UserResponseDtoType;
    }
  });

  return {
    data: validatedData,
    pagination: result.pagination
  };
}

  async getAllVehicles(params: VehicleSearchQueryDtoType): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.adminRepository.getAllVehicles(params);
  }

  async getAllRides(params: RideSearchQueryDtoType): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.adminRepository.getAllRides(params);
  }

  async updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    // Prevent blocking if user has ongoing rides
    if (status === "Blocked") {
      const ongoingRides = await this.adminRepository.checkUserOngoingRides(userId);
      if (ongoingRides.hasOngoingRides) {
        throw new Error(
          `Cannot block user. User has ${ongoingRides.ongoingRides.length} ongoing ride(s). ` +
          `Please wait until all rides are completed.`
        );
      }
    }
    
    await this.adminRepository.updateUserStatus(userId, status);
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

  async checkUserOngoingRides(userId: string): Promise<{
    length: number;
    hasOngoingRides: boolean;
    ongoingRides: any[];
    message: string;
  }> {
    try {
      console.log(`🔍 Checking ongoing rides for user: ${userId}`);
      const result = await this.adminRepository.checkUserOngoingRides(userId);
      console.log(`📊 Ongoing rides check result:`, result);
      
      // Add the length property based on the ongoingRides array length
      return {
        ...result,
        length: result.ongoingRides?.length || 0
      };
    } catch (error) {
      console.error("❌ Error checking ongoing rides:", error);
      throw new Error(`Failed to check user's ongoing rides: ${(error as Error).message}`);
    }
  }

  async createSubscriptionPlan(planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    if (planData.maxStartingRides === undefined || planData.maxJoiningRides === undefined) {
      throw new Error("maxStartingRides and maxJoiningRides are required");
    }
    if (planData.durationMonths === undefined || planData.durationMonths <= 0) {
      throw new Error("Duration must be at least 1 month");
    }
    if (planData.price === undefined || planData.price < 0) {
      throw new Error("Price cannot be negative");
    }
    if (planData.maxStartingRides < 0) {
      throw new Error("Max starting rides cannot be negative");
    }
    if (planData.maxJoiningRides < 0) {
      throw new Error("Max joining rides cannot be negative");
    }
    if (planData.durationMonths > 120) {
      throw new Error("Duration cannot exceed 10 years (120 months)");
    }
    if (planData.price > 10000) {
      throw new Error("Price cannot exceed $10,000");
    }
    if (planData.maxStartingRides > 1000) {
      throw new Error("Max starting rides cannot exceed 1000");
    }
    if (planData.maxJoiningRides > 1000) {
      throw new Error("Max joining rides cannot exceed 1000");
    }
    return await SubscriptionPlanModel.create(planData);
  }

  async updateSubscriptionPlan(planId: string, planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    if (planData.durationMonths !== undefined && planData.durationMonths <= 0) {
      throw new Error("Duration must be at least 1 month");
    }
    if (planData.price !== undefined && planData.price < 0) {
      throw new Error("Price cannot be negative");
    }
    if (planData.maxStartingRides !== undefined && planData.maxStartingRides < 0) {
      throw new Error("Max starting rides cannot be negative");
    }
    if (planData.maxJoiningRides !== undefined && planData.maxJoiningRides < 0) {
      throw new Error("Max joining rides cannot be negative");
    }
    if (planData.durationMonths !== undefined && planData.durationMonths > 120) {
      throw new Error("Duration cannot exceed 10 years (120 months)");
    }
    if (planData.price !== undefined && planData.price > 10000) {
      throw new Error("Price cannot exceed $10,000");
    }
    if (planData.maxStartingRides !== undefined && planData.maxStartingRides > 1000) {
      throw new Error("Max starting rides cannot exceed 1000");
    }
    if (planData.maxJoiningRides !== undefined && planData.maxJoiningRides > 1000) {
      throw new Error("Max joining rides cannot exceed 1000");
    }
    const updatedPlan = await SubscriptionPlanModel.findByIdAndUpdate(planId, planData, { new: true });
    if (!updatedPlan) {
      throw new Error("Subscription plan not found");
    }
    return updatedPlan;
  }

  async deleteSubscriptionPlan(planId: string): Promise<void> {
    const plan = await SubscriptionPlanModel.findById(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }
    await SubscriptionPlanModel.updateOne({ _id: planId }, { isDeleted: true });
  }

async getSubscriptionPlans(): Promise<ISubscriptionPlan[]>;
async getSubscriptionPlans(params: UserSearchQueryDtoType): Promise<{
  data: ISubscriptionPlan[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}>;
async getSubscriptionPlans(params?: UserSearchQueryDtoType): Promise<any> {
  if (!params) {
    // Return all plans without pagination (for backward compatibility)
    return await SubscriptionPlanModel.find({ isDeleted: false }).exec();
  } else {
    // Return paginated results with search and filters
    return this.adminRepository.getSubscriptionPlansWithPagination(params);
  }
}
  async updateSubscriptionPlanStatus(planId: string, status: "Active" | "Blocked"): Promise<void> {
    const plan = await SubscriptionPlanModel.findById(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }
    if (plan.isDeleted) {
      throw new Error("Cannot update status of deleted plan");
    }
    await SubscriptionPlanModel.updateOne({ _id: planId }, { status });
  }

  async getRideDetails(rideId: string): Promise<any> {
    return await this.adminRepository.getRideDetails(rideId);
  }

  // UPDATED: Use correct ride status types including Blocked
  async updateRideStatus(rideId: string, status: "Pending" | "Started" | "Completed" | "Cancelled" | "EmergencyStopped" | "Blocked"): Promise<void> {
    await this.adminRepository.updateRideStatus(rideId, status);
  }

  // NEW: Block ride with detailed information
  async blockRide(rideId: string, blockData: BlockRideDtoType, adminId: string): Promise<void> {
    console.log(`🚫 Admin ${adminId} attempting to block ride ${rideId}`, blockData);
    
    // Validate block data
    if (!blockData.reason || !blockData.blockType) {
      throw new Error("Block reason and type are required");
    }

    // Get ride details to check current status
    const ride = await this.adminRepository.getRideDetails(rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    // Additional validation: Only allow blocking of Pending or Started rides
    if (!["Pending", "Started"].includes(ride.status)) {
      throw new Error(`Cannot block a ride with status: ${ride.status}. Only Pending or Started rides can be blocked.`);
    }

    await this.adminRepository.blockRide(rideId, {
      ...blockData,
      blockedBy: adminId
    });

    console.log(`✅ Ride ${rideId} successfully blocked by admin ${adminId}`);
  }

  // NEW: Unblock ride
  async unblockRide(rideId: string): Promise<void> {
    console.log(`🔄 Attempting to unblock ride ${rideId}`);
    
    // Get ride details to check current status
    const ride = await this.adminRepository.getRideDetails(rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (ride.status !== "Blocked") {
      throw new Error("Ride is not blocked");
    }

    await this.adminRepository.unblockRide(rideId);
    
    console.log(`✅ Ride ${rideId} successfully unblocked`);
  }

  async getDashboardMetrics(params: DashboardParams): Promise<DashboardMetrics> {
    console.log("Fetching dashboard metrics with time range:", params.timeRange);
    
    // Calculate date range based on timeRange
    let startDate = params.startDate;
    const endDate = params.endDate || new Date();
    
    if (!startDate && params.timeRange) {
      startDate = new Date();
      switch (params.timeRange) {
        case "7days":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30days":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90days":
          startDate.setDate(startDate.getDate() - 90);
          break;
        case "1year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case "all":
          startDate = new Date(0); // Beginning of time
          break;
      }
    }

    return await this.adminRepository.getDashboardMetrics({
      startDate,
      endDate,
      timeRange: params.timeRange
    });
  }
}