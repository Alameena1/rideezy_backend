import { injectable } from "inversify";
import UserModel, { IUser } from "../../models/user.model";
import VehicleModel from "../../models/vehicle.modal";
import { IAdminRepository } from "../interface/admin/interface";
import { BaseRepository } from "../base/base.repository";
import { SubscriptionPlanModel, ISubscriptionPlan } from "../../models/SubscriptionPlan";
import { RideModel } from "../../models/ride.model";

@injectable()
export class AdminRepository extends BaseRepository<any> implements IAdminRepository {
  constructor() {
    super(UserModel);
  }

  public async getAllUsers(): Promise<any[]> {
    try {
      const users = await this.model.find().select("-password");
      return users;
    } catch (error) {
      throw new Error("Failed to fetch users from the database");
    }
  }

  public async updateUserStatus(userId: string, status: "Active" | "Blocked"): Promise<void> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      await this.updateById(userId, { status } as any);
    } catch (error) {
      throw new Error("Failed to update user status");
    }
  }

  public async getAllVehicles(): Promise<any[]> {
  try {
    const vehicles = await VehicleModel.find().populate({
      path: 'user',
      select: 'fullName' // Only include the fields you need
    });
    return vehicles;
  } catch (error) {
    throw new Error("Failed to fetch vehicles from the database");
  }
}

  public async updateVehicleStatus(vehicleId: string, status: "Approved" | "Rejected", note?: string): Promise<void> {
    try {
      const vehicle = await VehicleModel.findById(vehicleId);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }
      await VehicleModel.findByIdAndUpdate(vehicleId, { status, note }, { new: true });
    } catch (error) {
      throw new Error("Failed to update vehicle status");
    }
  }

  public async findUserById(userId: string): Promise<IUser | null> {
    try {
      const user = await UserModel.findById(userId).select("-password").lean().exec();
      return user;
    } catch (error) {
      throw new Error(`Failed to find user: ${(error as Error).message}`);
    }
  }

  public async updateUser(userId: string, updatedData: Partial<IUser>): Promise<IUser | null> {
    try {
      const updatedUser = await UserModel.findByIdAndUpdate(userId, updatedData, { new: true })
        .select("-password")
        .lean()
        .exec();
      return updatedUser;
    } catch (error) {
      throw new Error(`Failed to update user: ${(error as Error).message}`);
    }
  }

  async createSubscriptionPlan(planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    try {
      const plan = await SubscriptionPlanModel.create(planData);
      return plan;
    } catch (error) {
      throw new Error(`Failed to create subscription plan: ${(error as Error).message}`);
    }
  }

  async updateSubscriptionPlan(planId: string, planData: Partial<ISubscriptionPlan>): Promise<ISubscriptionPlan> {
    try {
      const plan = await SubscriptionPlanModel.findByIdAndUpdate(planId, planData, { new: true });
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
      return plan;
    } catch (error) {
      throw new Error(`Failed to update subscription plan: ${(error as Error).message}`);
    }
  }

  async deleteSubscriptionPlan(planId: string): Promise<void> {
    try {
      const plan = await SubscriptionPlanModel.findByIdAndDelete(planId);
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
    } catch (error) {
      throw new Error(`Failed to delete subscription plan: ${(error as Error).message}`);
    }
  }

  async getSubscriptionPlans(): Promise<ISubscriptionPlan[]> {
    try {
      return await SubscriptionPlanModel.find().exec();
    } catch (error) {
      throw new Error(`Failed to fetch subscription plans: ${(error as Error).message}`);
    }
  }

  async updateSubscriptionPlanStatus(planId: string, status: "Active" | "Blocked"): Promise<void> {
    try {
      const plan = await SubscriptionPlanModel.findByIdAndUpdate(planId, { status }, { new: true });
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
    } catch (error) {
      throw new Error(`Failed to update subscription plan status: ${(error as Error).message}`);
    }
  }

  async getRideDetails(rideId: string): Promise<any> {
    try {
      const ride = await RideModel.findById(rideId).lean().exec();
      if (!ride) {
        throw new Error("Ride not found");
      }
      return ride;
    } catch (error) {
      throw new Error(`Failed to fetch ride details: ${(error as Error).message}`);
    }
  }

  async updateRideStatus(rideId: string, status: "Active" | "Blocked" | "Cancelled"): Promise<void> {
    try {
      const ride = await RideModel.findById(rideId);
      if (!ride) {
        throw new Error("Ride not found");
      }
      await RideModel.findByIdAndUpdate(rideId, { status }, { new: true });
    } catch (error) {
      throw new Error(`Failed to update ride status: ${(error as Error).message}`);
    }
  }

  async getAllRides(): Promise<any[]> {
    try {
      const rides = await RideModel.find().lean().exec();
      return rides;
    } catch (error) {
      throw new Error(`Failed to fetch rides: ${(error as Error).message}`);
    }
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
    console.log("Fetching dashboard metrics in AdminRepository");
    try {
      const { startDate, endDate } = params;
      const currentDate = new Date();
      const dateFilter = startDate && endDate ? { $gte: startDate, $lte: endDate } : {
        $gte: new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1),
        $lte: currentDate,
      };

      // Metrics
      const totalUsers = await UserModel.countDocuments();
      console.log("Total users:", totalUsers);
      const subscribedUsers = await UserModel.countDocuments({
        "subscription.endDate": { $gt: currentDate },
      });
      const nonSubscribedUsers = totalUsers - subscribedUsers;
      const totalRides = await RideModel.countDocuments({ status: "COMPLETED" });

      // Aggregate subscription revenue from wallet.transactions
      const subscriptionRevenueResult = await UserModel.aggregate([
        { $unwind: "$wallet.transactions" },
        {
          $match: {
            "wallet.transactions.type": "SUBSCRIPTION",
            "wallet.transactions.status": "COMPLETED",
            "wallet.transactions.createdAt": dateFilter,
          },
        },
        { $group: { _id: null, total: { $sum: "$wallet.transactions.amount" } } },
      ]);
      const subscriptionRevenue = subscriptionRevenueResult[0]?.total || 0;

      // Aggregate platform fee revenue from wallet.transactions (WITHDRAWAL for non-subscribed users)
      const platformFeeTransactionResult = await UserModel.aggregate([
        { $unwind: "$wallet.transactions" },
        {
          $match: {
            "wallet.transactions.type": "WITHDRAWAL",
            "wallet.transactions.status": "COMPLETED",
            "wallet.transactions.createdAt": dateFilter,
          },
        },
        { $group: { _id: null, total: { $sum: "$wallet.transactions.amount" } } },
      ]);
      const platformFeeFromTransactions = platformFeeTransactionResult[0]?.total || 0;

      // Aggregate platform fee from completed rides (for consistency, if needed)
      const platformFeeRideResult = await RideModel.aggregate([
        { $match: { status: "COMPLETED", date: dateFilter } },
        { $group: { _id: null, total: { $sum: "$platformFee" } } },
      ]);
      const platformFeeFromRides = platformFeeRideResult[0]?.total || 0;

      // Combine platform fees from transactions and rides (avoid double-counting if needed)
      const totalPlatformFee = platformFeeFromTransactions + platformFeeFromRides;
      const totalRevenue = subscriptionRevenue + totalPlatformFee;

      // User Growth
      const userGrowth = await UserModel.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: "%b", date: "$createdAt" } },
            users: { $sum: 1 },
          },
        },
        { $sort: { "_id": 1 } },
        { $project: { month: "$_id", users: 1, _id: 0 } },
      ]);

      // Ride Count
      const rideCount = await RideModel.aggregate([
        { $match: { status: "COMPLETED", date: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: "%b", date: "$date" } },
            rides: { $sum: 1 },
          },
        },
        { $sort: { "_id": 1 } },
        { $project: { month: "$_id", rides: 1, _id: 0 } },
      ]);

      // Revenue Distribution
      const revenueDistribution = [
        { name: "Subscription", value: subscriptionRevenue },
        { name: "Platform Fee", value: totalPlatformFee },
      ];

      return {
        metrics: {
          totalUsers,
          subscribedUsers,
          nonSubscribedUsers,
          totalRides,
          totalRevenue,
        },
        userGrowth,
        rideCount,
        revenueDistribution,
      };
    } catch (error) {
      console.error("Error in getDashboardMetrics:", (error as Error).message);
      throw new Error(`Failed to fetch dashboard metrics: ${(error as Error).message}`);
    }
  }
}

export default AdminRepository;