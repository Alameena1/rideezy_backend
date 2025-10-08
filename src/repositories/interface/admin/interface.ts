import { IUser } from "../../../models/user.model";
import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";
import {
  PaginationQueryDtoType,
  RideSearchQueryDtoType,
  UserSearchQueryDtoType,
  VehicleSearchQueryDtoType,
} from "../../../dtos/admin.dto";
import { DashboardMetrics, DashboardParams } from "../../../types/dashboard";

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

  // UPDATED: Use correct ride status types including Blocked
  getAllRides(params: RideSearchQueryDtoType & { 
    status?: "Pending" | "Started" | "Completed" | "Cancelled" | "EmergencyStopped" | "Blocked";
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

  updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
  updateVehicleStatus(
    vehicleId: string,
    status: "Approved" | "Rejected",
    note?: string
  ): Promise<void>;
  findUserById(userId: string): Promise<IUser | null>;
  updateUser(
    userId: string,
    updatedData: Partial<IUser>
  ): Promise<IUser | null>;

  // New method for checking ongoing rides
  checkUserOngoingRides(userId: string): Promise<{
    hasOngoingRides: boolean;
    ongoingRides: any[];
    message: string;
  }>;

  createSubscriptionPlan(
    planData: Partial<ISubscriptionPlan>
  ): Promise<ISubscriptionPlan>;
  updateSubscriptionPlan(
    planId: string,
    planData: Partial<ISubscriptionPlan>
  ): Promise<ISubscriptionPlan>;
  deleteSubscriptionPlan(planId: string): Promise<void>;
  getSubscriptionPlans(): Promise<ISubscriptionPlan[]>;
  updateSubscriptionPlanStatus(
    planId: string,
    status: "Active" | "Blocked"
  ): Promise<void>;
  getRideDetails(rideId: string): Promise<any>;
  
  // UPDATED: Use correct ride status types including Blocked
  updateRideStatus(
    rideId: string,
    status: "Pending" | "Started" | "Completed" | "Cancelled" | "EmergencyStopped" | "Blocked"
  ): Promise<void>;

  // NEW: Specific methods for blocking/unblocking rides
  blockRide(
    rideId: string, 
    blockData: { reason: string; blockType: string; duration?: string; blockedBy: string }
  ): Promise<void>;
  
  unblockRide(rideId: string): Promise<void>;

  getDashboardMetrics(params: DashboardParams): Promise<DashboardMetrics>;

  getSubscriptionPlansWithPagination(params: PaginationQueryDtoType): Promise<{
    data: ISubscriptionPlan[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
}