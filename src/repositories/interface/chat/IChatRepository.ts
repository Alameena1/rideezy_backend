import { IConversation } from "../../../models/conversation.model";
import { IMessage } from "../../../models/message.model.ts";

interface IChatRepository {
  createConversation(participants: string[], rideId?: string): Promise<IConversation>;
  findConversationById(conversationId: string): Promise<IConversation | null>;
  findConversationByParticipants(participants: string[]): Promise<IConversation | null>;
  findConversationByRideId(rideId: string, userId: string, driverId: string): Promise<IConversation | null>;
  createMessage(conversationId: string, senderId: string, content: string, messageType: 'text' | 'image' | 'file', imageUrl?: string, fileUrl?: string, fileName?: string): Promise<IMessage>;
  findMessagesByConversationId(conversationId: string): Promise<IMessage[]>;
  findUserConversations(userId: string): Promise<IConversation[]>;
  findUserById(userId: string): Promise<{ fullName: string; profilePicture?: string } | null>;
  deleteMessage(messageId: string, deletedBy: string): Promise<IMessage | null>;
  findMessageById(messageId: string): Promise<IMessage | null>;
}

export default IChatRepository;