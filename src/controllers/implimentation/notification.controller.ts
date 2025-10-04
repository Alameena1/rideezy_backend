import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { INotificationService } from "../../services/interfaces/notification/iNotificationService";
import { INotificationController } from "../interface/notification/iNotificationController";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";

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
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      await this.notificationService.triggerRideJoinNotification(rideId, userId, joinedUserId);
      res.status(StatusCode.OK).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async triggerRideCancellationNotification(req: Request, res: Response): Promise<void> {
    try {
      const { rideId, userId } = req.body;
      if (!rideId || !userId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      await this.notificationService.triggerRideCancellationNotification(rideId, userId);
      res.status(StatusCode.OK).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async triggerWalletTransactionNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount, type } = req.body;
      if (!userId || !amount || !type) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      await this.notificationService.triggerWalletTransactionNotification(userId, amount, type as "credit" | "debit");
      res.status(StatusCode.OK).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async triggerSubscriptionExpiryNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, daysLeft } = req.body;
      if (!userId || daysLeft === undefined) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      await this.notificationService.triggerSubscriptionExpiryNotification(userId, daysLeft);
      res.status(StatusCode.OK).json({ success: true, message: "Notification triggered" });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  // New methods for join request notifications
  async triggerRideJoinAcceptedNotification(req: Request, res: Response): Promise<void> {
    try {
      const { rideId, userId, passengerName } = req.body;
      if (!rideId || !userId || !passengerName) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      await this.notificationService.triggerRideJoinAcceptedNotification(rideId, userId, passengerName);
      res.status(StatusCode.OK).json({ success: true, message: "Ride join accepted notification triggered" });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async triggerRideJoinRejectedNotification(req: Request, res: Response): Promise<void> {
    try {
      const { rideId, userId, rejectedPassengerId, passengerName } = req.body;
      if (!rideId || !userId || !rejectedPassengerId || !passengerName) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      await this.notificationService.triggerRideJoinRejectedNotification(rideId, userId, rejectedPassengerId, passengerName);
      res.status(StatusCode.OK).json({ success: true, message: "Ride join rejected notification triggered" });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      const notifications = await this.notificationService.getUserNotifications(userId);
      res.status(StatusCode.OK).json({ success: true, notifications });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      if (!notificationId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      const notification = await this.notificationService.markAsRead(notificationId);
      res.status(StatusCode.OK).json({ success: true, notification });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: (error as Error).message });
    }
  }
}

export default NotificationController;