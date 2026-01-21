export interface INotificationService {
  triggerRideJoinNotification(rideId: string, userId: string, joinedUserId: string): Promise<void>;
  triggerRideCancellationNotification(rideId: string, userId: string, message?: string): Promise<void>;
  triggerWalletTransactionNotification(userId: string, amount: number, type: "credit" | "debit"): Promise<void>;
  triggerSubscriptionExpiryNotification(userId: string, daysLeft: number): Promise<void>;
  getUserNotifications(userId: string): Promise<any[]>;
  markAsRead(notificationId: string): Promise<any>;
  triggerRideJoinRejectedNotification(rideId: string, userId: string, rejectedPassengerId: string, passengerName: string): Promise<void>;
  triggerRideJoinAcceptedNotification(rideId: string, userId: string, passengerName: string): Promise<void>; // Add this
}