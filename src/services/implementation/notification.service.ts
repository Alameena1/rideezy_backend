import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { INotificationService } from "../interfaces/notification/iNotificationService";
import { INotificationRepository } from "../../repositories/interface/notification/iNotificationRepository";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { CreateNotificationDto, CreateNotificationDtoType } from "../../dtos/create-notification.dto";

@injectable()
export class NotificationService implements INotificationService {
  private notificationRepository: INotificationRepository;
  private userRepository: IUserRepository;

  constructor(
    @inject(TYPES.INotificationRepository) notificationRepository: INotificationRepository,
    @inject(TYPES.IUserRepository) userRepository: IUserRepository
  ) {
    this.notificationRepository = notificationRepository;
    this.userRepository = userRepository;
  }

  async triggerRideJoinNotification(rideId: string, userId: string, joinedUserId: string): Promise<void> {
    const joinedUser = await this.userRepository.findUserById(joinedUserId);
    const joinedUserName = joinedUser?.fullName || joinedUserId; 

    const notificationData: CreateNotificationDtoType = {
      userId,
      message: `User ${joinedUserName} has joined your ride ${rideId}`,
      type: "ride_join",
      isRead: false,
      createdAt: new Date(),
    };
    const validatedData = CreateNotificationDto.parse(notificationData);
    await this.notificationRepository.create(validatedData);
  }

  async triggerRideCancellationNotification(rideId: string, userId: string, message?: string): Promise<void> {
    const user = await this.userRepository.findUserById(userId);
    const userName = user?.fullName || userId; 

    const notificationData: CreateNotificationDtoType = {
      userId,
      message: message || `Passenger ${userName} has cancelled their participation in ride ${rideId}`,
      type: "ride_cancel",
      isRead: false,
      createdAt: new Date(),
    };
    const validatedData = CreateNotificationDto.parse(notificationData);
    await this.notificationRepository.create(validatedData);
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
    await this.notificationRepository.create(validatedData);
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
    await this.notificationRepository.create(validatedData);
  }

  async getUserNotifications(userId: string): Promise<any[]> {
    console.log("from noti service", userId);
    return this.notificationRepository.findByUserId(userId);
  }

  async markAsRead(notificationId: string): Promise<any> {
    return this.notificationRepository.update(notificationId, { isRead: true });
  }
}

export default NotificationService;