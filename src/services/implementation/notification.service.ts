import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { INotificationService } from "../interfaces/notification/iNotificationService";
import { INotificationRepository } from "../../repositories/interface/notification/iNotificationRepository";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { CreateNotificationDto, CreateNotificationDtoType } from "../../dtos/create-notification.dto";
import { emitNotification } from "../../websocket/emit"; // Adjust path as needed

@injectable()
export class NotificationService implements INotificationService {
  private _notificationRepository: INotificationRepository;
  private _userRepository: IUserRepository;

  constructor(
    @inject(TYPES.INotificationRepository) notificationRepository: INotificationRepository,
    @inject(TYPES.IUserRepository) userRepository: IUserRepository
  ) {
    this._notificationRepository = notificationRepository;
    this._userRepository = userRepository;
  }

  async triggerRideJoinNotification(rideId: string, userId: string, joinedUserId: string): Promise<void> {
    const joinedUser = await this._userRepository.findUserById(joinedUserId);
    const joinedUserName = joinedUser?.fullName || joinedUserId; 

    const notificationData: CreateNotificationDtoType = {
      userId,
      message: `User ${joinedUserName} has joined your ride ${rideId}`,
      type: "ride_join",
      isRead: false,
      createdAt: new Date(),
    };
    const validatedData = CreateNotificationDto.parse(notificationData);
    await this._notificationRepository.create(validatedData);
    emitNotification(userId, validatedData);
  }

  async triggerRideCancellationNotification(rideId: string, userId: string, message?: string): Promise<void> {
    const user = await this._userRepository.findUserById(userId);
    const userName = user?.fullName || userId; 

    const notificationData: CreateNotificationDtoType = {
      userId,
      message: message || `Passenger ${userName} has cancelled their participation in ride ${rideId}`,
      type: "ride_cancel",
      isRead: false,
      createdAt: new Date(),
    };
    const validatedData = CreateNotificationDto.parse(notificationData);
    await this._notificationRepository.create(validatedData);
    emitNotification(userId, validatedData);
  }

  async triggerWalletTransactionNotification(userId: string, amount: number, type: "credit" | "debit"): Promise<void> {
    const notificationData: CreateNotificationDtoType = {
      userId,
      message: `Wallet ${type}ed with $${amount}`,
      type: "wallet_transaction",
      isRead: false,
      createdAt: new Date(),
    };
    const validatedData = CreateNotificationDto.parse(notificationData);
    await this._notificationRepository.create(validatedData);
    emitNotification(userId, validatedData);
  }

  async triggerSubscriptionExpiryNotification(userId: string, daysLeft: number): Promise<void> {
    const notificationData: CreateNotificationDtoType = {
      userId,
      message: `Your subscription will expire in ${daysLeft} days`,
      type: "subscription_expiry",
      isRead: false,
      createdAt: new Date(),
    };
    const validatedData = CreateNotificationDto.parse(notificationData);
    await this._notificationRepository.create(validatedData);
    emitNotification(userId, validatedData);
  }

  async triggerRideJoinRejectedNotification(rideId: string, userId: string, rejectedPassengerId: string, passengerName: string): Promise<void> {
    const notificationData: CreateNotificationDtoType = {
      userId,
      message: `Your request to join ride ${rideId} has been rejected by the driver. Passenger: ${passengerName}`,
      type: "ride_join_rejected",
      isRead: false,
      createdAt: new Date(),
    };
    const validatedData = CreateNotificationDto.parse(notificationData);
    await this._notificationRepository.create(validatedData);
    emitNotification(userId, validatedData); 
  }

  async triggerRideJoinAcceptedNotification(rideId: string, userId: string, passengerName: string): Promise<void> {
  console.log(`[Notification] Ride ${rideId} join accepted for ${passengerName} (userId: ${userId})`);
  const notificationData: CreateNotificationDtoType = {
    userId,
    message: `Your request to join ride ${rideId} has been accepted by the driver. Passenger: ${passengerName}`,
    type: "ride_join_accepted",
    isRead: false,
    createdAt: new Date(),
  };
  const validatedData = CreateNotificationDto.parse(notificationData);
  await this._notificationRepository.create(validatedData);
  emitNotification(userId, validatedData);
}

  async getUserNotifications(userId: string): Promise<any[]> {
    return this._notificationRepository.findByUserId(userId);
  }

  async markAsRead(notificationId: string): Promise<any> {
    return this._notificationRepository.update(notificationId, { isRead: true });
  }

}

export default NotificationService;