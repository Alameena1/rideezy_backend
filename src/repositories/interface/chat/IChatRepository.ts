// src/repositories/interface/chat/IChatRepository.ts
import { IConversation } from "../../../models/conversation.model";
import { IMessage } from "../../../models/message.model.ts";

interface IChatRepository {
  createConversation(participants: string[], rideId?: string): Promise<IConversation>;
  findConversationById(conversationId: string): Promise<IConversation | null>;
  findConversationByRideId(rideId: string): Promise<IConversation | null>;
  createMessage(conversationId: string, senderId: string, content: string): Promise<IMessage>;
  findMessagesByConversationId(conversationId: string): Promise<IMessage[]>;
  findUserConversations(userId: string): Promise<IConversation[]>;
}

export default IChatRepository;