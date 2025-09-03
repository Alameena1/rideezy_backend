import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  conversationId: string;
  senderId: Types.ObjectId;
  content: string;
  createdAt: Date;
  timestamp: string;
}

export interface IPopulatedSender {
  _id: Types.ObjectId;
  name: string;
}

export interface IPopulatedMessage extends Document {
  conversationId: string;
  senderId: IPopulatedSender;
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>({
  conversationId: { type: String, required: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  timestamp: { type: String, default: () => new Date().toISOString() },
});

export const Message = model<IMessage>("Message", messageSchema);
export default IMessage;