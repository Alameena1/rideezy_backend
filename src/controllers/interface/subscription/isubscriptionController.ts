import { Request, Response } from "express";

export interface ISubscriptionController {
  getPlans(req: Request, res: Response): Promise<void>;
  subscribe(req: Request, res: Response): Promise<void>;
  checkSubscription(req: Request, res: Response): Promise<void>;
}