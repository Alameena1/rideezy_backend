import { Request, Response } from "express";

export interface INotificationController {
  triggerRideJoinNotification(req: Request, res: Response): Promise<void> | void;
  triggerRideCancellationNotification(req: Request, res: Response): Promise<void> | void;
  triggerWalletTransactionNotification(req: Request, res: Response): Promise<void> | void;
  triggerSubscriptionExpiryNotification(req: Request, res: Response): Promise<void> | void;
  getUserNotifications(req: Request, res: Response): Promise<void> | void;
  markAsRead(req: Request, res: Response): Promise<void> | void;
}