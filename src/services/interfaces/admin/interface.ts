import { IUser } from "../../../models/user.model";
import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";
import { PaginationQueryDtoType, RideSearchQueryDtoType, UserSearchQueryDtoType, VehicleSearchQueryDtoType } from "../../../dtos/admin.dto";

export interface IAdminService {
  authenticateAdmin(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    adminId: string;
  }>;
  saveRefreshToken(email: string, refreshToken: string): Promise<void>;
  invalidateRefreshToken(email: string, refreshToken: string): Promise<void>;
  
  // Updated methods with pagination and search
  getAllUsers(params: UserSearchQueryDtoType & { 
    status?: "Active" | "Blocked"; 
    subscriptionStatus?: "subscribed" | "non-subscribed";
  }): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
  
  updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
  
  getAllVehicles(params: VehicleSearchQueryDtoType & { 
    status?: "Pending" | "Approved" | "Rejected";
    vehicleType?: string;
  }): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
  
  updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void>;
  verifyGovId(userId: string, status: "Verified" | "Rejected", rejectionNote?: string): Promise<IUser>;
  
  // Updated method for checking ongoing rides
  checkUserOngoingRides(userId: string): Promise<{
    length: number;
    hasOngoingRides: boolean;
    ongoingRides: any[];
    message: string;
  }>;
  
  createSubscriptionPlan(planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan>;
  updateSubscriptionPlan(planId: string, planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan>;
  deleteSubscriptionPlan(planId: string): Promise<void>;
  getSubscriptionPlans(): Promise<ISubscriptionPlan[]>;
  updateSubscriptionPlanStatus(planId: string, status: "Active" | "Blocked"): Promise<void>;
  
  getRideDetails(rideId: string): Promise<any>;
  
  getAllRides(params: RideSearchQueryDtoType & { 
    status?: "Active" | "Completed" | "Cancelled" | "Blocked";
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
  
  updateRideStatus(rideId: string, status: "Active" | "Blocked" | "Cancelled"): Promise<void>;
  
  getDashboardMetrics(params: { startDate?: Date; endDate?: Date }): Promise<{
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
  }>;
}