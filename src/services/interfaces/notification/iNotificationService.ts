// src/services/interfaces/notification/iNotificationService.ts
export interface INotificationService {
  triggerRideJoinNotification(rideId: string, userId: string, joinedUserId: string): Promise<void>;
  triggerRideCancellationNotification(rideId: string, userId: string, message?: string): Promise<void>; // Added optional message
  triggerWalletTransactionNotification(userId: string, amount: number, type: "credit" | "debit"): Promise<void>;
  triggerSubscriptionExpiryNotification(userId: string, daysLeft: number): Promise<void>;
  getUserNotifications(userId: string): Promise<any[]>;
  markAsRead(notificationId: string): Promise<any>;
}