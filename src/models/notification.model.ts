 import { Schema, model, Document } from "mongoose";

export interface Notification extends Document {
  userId: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
}

export type NotificationDocument = Document & Notification;  

const NotificationSchema: Schema = new Schema<Notification>({
  userId: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default model<Notification>("Notification", NotificationSchema);