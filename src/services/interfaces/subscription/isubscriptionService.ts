import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";
import { IUser } from "../../../models/user.model";

export interface ISubscriptionService {
  getAllPlans(): Promise<ISubscriptionPlan[]>;
  subscribeUser(userId: string, planId: string): Promise<IUser>;
  isSubscribed(userId: string): Promise<boolean>;
  canBookRide(userId: string): Promise<boolean>;
  canRegisterVehicle(userId: string): Promise<boolean>;
}