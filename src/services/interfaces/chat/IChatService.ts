// src/services/interfaces/chat/IChatService.ts
import { IConversation } from "../../../models/conversation.model";
import { IMessage } from "../../../models/message.model.ts";

interface IChatService {
  createConversation(participants: string[]): Promise<IConversation>;
  getConversation(conversationId: string): Promise<IConversation>;
  sendMessage(conversationId: string, senderId: string, content: string): Promise<IMessage>;
  getMessages(conversationId: string, userId: string): Promise<IMessage[]>;
  getUserConversations(userId: string): Promise<IConversation[]>;
  validateConversationAccess(conversationId: string, userId: string): Promise<boolean>;
  getOrCreateRideConversation(rideId: string, userId: string, driverId: string): Promise<IConversation>;
}

export default IChatService;