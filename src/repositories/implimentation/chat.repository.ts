// src/repositories/implementation/chat.repository.ts
import { injectable } from "inversify";
import IChatRepository from "../interface/chat/IChatRepository";
import { Conversation, IConversation } from "../../models/conversation.model";
import { Message, IMessage } from "../../models/message.model.ts";

@injectable()
class ChatRepository implements IChatRepository {
  async createConversation(participants: string[], rideId?: string): Promise<IConversation> {
    const conversation = new Conversation({ participants, rideId });
    return await conversation.save();
  }

  async findConversationById(conversationId: string): Promise<IConversation | null> {
    return await Conversation.findById(conversationId).populate("participants", "name").exec();
  }

  async findConversationByRideId(rideId: string): Promise<IConversation | null> {
    return await Conversation.findOne({ rideId }).populate("participants", "name").exec();
  }

  async createMessage(conversationId: string, senderId: string, content: string): Promise<IMessage> {
    const message = new Message({ conversationId, senderId, content });
    return await message.save();
  }

  async findMessagesByConversationId(conversationId: string): Promise<IMessage[]> {
    return await Message.find({ conversationId })
      .populate("senderId", "name")
      .sort({ createdAt: 1 })
      .exec();
  }

  async findUserConversations(userId: string): Promise<IConversation[]> {
    return await Conversation.find({ participants: userId })
      .populate("participants", "name")
      .sort({ createdAt: -1 })
      .exec();
  }
}

export default ChatRepository;