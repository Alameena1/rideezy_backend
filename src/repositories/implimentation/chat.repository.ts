// repositories/chat.repository.ts
import { injectable } from "inversify";
import IChatRepository from "../interface/chat/IChatRepository";
import { Conversation, IConversation } from "../../models/conversation.model";
import { Message, IMessage } from "../../models/message.model.ts";
import { User } from "../../models/user.model"; // Fixed import
import { Types } from "mongoose";

@injectable()
export class ChatRepository implements IChatRepository {
  async createConversation(participants: string[], rideId?: string): Promise<IConversation> {
    const conversation = new Conversation({
      participants: participants.map(p => new Types.ObjectId(p)),
      rideId,
    });
    return await conversation.save();
  }

  async findConversationById(conversationId: string): Promise<IConversation | null> {
    return await Conversation.findById(conversationId)
      .populate('participants', 'fullName profilePicture')
      .exec();
  }

  async findConversationByParticipants(participants: string[]): Promise<IConversation | null> {
    const participantIds = participants.map(p => new Types.ObjectId(p));
    return await Conversation.findOne({
      participants: { $all: participantIds, $size: participantIds.length }
    }).populate('participants', 'fullName profilePicture').exec();
  }

  async findConversationByRideId(rideId: string, userId: string, driverId: string): Promise<IConversation | null> {
    const participantIds = [new Types.ObjectId(userId), new Types.ObjectId(driverId)];
    return await Conversation.findOne({
      rideId,
      participants: { $all: participantIds }
    }).populate('participants', 'fullName profilePicture').exec();
  }

  async createMessage(
    conversationId: string, 
    senderId: string, 
    content: string, 
    messageType: 'text' | 'image' | 'file' = 'text',
    imageUrl?: string,
    fileUrl?: string,
    fileName?: string
  ): Promise<IMessage> {
    const messageData: any = {
      conversationId,
      senderId: new Types.ObjectId(senderId),
      messageType,
      content: messageType === 'text' ? content : '',
    };

    if (messageType === 'image' && imageUrl) {
      messageData.imageUrl = imageUrl;
      messageData.content = content || ''; // Caption for image
    }

    if (messageType === 'file' && fileUrl) {
      messageData.fileUrl = fileUrl;
      messageData.fileName = fileName;
      messageData.content = content || ''; // Description for file
    }

    const message = new Message(messageData);
    return await message.save();
  }

  async findMessagesByConversationId(conversationId: string): Promise<IMessage[]> {
    return await Message.find({ 
      conversationId, 
      isDeleted: false 
    })
    .populate('senderId', 'fullName profilePicture')
    .sort({ createdAt: 1 })
    .exec();
  }

  async findUserConversations(userId: string): Promise<IConversation[]> {
    return await Conversation.find({
      participants: new Types.ObjectId(userId)
    })
    .populate('participants', 'fullName profilePicture')
    .sort({ createdAt: -1 })
    .exec();
  }

  async findUserById(userId: string): Promise<{ fullName: string; profilePicture?: string } | null> {
    const user = await User.findById(userId).select('fullName profilePicture');
    return user ? { 
      fullName: user.fullName, 
      profilePicture: user.image // Using 'image' field as profile picture
    } : null;
  }

  async deleteMessage(messageId: string, deletedBy: string): Promise<IMessage | null> {
    return await Message.findByIdAndUpdate(
      messageId,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: new Types.ObjectId(deletedBy),
        content: 'This message was deleted',
        imageUrl: undefined,
        fileUrl: undefined,
        fileName: undefined
      },
      { new: true }
    ).populate('senderId', 'fullName profilePicture').exec();
  }

  async findMessageById(messageId: string): Promise<IMessage | null> {
    return await Message.findById(messageId)
      .populate('senderId', 'fullName profilePicture')
      .exec();
  }
}