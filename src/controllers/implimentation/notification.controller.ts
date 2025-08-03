import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { INotificationService } from "../../services/interfaces/notification/iNotificationService";
import { INotificationController } from "../interface/notification/iNotificationController";

@injectable()
export class NotificationController implements INotificationController {
  private notificationService: INotificationService;

  constructor(@inject(TYPES.INotificationService) notificationService: INotificationService) {
    this.notificationService = notificationService;
  }

  async triggerRideJoinNotification(req: Request, res: Response): Promise<void> {
    try {
      const { rideId, userId, joinedUserId } = req.body;
      if (!rideId || !userId || !joinedUserId) {
        res.status(400).json({ success: false, message: "All fields are required" });
        return;
      }
      await this.notificationService.triggerRideJoinNotification(rideId, userId, joinedUserId);
      res.status(200).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async triggerRideCancellationNotification(req: Request, res: Response): Promise<void> {
    try {
      const { rideId, userId } = req.body;
      if (!rideId || !userId) {
        res.status(400).json({ success: false, message: "All fields are required" });
        return;
      }
      await this.notificationService.triggerRideCancellationNotification(rideId, userId);
      res.status(200).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    } 
  }

  async triggerWalletTransactionNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount, type } = req.body;
      if (!userId || !amount || !type) {
        res.status(400).json({ success: false, message: "All fields are required" });
        return;
      }
      await this.notificationService.triggerWalletTransactionNotification(userId, amount, type as "credit" | "debit");
      res.status(200).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async triggerSubscriptionExpiryNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, daysLeft } = req.body;
      if (!userId || !daysLeft) {
        res.status(400).json({ success: false, message: "All fields are required" });
        return;
      }
      await this.notificationService.triggerSubscriptionExpiryNotification(userId, daysLeft);
      res.status(200).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ success: false, message: "userId is required" });
        return;
      }
      const notifications = await this.notificationService.getUserNotifications(userId);
      res.status(200).json({ success: true, notifications });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      if (!notificationId) {
        res.status(400).json({ success: false, message: "notificationId is required" });
        return;
      }
      const notification = await this.notificationService.markAsRead(notificationId);
      res.status(200).json({ success: true, notification });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}

export default NotificationController;