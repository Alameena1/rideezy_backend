// src/models/conversation.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IParticipant {
  _id: Types.ObjectId;
  name?: string;
}

export interface IConversation extends Document {
  participants: Types.ObjectId[] | IParticipant[]; 
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