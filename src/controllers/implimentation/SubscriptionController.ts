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
    const result = await this.subscriptionService.isSubscribed(userId);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error in checkSubscription:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
}

async createOrder(req: Request, res: Response): Promise<void> {
  try {
    const { planId } = req.body;
    if (!planId) {
      res.status(400).json({ success: false, message: "Plan ID is required" });
      return;
    }

    const order = await this.subscriptionService.createPaymentOrder(planId);
    res.status(200).json({ success: true, order });
  } catch (error: any) {
    console.error("Error in createOrder:", error);

    // Safely extract the error message
    const errorMessage = error.message || (error.error && error.error.description) || "Internal Server Error";
    const isClientError = errorMessage.includes("plan not found") || 
                         errorMessage.includes("status") || 
                         errorMessage.includes("Amount must be") || 
                         errorMessage.includes("receipt");

    res.status(isClientError ? 400 : 500).json({ 
      success: false, 
      message: errorMessage,
    });
  }
}
  async verifyAndSubscribe(req: Request, res: Response): Promise<void> {
    try {
      const { userId, planId, paymentId, orderId, signature } = req.body;
      if (!userId || !planId || !paymentId || !orderId || !signature) {
        res.status(400).json({ success: false, message: "All payment details are required" });
        return;
      }

      const result = await this.subscriptionService.verifyAndSubscribe(userId, planId, paymentId, orderId, signature);
      res.status(200).json({ success: true, message: "Payment verified and subscription activated", user: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  
}