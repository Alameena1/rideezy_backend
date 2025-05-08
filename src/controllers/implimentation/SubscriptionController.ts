import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { ISubscriptionService } from "../../services/interfaces/subscription/isubscriptionService";
import { ISubscriptionController } from "../interface/subscription/isubscriptionController";

@injectable()
export class SubscriptionController implements ISubscriptionController {
  private subscriptionService: ISubscriptionService;

  constructor(
    @inject(TYPES.ISubscriptionService) subscriptionService: ISubscriptionService
  ) {
    this.subscriptionService = subscriptionService;
  }

  async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await this.subscriptionService.getAllPlans();
      res.status(200).json({ success: true, data: plans });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async subscribe(req: Request, res: Response): Promise<void> {
    try {
      const { userId, planId } = req.body;
      if (!userId || !planId) {
        res.status(400).json({ success: false, message: "User ID and Plan ID are required" });
        return;
      }

      const user = await this.subscriptionService.subscribeUser(userId, planId);
      res.status(200).json({ success: true, message: "Subscribed successfully", user });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async checkSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const isSubscribed = await this.subscriptionService.isSubscribed(userId);
      res.status(200).json({ success: true, isSubscribed });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}