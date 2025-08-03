// src/repositories/implimentation/notification.repository.ts
import { injectable } from "inversify";
import { Model } from "mongoose";
import { Notification, NotificationDocument } from "../../models/notification.model";
import { CreateNotificationDtoType } from "../../dtos/create-notification.dto";
import { INotificationRepository } from "../interface/notification/iNotificationRepository";

@injectable()
export class NotificationRepository implements INotificationRepository {
  private notificationModel: Model<NotificationDocument>;

  constructor() {
    this.notificationModel = require("../../models/notification.model").default; // Dynamic import
  }

  async create(createNotificationDto: CreateNotificationDtoType): Promise<Notification> {
    const createdNotification = new this.notificationModel(createNotificationDto);
    return createdNotification.save();
  }

  async findByUserId(userId: string): Promise<Notification[]> {
    return this.notificationModel.find({ userId }).exec();
  }

  async update(notificationId: string, update: Partial<Notification>): Promise<Notification | null> {
    return this.notificationModel.findByIdAndUpdate(notificationId, update, { new: true }).exec();
  }
}

export default NotificationRepository;