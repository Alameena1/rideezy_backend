import { IConversation } from "../../../models/conversation.model";
import { IMessage } from "../../../models/message.model.ts";

interface IChatService {
  createConversation(participants: string[]): Promise<IConversation>;
  getConversation(conversationId: string): Promise<IConversation>;
  sendMessage(conversationId: string, senderId: string, content: string, messageType: 'text' | 'image' | 'file', imageUrl?: string, fileUrl?: string, fileName?: string): Promise<IMessage>;
  sendImageMessage(conversationId: string, senderId: string, imageUrl: string, caption?: string): Promise<IMessage>;
  getMessages(conversationId: string, userId: string): Promise<IMessage[]>;
  getUserConversations(userId: string): Promise<IConversation[]>;
  validateConversationAccess(conversationId: string, userId: string): Promise<boolean>;
  getOrCreateRideConversation(rideId: string, userId: string, driverId: string): Promise<IConversation>;
  deleteMessage(messageId: string, userId: string): Promise<IMessage>;
  uploadImage(file: Buffer, fileName: string, folder?: string): Promise<string>;
}

export default IChatService;