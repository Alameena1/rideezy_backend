import { Notification } from "../../../models/notification.model";

export interface INotificationRepository {
  create(createNotificationDto: any): Promise<Notification>;
  findByUserId(userId: string): Promise<Notification[]>;
  update(notificationId: string, update: Partial<Notification>): Promise<Notification | null>;
}