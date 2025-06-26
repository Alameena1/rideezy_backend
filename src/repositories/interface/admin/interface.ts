import { IUser } from "../../../models/user.model";
import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";

export interface IAdminRepository {
  getAllUsers(): Promise<any[]>;
  updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void>;
  getAllVehicles(): Promise<any[]>;
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
  getAllRides(): Promise<any[]>;
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