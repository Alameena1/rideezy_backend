import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { ISubscriptionRepository } from "../../repositories/interface/subscription/isubscriptionRepository";
import Razorpay from "razorpay";
import { createHmac } from "crypto";
import { Types } from "mongoose";

@injectable()
export class SubscriptionService implements ISubscriptionService {
  private subscriptionRepository: ISubscriptionRepository;
  private razorpay: Razorpay;

  constructor(
    @inject(TYPES.ISubscriptionRepository) subscriptionRepository: ISubscriptionRepository
  ) {
    this.subscriptionRepository = subscriptionRepository;
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_KOCURsj88Mu4Sj",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI",
    });
  }

  async getAllPlans(): Promise<any[]> {
    return await this.subscriptionRepository.getAllPlans();
  }

  async subscribeUser(userId: string, planId: string): Promise<any> {
    const plan = await this.subscriptionRepository.findPlanById(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    const updatedUser = await this.subscriptionRepository.updateUser(userId, {
      subscription: {
        planId: new Types.ObjectId(planId),
        startDate,
        endDate,
      },
      monthlyRideCount: 0,
      lastRideReset: new Date(),
    });

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

  // Fetch the plan details
  const plan = await this.subscriptionRepository.findPlanById(user.subscription.planId.toString());
  if (!plan) {
    return { isSubscribed: false };
  }

  return {
    isSubscribed: true,
    subscription: {
      plan: {
        _id: plan._id,
        name: plan.name,
        price: plan.price,
        durationMonths: plan.durationMonths,
        description: plan.description,
      },
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

    if (await this.isSubscribed(userId)) {
      return true;
    }

    const now = new Date();
    const lastReset = new Date(user.lastRideReset);
    if (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      await this.subscriptionRepository.updateUser(userId, {
        monthlyRideCount: 0,
        lastRideReset: now,
      });
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
    const plan = await this.subscriptionRepository.findPlanById(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    if (plan.status !== "Active") {
      throw new Error(`Cannot subscribe to a plan with status "${plan.status}"`);
    }

    const amountInPaise = plan.price * 100;
    if (amountInPaise < 100) {
      throw new Error(`Amount must be at least ₹1 (100 paise), got ₹${plan.price}`);
    }

    // Shorten the receipt to fit within 40 characters
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const shortPlanId = planId.slice(-8); // Last 8 characters of planId
    const receipt = `rcpt_${shortPlanId}_${timestamp}`; // e.g., "rcpt_a7101aea_930629"

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt,
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
    // Verify the payment signature
    const generatedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      throw new Error("Invalid payment signature");
    }

    // Subscribe the user after successful verification
    return await this.subscribeUser(userId, planId);
  }



}