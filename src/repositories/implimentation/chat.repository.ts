import { injectable } from "inversify";
import IChatRepository from "../interface/chat/IChatRepository";
import { Conversation, IConversation } from "../../models/conversation.model";
import { Message, IMessage } from "../../models/message.model.ts";
import User from "../../models/user.model";
import { Types } from "mongoose";

@injectable()
export class ChatRepository implements IChatRepository {
  async createConversation(participants: string[], rideId?: string): Promise<IConversation> {
    const conversation = new Conversation({ participants, rideId });
    return await conversation.save();
  }

  async findConversationById(conversationId: string): Promise<IConversation | null> {
    return Conversation.findById(conversationId)
      .populate({
        path: "participants",
        select: "_id fullName",
      })
      .exec();
  }

  async findConversationByParticipants(participants: string[]): Promise<IConversation | null> {
    return await Conversation.findOne({
      participants: { $all: participants, $size: participants.length },
    })
      .populate("participants", "_id fullName")
      .exec();
  }

  async findConversationByRideId(rideId: string, userId: string, driverId: string): Promise<IConversation | null> {
    return await Conversation.findOne({
      rideId,
      participants: { $all: [userId, driverId] },
    })
      .populate("participants", "_id fullName")
      .exec();
  }

  async createMessage(conversationId: string, senderId: string, content: string): Promise<IMessage> {
    const message = new Message({ conversationId, senderId, content });
    return await message.save();
  }

  async findMessagesByConversationId(conversationId: string): Promise<IMessage[]> {
    return await Message.find({ conversationId })
      .populate("senderId", "_id fullName")
      .sort({ createdAt: 1 })
      .exec();
  }

  async findUserConversations(userId: string): Promise<IConversation[]> {
    return await Conversation.find({ participants: userId })
      .populate("participants", "_id fullName")
      .sort({ createdAt: -1 })
      .exec();
  }

  async findUserById(userId: string): Promise<{ fullName: string } | null> {
    return await User.findById(userId).select("fullName").exec();
  }
}