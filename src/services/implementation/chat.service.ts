// src/services/implementation/chat.service.ts
import { injectable, inject } from "inversify";
import IChatService from "../interfaces/chat/IChatService";
import IChatRepository from "../../repositories/interface/chat/IChatRepository";
import { TYPES } from "../../di/types";
import { IConversation } from "../../models/conversation.model";
import { IMessage } from "../../models/message.model.ts";
import { io } from "../../app";

@injectable()
class ChatService implements IChatService {
  constructor(@inject(TYPES.IChatRepository) private chatRepository: IChatRepository) {}

  async createConversation(participants: string[]): Promise<IConversation> {
    if (participants.length < 2) {
      throw new Error("At least two participants are required");
    }
    return await this.chatRepository.createConversation(participants);
  }

  async getConversation(conversationId: string): Promise<IConversation> {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    console.log("from chat service",conversation)
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
    io.to(`chat:${conversationId}`).emit("newMessage", message);
    return message;
  }

  async validateConversationAccess(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) {
      return false;
    }
    return conversation.participants.some((id) => id.toString() === userId);
  }

  async getUserConversations(userId: string): Promise<IConversation[]> {
    return await this.chatRepository.findUserConversations(userId);
  }

  async getOrCreateRideConversation(rideId: string, userId: string, driverId: string): Promise<IConversation> {
    let conversation = await this.chatRepository.findConversationByRideId(rideId);
    if (conversation && conversation.participants.some((id) => id.toString() === userId) && conversation.participants.some((id) => id.toString() === driverId)) {
      return conversation;
    }

    const participants = [userId, driverId];
    conversation = await this.chatRepository.createConversation(participants, rideId);
    return conversation;
  }
}

export default ChatService;