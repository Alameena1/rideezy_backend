import { injectable, inject } from "inversify";
import IChatService from "../interfaces/chat/IChatService";
import IChatRepository from "../../repositories/interface/chat/IChatRepository";
import { TYPES } from "../../di/types";
import { IConversation } from "../../models/conversation.model";
import { IMessage, Message } from "../../models/message.model.ts"; 
import { io } from "../../app";
import { Types } from "mongoose";

@injectable()
export class ChatService implements IChatService {
  constructor(@inject(TYPES.IChatRepository) private chatRepository: IChatRepository) {}

  async createConversation(participants: string[], rideId?: string): Promise<IConversation> {
    if (participants.length < 2) {
      throw new Error("At least two participants are required");
    }

    const sortedParticipants = participants.sort();
    let conversation = await this.chatRepository.findConversationByParticipants(sortedParticipants);
    if (conversation) {
      return conversation;
    }

    return await this.chatRepository.createConversation(sortedParticipants, rideId);
  }

  async getConversation(conversationId: string): Promise<IConversation> {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    return conversation;
  }

  async getMessages(conversationId: string, userId: string): Promise<IMessage[]> {
    const hasAccess = await this.validateConversationAccess(conversationId, userId);
    if (!hasAccess) {
      throw new Error("Access to conversation denied");
    }
    return await this.chatRepository.findMessagesByConversationId(conversationId);
  }

  async sendMessage(conversationId: string, senderId: string, content: string): Promise<IMessage> {
    const hasAccess = await this.validateConversationAccess(conversationId, senderId);
    if (!hasAccess) {
      throw new Error("Access to conversation denied");
    }
    const message = await this.chatRepository.createMessage(conversationId, senderId, content);
    io.to(`chat:${conversationId}`).emit("newMessage", {
      ...message.toObject(),
      senderId: {
        _id: message.senderId,
        fullName: (await this.chatRepository.findUserById(message.senderId.toString()))?.fullName || "Unknown User",
      },
    });
    return message;
  }

  async validateConversationAccess(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) return false;

    return conversation.participants.some((participant) => {
      const participantId =
        participant instanceof Types.ObjectId
          ? participant.toString()
          : participant._id.toString();
      return participantId === userId.toString();
    });
  }

 async getUserConversations(userId: string): Promise<IConversation[]> {
    let conversations = await this.chatRepository.findUserConversations(userId);
    console.log("Raw conversations from repo:", conversations); // Debug log
    for (const conv of conversations) {
      const lastMsg = await Message.findOne({ conversationId: conv._id })
        .sort({ createdAt: -1 })
        .select("content createdAt")
        .exec();
      if (lastMsg) {
        (conv as any).lastMessage = lastMsg.content;
        (conv as any).lastMessageTime = lastMsg.createdAt;
      } else {
        (conv as any).lastMessage = null;
        (conv as any).lastMessageTime = null;
      }
    }
    console.log("Conversations with last messages:", conversations); // Debug log
    return conversations.sort((a, b) => {
      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }
  
  async getOrCreateRideConversation(rideId: string, userId: string, driverId: string): Promise<IConversation> {
    const participants = [userId, driverId].sort();
    let conversation = await this.chatRepository.findConversationByParticipants(participants);
    if (conversation) {
      return conversation;
    }

    conversation = await this.chatRepository.createConversation(participants, rideId);
    return conversation;
  }
}