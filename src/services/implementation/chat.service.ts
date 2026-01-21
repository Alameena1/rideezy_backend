import { injectable, inject } from "inversify";
import IChatService from "../interfaces/chat/IChatService";
import IChatRepository from "../../repositories/interface/chat/IChatRepository";
import { TYPES } from "../../di/types";
import { IConversation } from "../../models/conversation.model";
import { IMessage, Message } from "../../models/message.model.ts";
import { io } from "../../app";
import { Types } from "mongoose";
import { v2 as cloudinary } from 'cloudinary';
import logger from "../../config/logger";

@injectable()
export class ChatService implements IChatService {
  constructor(@inject(TYPES.IChatRepository) private _chatRepository: IChatRepository) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    logger.info('ChatService initialized with Cloudinary configuration');
  }

  async createConversation(participants: string[], rideId?: string): Promise<IConversation> {
    logger.debug(`Creating conversation for participants: ${participants.join(', ')}`);

    if (participants.length < 2) {
      logger.warn(`Attempt to create conversation with less than 2 participants`);
      throw new Error("At least two participants are required");
    }

    const sortedParticipants = participants.sort();
    const conversation = await this._chatRepository.findConversationByParticipants(sortedParticipants);
    
    if (conversation) {
      logger.debug(`Existing conversation found: ${conversation._id}`);
      return conversation;
    }

    const newConversation = await this._chatRepository.createConversation(sortedParticipants, rideId);
    logger.info(`New conversation created: ${newConversation._id} for ride: ${rideId || 'N/A'}`);
    return newConversation;
  }

  async getConversation(conversationId: string): Promise<IConversation> {
    logger.debug(`Fetching conversation: ${conversationId}`);
    
    const conversation = await this._chatRepository.findConversationById(conversationId);
    
    if (!conversation) {
      logger.warn(`Conversation not found: ${conversationId}`);
      throw new Error("Conversation not found");
    }

    logger.debug(`Conversation retrieved successfully: ${conversationId}`);
    return conversation;
  }

  async getMessages(conversationId: string, userId: string): Promise<IMessage[]> {
    logger.debug(`Fetching messages for conversation: ${conversationId} by user: ${userId}`);

    const hasAccess = await this.validateConversationAccess(conversationId, userId);
    if (!hasAccess) {
      logger.warn(`User ${userId} denied access to conversation ${conversationId}`);
      throw new Error("Access to conversation denied");
    }

    const messages = await this._chatRepository.findMessagesByConversationId(conversationId);
    logger.debug(`Retrieved ${messages.length} messages for conversation: ${conversationId}`);
    return messages;
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
    logger.debug(`Sending ${messageType} message to conversation: ${conversationId} by user: ${senderId}`);

    const hasAccess = await this.validateConversationAccess(conversationId, senderId);
    if (!hasAccess) {
      logger.warn(`User ${senderId} denied access to send message in conversation ${conversationId}`);
      throw new Error("Access to conversation denied");
    }

    const message = await this._chatRepository.createMessage(
      conversationId, 
      senderId, 
      content, 
      messageType,
      imageUrl,
      fileUrl,
      fileName
    );
    
    const sender = await this._chatRepository.findUserById(senderId);
    
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
    logger.info(`Message sent successfully: ${message._id} in conversation: ${conversationId}`);
    return message;
  }

  async sendImageMessage(conversationId: string, senderId: string, imageUrl: string, caption?: string): Promise<IMessage> {
    logger.debug(`Sending image message to conversation: ${conversationId} by user: ${senderId}`);
    return await this.sendMessage(conversationId, senderId, caption || '', 'image', imageUrl);
  }

  async validateConversationAccess(conversationId: string, userId: string): Promise<boolean> {
    logger.debug(`Validating access for user ${userId} to conversation ${conversationId}`);

    const conversation = await this._chatRepository.findConversationById(conversationId);
    if (!conversation) {
      logger.warn(`Conversation not found during access validation: ${conversationId}`);
      return false;
    }

    const hasAccess = conversation.participants.some((participant) => {
      const participantId = participant instanceof Types.ObjectId
        ? participant.toString()
        : (participant as any)._id?.toString();
      return participantId === userId.toString();
    });

    logger.debug(`Access validation result for user ${userId}: ${hasAccess}`);
    return hasAccess;
  }

  async getUserConversations(userId: string): Promise<IConversation[]> {
    logger.debug(`Fetching conversations for user: ${userId}`);

    const conversations = await this._chatRepository.findUserConversations(userId);
    
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
    
    const sortedConversations = conversations.sort((a, b) => {
      const aTime = (a as any).lastMessageTime ? new Date((a as any).lastMessageTime).getTime() : new Date(a.createdAt).getTime();
      const bTime = (b as any).lastMessageTime ? new Date((b as any).lastMessageTime).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    logger.debug(`Retrieved ${sortedConversations.length} conversations for user: ${userId}`);
    return sortedConversations;
  }
  
  async getOrCreateRideConversation(rideId: string, userId: string, driverId: string): Promise<IConversation> {
    logger.debug(`Getting or creating ride conversation for ride: ${rideId}, users: ${userId}, ${driverId}`);

    const participants = [userId, driverId].sort();
    let conversation = await this._chatRepository.findConversationByParticipants(participants);
    
    if (conversation) {
      logger.debug(`Existing ride conversation found: ${conversation._id}`);
      return conversation;
    }

    conversation = await this._chatRepository.createConversation(participants, rideId);
    logger.info(`New ride conversation created: ${conversation._id} for ride: ${rideId}`);
    return conversation;
  }

  async deleteMessage(messageId: string, userId: string): Promise<IMessage> {
    logger.debug(`Deleting message: ${messageId} by user: ${userId}`);

    const message = await this._chatRepository.findMessageById(messageId);
    if (!message) {
      logger.warn(`Message not found for deletion: ${messageId}`);
      throw new Error("Message not found");
    }

    if (message.senderId._id.toString() !== userId) {
      logger.warn(`User ${userId} attempted to delete message ${messageId} owned by ${message.senderId._id}`);
      throw new Error("You can only delete your own messages");
    }

    const deletedMessage = await this._chatRepository.deleteMessage(messageId, userId);
    if (!deletedMessage) {
      logger.error(`Failed to delete message: ${messageId}`);
      throw new Error("Failed to delete message");
    }

    io.to(`chat:${deletedMessage.conversationId}`).emit("messageDeleted", {
      messageId: deletedMessage._id,
      conversationId: deletedMessage.conversationId,
      deletedBy: userId,
      deletedAt: deletedMessage.deletedAt
    });

    logger.info(`Message deleted successfully: ${messageId} by user: ${userId}`);
    return deletedMessage;
  }

  async uploadImage(file: Buffer, fileName: string, folder: string = 'chat_images'): Promise<string> {
    logger.debug(`Uploading image to Cloudinary: ${fileName} to folder: ${folder}`);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          format: 'webp',
          quality: 'auto',
        },
        (error, result) => {
          if (error) {
            logger.error(`Cloudinary upload failed for ${fileName}: ${error.message}`);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else if (result) {
            logger.info(`Image uploaded successfully to Cloudinary: ${result.secure_url}`);
            resolve(result.secure_url);
          } else {
            logger.error(`Cloudinary upload returned no result for ${fileName}`);
            reject(new Error('Cloudinary upload returned no result'));
          }
        }
      );

      uploadStream.end(file);
    });
  }
}