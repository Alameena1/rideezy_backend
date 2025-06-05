import { injectable } from "inversify";
import UserModel, { IUser } from "../../models/user.model";
import VehicleModel from "../../models/vehicle.modal";
import { IAdminRepository } from "../interface/admin/interface";
import { BaseRepository } from "../base/base.repository";
import { SubscriptionPlanModel, ISubscriptionPlan } from "../../models/SubscriptionPlan";
import {RideModel} from "../../models/ride.model";

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
      const vehicles = await VehicleModel.find();
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
}

export default AdminRepository;