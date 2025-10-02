// services/chat.service.ts
import { injectable, inject } from "inversify";
import IChatService from "../interfaces/chat/IChatService";
import IChatRepository from "../../repositories/interface/chat/IChatRepository";
import { TYPES } from "../../di/types";
import { IConversation } from "../../models/conversation.model";
import { IMessage, Message } from "../../models/message.model.ts";
import { io } from "../../app";
import { Types } from "mongoose";
import { v2 as cloudinary } from 'cloudinary';

@injectable()
export class ChatService implements IChatService {
  constructor(@inject(TYPES.IChatRepository) private chatRepository: IChatRepository) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

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

  async sendMessage(
    conversationId: string, 
    senderId: string, 
    content: string, 
    messageType: 'text' | 'image' | 'file' = 'text',
    imageUrl?: string,
    fileUrl?: string,
    fileName?: string
  ): Promise<IMessage> {
    const hasAccess = await this.validateConversationAccess(conversationId, senderId);
    if (!hasAccess) {
      throw new Error("Access to conversation denied");
    }

    const message = await this.chatRepository.createMessage(
      conversationId, 
      senderId, 
      content, 
      messageType,
      imageUrl,
      fileUrl,
      fileName
    );
    
    // Get sender information for proper population
    const sender = await this.chatRepository.findUserById(senderId);
    
    // Emit the message with properly populated sender data
    const populatedMessage = {
      _id: message._id,
      conversationId: message.conversationId,
      senderId: {
        _id: senderId,
        fullName: sender?.fullName || "Unknown User",
        profilePicture: sender?.profilePicture,
      },
      content: message.content,
      messageType: message.messageType,
      imageUrl: message.imageUrl,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      isDeleted: message.isDeleted,
      createdAt: message.createdAt,
      timestamp: message.createdAt.toISOString(),
    };
    
    io.to(`chat:${conversationId}`).emit("newMessage", populatedMessage);
    return message;
  }

  async sendImageMessage(conversationId: string, senderId: string, imageUrl: string, caption?: string): Promise<IMessage> {
    return await this.sendMessage(conversationId, senderId, caption || '', 'image', imageUrl);
  }

  async validateConversationAccess(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) return false;

    return conversation.participants.some((participant) => {
      const participantId =
        participant instanceof Types.ObjectId
          ? participant.toString()
          : (participant as any)._id?.toString();
      return participantId === userId.toString();
    });
  }

  async getUserConversations(userId: string): Promise<IConversation[]> {
    let conversations = await this.chatRepository.findUserConversations(userId);
    
    for (const conv of conversations) {
      const lastMsg = await Message.findOne({ conversationId: conv._id, isDeleted: false })
        .sort({ createdAt: -1 })
        .select("content messageType createdAt")
        .exec();
      
      if (lastMsg) {
        (conv as any).lastMessage = lastMsg.messageType === 'image' ? '📷 Image' : lastMsg.content;
        (conv as any).lastMessageTime = lastMsg.createdAt;
      } else {
        (conv as any).lastMessage = null;
        (conv as any).lastMessageTime = null;
      }
    }
    
    return conversations.sort((a, b) => {
      const aTime = (a as any).lastMessageTime ? new Date((a as any).lastMessageTime).getTime() : new Date(a.createdAt).getTime();
      const bTime = (b as any).lastMessageTime ? new Date((b as any).lastMessageTime).getTime() : new Date(b.createdAt).getTime();
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

  async deleteMessage(messageId: string, userId: string): Promise<IMessage> {
    const message = await this.chatRepository.findMessageById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if user has permission to delete (sender or admin)
    if (message.senderId._id.toString() !== userId) {
      throw new Error("You can only delete your own messages");
    }

    const deletedMessage = await this.chatRepository.deleteMessage(messageId, userId);
    if (!deletedMessage) {
      throw new Error("Failed to delete message");
    }

    // Emit message deletion event
    io.to(`chat:${deletedMessage.conversationId}`).emit("messageDeleted", {
      messageId: deletedMessage._id,
      conversationId: deletedMessage.conversationId,
      deletedBy: userId,
      deletedAt: deletedMessage.deletedAt
    });

    return deletedMessage;
  }

  async uploadImage(file: Buffer, fileName: string, folder: string = 'chat_images'): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          format: 'webp', // Convert to webp for better compression
          quality: 'auto',
        },
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error('Cloudinary upload returned no result'));
          }
        }
      );

      uploadStream.end(file);
    });
  }
}