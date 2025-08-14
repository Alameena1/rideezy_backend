// src/models/conversation.model.ts
import { Schema, model, Document } from "mongoose";

export interface IConversation extends Document {
  _id: string;
  participants: string[];
  rideId?: string;
  createdAt: Date;
}

const conversationSchema = new Schema<IConversation>({
  participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  rideId: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

export const Conversation = model<IConversation>("Conversation", conversationSchema);
export default IConversation;