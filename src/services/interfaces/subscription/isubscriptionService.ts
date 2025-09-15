import { Request, Response } from "express";
import { ISubscriptionPlan } from "../../../models/SubscriptionPlan";

export interface ISubscriptionService {
  // Existing methods
  getAllPlans(): Promise<any[]>;
  subscribeUser(userId: string, planId: string): Promise<any>;
  isSubscribed(userId: string): Promise<{ isSubscribed: boolean; subscription?: any }>;
  canRegisterVehicle(userId: string): Promise<boolean>;
  canBookRide(userId: string): Promise<boolean>;
  createPaymentOrder(planId: string): Promise<any>;
  verifyAndSubscribe(userId: string, planId: string, paymentId: string, orderId: string, signature: string): Promise<any>;

  // NEW METHODS for ride limits (14 total methods)
  canStartRide(userId: string): Promise<boolean>;
  canJoinRide(userId: string): Promise<boolean>;
  getRemainingRideCounts(userId: string): Promise<{ startRides: number; joinRides: number }>;
  decrementStartRideCount(userId: string): Promise<void>;
  decrementJoinRideCount(userId: string): Promise<void>;
  getSubscriptionPlan(userId: string): Promise<ISubscriptionPlan | null>;
  hasActiveSubscription(userId: string): Promise<boolean>;
  getMonthlyRideCounts(userId: string): Promise<{ startCount: number; joinCount: number }>;
  resetSubscriptionRideCounts(userId: string): Promise<void>;
}