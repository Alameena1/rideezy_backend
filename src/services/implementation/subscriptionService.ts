import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { ISubscriptionRepository } from "../../repositories/interface/subscription/isubscriptionRepository";
import { Types } from "mongoose";

@injectable()
export class SubscriptionService implements ISubscriptionService {
  private subscriptionRepository: ISubscriptionRepository;

  constructor(
    @inject(TYPES.ISubscriptionRepository) subscriptionRepository: ISubscriptionRepository
  ) {
    this.subscriptionRepository = subscriptionRepository;
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

  async isSubscribed(userId: string): Promise<boolean> {
    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user || !user.subscription) {
      return false;
    }

    const now = new Date();
    return user.subscription.endDate > now;
  }

  async canBookRide(userId: string): Promise<boolean> {
    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Subscribed users can book unlimited rides
    if (await this.isSubscribed(userId)) {
      return true;
    }

    // Reset ride count if a new month has started
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

    // Fetch ride count for the current month
    const rideCount = await this.subscriptionRepository.getUserRideCount(
      userId,
      now.getMonth(),
      now.getFullYear()
    );

    // Unsubscribed users: limit to < 3 rides per month
    return rideCount < 3;
  }

  async canRegisterVehicle(userId: string): Promise<boolean> {
    const user = await this.subscriptionRepository.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    return user.vehicles.length < 2;
  }
}