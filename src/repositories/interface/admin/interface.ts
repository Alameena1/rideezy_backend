import { IUser } from "../../../models/user.model";
import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";
import { PaginationQueryDtoType, RideSearchQueryDtoType, UserSearchQueryDtoType, VehicleSearchQueryDtoType } from "../../../dtos/admin.dto";

export interface IAdminRepository {
  // Updated methods with pagination and search
 getAllUsers(params: UserSearchQueryDtoType): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
  
  getAllVehicles(params: VehicleSearchQueryDtoType): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
  
  getAllRides(params: RideSearchQueryDtoType): Promise<{
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
  

  
  updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void>;
  findUserById(userId: string): Promise<IUser | null>;
  updateUser(userId: string, updatedData: Partial<IUser>): Promise<IUser | null>;
  createSubscriptionPlan(planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan>;
  updateSubscriptionPlan(planId: string, planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan>;
  deleteSubscriptionPlan(planId: string): Promise<void>;
  getSubscriptionPlans(): Promise<ISubscriptionPlan[]>;
  updateSubscriptionPlanStatus(planId: string, status: "Active" | "Blocked"): Promise<void>;
  getRideDetails(rideId: string): Promise<any>;
  

  
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