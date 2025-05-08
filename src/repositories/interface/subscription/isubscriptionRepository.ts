import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";
import { IUser } from "../../../models/user.model";

export interface ISubscriptionRepository {
  getAllPlans(): Promise<ISubscriptionPlan[]>;
  findPlanById(planId: string): Promise<ISubscriptionPlan | null>;
  findUserById(userId: string): Promise<IUser | null>;
  updateUser(userId: string, userData: Partial<IUser>): Promise<IUser>;
  getUserRideCount(userId: string, month: number, year: number): Promise<number>;
}