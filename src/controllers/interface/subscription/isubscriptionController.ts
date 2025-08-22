import { Request, Response } from "express";

export interface ISubscriptionController {
  getSubscriptionStatus: any;
  getPlans(req: Request, res: Response): Promise<void>;
  subscribe(req: Request, res: Response): Promise<void>;
  checkSubscription(req: Request, res: Response): Promise<void>;
  createOrder(req: Request, res: Response): Promise<void>;
  verifyAndSubscribe(req: Request, res: Response): Promise<void>;
  subscribeWithWallet(req: Request, res: Response): Promise<void>;
}