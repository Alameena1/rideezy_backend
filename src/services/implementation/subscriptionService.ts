import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { ISubscriptionRepository, UserUpdate } from "../../repositories/interface/subscription/isubscriptionRepository";
import { IWalletService } from "../interfaces/wallet/iWalletService";
import { IRideRepository } from "../../repositories/interface/ride/irideRepository";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import Razorpay from "razorpay";
import { createHmac } from "crypto";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { SubscriptionPlanModel, ISubscriptionPlan } from "../../models/SubscriptionPlan";

@injectable()
export class SubscriptionService implements ISubscriptionService {
  constructor(
    @inject(TYPES.ISubscriptionRepository) private subscriptionRepository: ISubscriptionRepository,
    @inject(TYPES.IWalletService) private walletService: IWalletService,
    @inject(TYPES.IRideRepository) private rideRepo: IRideRepository,
    @inject(TYPES.IUserRepository) private userRepo: IUserRepository,
    @inject("Razorpay") private razorpay: Razorpay
  ) {}

  // EXISTING METHODS
  async getAllPlans(): Promise<any[]> {
    return await SubscriptionPlanModel.find({ status: "Active", isDeleted: false });
  }

  async subscribeUser(userId: string, planId: string): Promise<any> {
    const plan = await SubscriptionPlanModel.findById(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }
    if (plan.isDeleted) {
      throw new Error("Subscription plan is deleted");
    }

    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    const subscriptionData = {
      planId: new Types.ObjectId(planId),
      planName: plan.name,
      planDescription: plan.description,
      durationMonths: plan.durationMonths,
      maxStartingRides: plan.maxStartingRides,
      maxJoiningRides: plan.maxJoiningRides,
      originalPrice: plan.price,
      startDate,
      endDate,
      remainingStartRides: plan.maxStartingRides,
      remainingJoinRides: plan.maxJoiningRides
    };

    const updatedUser = await this.subscriptionRepository.updateUser(userId, {
      $set: {
        subscription: subscriptionData,
        monthlyRideCount: 0,
        lastRideReset: new Date(),
      },
    } as UserUpdate);

    console.log("Updated user subscription:", updatedUser);
    return updatedUser;
  }

  async isSubscribed(userId: string): Promise<{ isSubscribed: boolean; subscription?: any }> {
    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user || !user.subscription) {
      return { isSubscribed: false };
    }

    const now = new Date();
    const isSubscribed = user.subscription.endDate > now;

    if (!isSubscribed) {
      return { isSubscribed: false };
    }

    return {
      isSubscribed: true,
      subscription: {
        plan: {
          _id: user.subscription.planId,
          name: user.subscription.planName,
          price: user.subscription.originalPrice,
          durationMonths: user.subscription.durationMonths,
          description: user.subscription.planDescription,
        },
        originalPrice: user.subscription.originalPrice,
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
      },
    };
  }

  async canBookRide(userId: string): Promise<boolean> {
    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if ((await this.isSubscribed(userId)).isSubscribed) {
      return true;
    }

    const now = new Date();
    const lastReset = new Date(user.lastRideReset);
    if (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      await this.subscriptionRepository.updateUser(userId, {
        $set: {
          monthlyRideCount: 0,
          lastRideReset: now,
        },
      } as UserUpdate);
    }

    const rideCount = await this.subscriptionRepository.getUserRideCount(
      userId,
      now.getMonth(),
      now.getFullYear()
    );

    return rideCount < 3;
  }

  async canRegisterVehicle(userId: string): Promise<boolean> {
    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    return user.vehicles.length < 2;
  }

  async createPaymentOrder(planId: string): Promise<any> {
    try {
      const plan = await SubscriptionPlanModel.findById(planId);
      if (!plan) {
        throw new Error("Subscription plan not found");
      }
      if (plan.isDeleted) {
        throw new Error("Subscription plan is deleted");
      }

      if (plan.status !== "Active") {
        throw new Error(`Cannot subscribe to a plan with status "${plan.status}"`);
      }

      const amountInPaise = plan.price * 100;
      if (amountInPaise < 100) {
        throw new Error(`Amount must be at least ₹1 (100 paise), got ₹${plan.price}`);
      }

      const timestamp = Date.now().toString().slice(-6);
      const shortPlanId = planId.slice(-8);
      const receipt = `rcpt_${shortPlanId}_${timestamp}`;

      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt,
      };

      console.log("Creating Razorpay order with options:", options);
      const order = await this.razorpay.orders.create(options);
      console.log("Razorpay order created:", order);

      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      };
    } catch (error: any) {
      console.error("Error in createPaymentOrder:", error);
      throw error;
    }
  }

  async verifyAndSubscribe(userId: string, planId: string, paymentId: string, orderId: string, signature: string): Promise<any> {
    const plan = await SubscriptionPlanModel.findById(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }
    if (plan.isDeleted) {
      throw new Error("Subscription plan is deleted");
    }

    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const amount = plan.price;
    const transactionId = uuidv4();
    const transaction = {
      transactionId,
      type: "SUBSCRIPTION" as const,
      amount,
      status: "COMPLETED" as const,
      createdAt: new Date(),
      description: `Debited for ${plan.name} subscription`, 
    };

    // Check if payment is from wallet
    const balance = await this.walletService.getBalance(userId);
    if (balance >= amount) {
      await this.subscriptionRepository.updateUser(userId, {
        $inc: { "wallet.balance": -amount },
        $push: { "wallet.transactions": transaction },
      } as UserUpdate);
      return await this.subscribeUser(userId, planId);
    }

    const generatedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      throw new Error("Invalid payment signature");
    }

    // Log Razorpay payment as a transaction
    await this.subscriptionRepository.updateUser(userId, {
      $push: { "wallet.transactions": transaction },
    } as UserUpdate);

    return await this.subscribeUser(userId, planId);
  }

  // NEW METHODS for ride limits
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const user = await this.userRepo.findUserById(userId);
    return !!(user?.subscription && user.subscription.endDate > new Date());
  }

  async getSubscriptionPlan(userId: string): Promise<ISubscriptionPlan | null> {
    const user = await this.userRepo.findUserById(userId);
    if (!user?.subscription) return null;
    
    return await SubscriptionPlanModel.findById(user.subscription.planId);
  }

  async getMonthlyRideCounts(userId: string): Promise<{ startCount: number; joinCount: number }> {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyStartCount = await this.rideRepo.count({
      driverId: userId,
      status: { $in: ["Pending", "Started", "Completed"] },
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });
    
    const monthlyJoinCount = await this.rideRepo.count({
      "passengers.passengerId": userId,
      status: { $in: ["Pending", "Started", "Completed"] },
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });
    
    return { startCount: monthlyStartCount, joinCount: monthlyJoinCount };
  }

  async canStartRide(userId: string): Promise<boolean> {
    const user = await this.userRepo.findUserById(userId);
    if (!user) throw new Error("User not found");

    const hasActiveSubscription = await this.hasActiveSubscription(userId);

    if (hasActiveSubscription) {
      const subscriptionPlan = await this.getSubscriptionPlan(userId);
      if (!subscriptionPlan) return false;
      
      // Unlimited rides (0 means unlimited)
      if (subscriptionPlan.maxStartingRides === 0) return true;
      
      // Check remaining rides
      const remainingRides = user.subscription!.remainingStartRides !== undefined ? 
                           user.subscription!.remainingStartRides : 
                           subscriptionPlan.maxStartingRides;
      
      return remainingRides > 0;
    } else {
      // Free tier: 3 rides per month
      const monthlyCounts = await this.getMonthlyRideCounts(userId);
      return monthlyCounts.startCount < 3;
    }
  }

  async canJoinRide(userId: string): Promise<boolean> {
    const user = await this.userRepo.findUserById(userId);
    if (!user) throw new Error("User not found");

    const hasActiveSubscription = await this.hasActiveSubscription(userId);

    if (hasActiveSubscription) {
      const subscriptionPlan = await this.getSubscriptionPlan(userId);
      if (!subscriptionPlan) return false;
      
      // Unlimited rides (0 means unlimited)
      if (subscriptionPlan.maxJoiningRides === 0) return true;
      
      // Check remaining rides
      const remainingRides = user.subscription!.remainingJoinRides !== undefined ? 
                           user.subscription!.remainingJoinRides : 
                           subscriptionPlan.maxJoiningRides;
      
      return remainingRides > 0;
    } else {
      // Free tier: 3 rides per month
      const monthlyCounts = await this.getMonthlyRideCounts(userId);
      return monthlyCounts.joinCount < 3;
    }
  }

  async getRemainingRideCounts(userId: string): Promise<{ startRides: number; joinRides: number }> {
    const user = await this.userRepo.findUserById(userId);
    if (!user) throw new Error("User not found");

    const hasActiveSubscription = await this.hasActiveSubscription(userId);

    if (hasActiveSubscription) {
      const subscriptionPlan = await this.getSubscriptionPlan(userId);
      if (!subscriptionPlan) return { startRides: 0, joinRides: 0 };
      
      const startRides = subscriptionPlan.maxStartingRides === 0 ? 
        Infinity : (user.subscription!.remainingStartRides !== undefined ? 
                   user.subscription!.remainingStartRides : 
                   subscriptionPlan.maxStartingRides);
      
      const joinRides = subscriptionPlan.maxJoiningRides === 0 ? 
        Infinity : (user.subscription!.remainingJoinRides !== undefined ? 
                   user.subscription!.remainingJoinRides : 
                   subscriptionPlan.maxJoiningRides);
      
      return { startRides, joinRides };
    } else {
      const monthlyCounts = await this.getMonthlyRideCounts(userId);
      return { 
        startRides: Math.max(0, 3 - monthlyCounts.startCount),
        joinRides: Math.max(0, 3 - monthlyCounts.joinCount)
      };
    }
  }

  async decrementStartRideCount(userId: string): Promise<void> {
    const user = await this.userRepo.findUserById(userId);
    if (!user || !user.subscription) return;

    const hasActiveSubscription = user.subscription.endDate > new Date();
    if (!hasActiveSubscription) return;

    const subscriptionPlan = await this.getSubscriptionPlan(userId);
    if (!subscriptionPlan || subscriptionPlan.maxStartingRides === 0) return;

    const currentRemaining = user.subscription.remainingStartRides !== undefined ? 
                           user.subscription.remainingStartRides : 
                           subscriptionPlan.maxStartingRides;
    
    const newRemaining = Math.max(0, currentRemaining - 1);
    
    await this.userRepo.updateOne(
      { _id: userId },
      { 
        $set: { 
          "subscription.remainingStartRides": newRemaining
        } 
      }
    );
  }

  async decrementJoinRideCount(userId: string): Promise<void> {
    const user = await this.userRepo.findUserById(userId);
    if (!user || !user.subscription) return;

    const hasActiveSubscription = user.subscription.endDate > new Date();
    if (!hasActiveSubscription) return;

    const subscriptionPlan = await this.getSubscriptionPlan(userId);
    if (!subscriptionPlan || subscriptionPlan.maxJoiningRides === 0) return;

    const currentRemaining = user.subscription.remainingJoinRides !== undefined ? 
                           user.subscription.remainingJoinRides : 
                           subscriptionPlan.maxJoiningRides;
    
    const newRemaining = Math.max(0, currentRemaining - 1);
    
    await this.userRepo.updateOne(
      { _id: userId },
      { 
        $set: { 
          "subscription.remainingJoinRides": newRemaining
        } 
      }
    );
  }

  async resetSubscriptionRideCounts(userId: string): Promise<void> {
    const user = await this.userRepo.findUserById(userId);
    if (!user || !user.subscription) return;

    const subscriptionPlan = await this.getSubscriptionPlan(userId);
    if (!subscriptionPlan) return;

    await this.userRepo.updateOne(
      { _id: userId },
      { 
        $set: { 
          "subscription.remainingStartRides": subscriptionPlan.maxStartingRides,
          "subscription.remainingJoinRides": subscriptionPlan.maxJoiningRides
        } 
      }
    );
  }
}