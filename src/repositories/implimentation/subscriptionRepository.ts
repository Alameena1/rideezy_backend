import { injectable } from "inversify";
import { ISubscriptionRepository } from "../interface/subscription/isubscriptionRepository";
import { SubscriptionPlanModel, ISubscriptionPlan } from "../../models/SubscriptionPlan";
import UserModel from "../../models/user.model";
import { IUser } from "../../models/user.model";
import { RideModel } from "../../models/ride.model";

@injectable()
export class SubscriptionRepository implements ISubscriptionRepository {
  async getAllPlans(): Promise<ISubscriptionPlan[]> {
    return await SubscriptionPlanModel.find().exec();
  }

  async findPlanById(planId: string): Promise<ISubscriptionPlan | null> {
    return await SubscriptionPlanModel.findById(planId).exec();
  }

  async findUserById(userId: string): Promise<IUser | null> {
    return await UserModel.findById(userId).exec();
  }

  async updateUser(userId: string, userData: Partial<IUser>): Promise<IUser> {
    const user = await UserModel.findByIdAndUpdate(userId, userData, { new: true }).exec();
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async getUserRideCount(userId: string, month: number, year: number): Promise<number> {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    return await RideModel.countDocuments({
      driverId: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).exec();
  }
}