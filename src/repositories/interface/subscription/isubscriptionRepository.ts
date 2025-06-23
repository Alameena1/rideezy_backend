import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";
import { IUser } from "../../../models/user.model";

export interface UserUpdate { 
  $inc?: { [key: string]: number };
  $push?: { [key: string]: any };
  $set?: Partial<IUser>;
}

export interface ISubscriptionRepository {
  getAllPlans(): Promise<ISubscriptionPlan[]>;
  findPlanById(planId: string): Promise<ISubscriptionPlan | null>;
  findUserById(userId: string): Promise<IUser | null>;
  updateUser(userId: string, userData: UserUpdate): Promise<IUser>;
  getUserRideCount(userId: string, month: number, year: number): Promise<number>;
}