// src/controllers/implementation/chat.controller.ts
import { injectable, inject } from "inversify";
import IChatController from "../interface/chat/IChatController";
import IChatService from "../../services/interfaces/chat/IChatService";
import { TYPES } from "../../di/types";
import { Socket } from "socket.io";
import { Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../../types/express";
import { StatusCode } from "../../constants/status-codes.enum";

interface JwtPayload {
  userId: string;
  email: string;
  role?: string;
}

@injectable()
class ChatController implements IChatController {
  constructor(@inject(TYPES.IChatService) private chatService: IChatService) {}

  async handleSendMessage(socket: Socket, data: { conversationId: string; content: string }, callback: (error?: string) => void): Promise<void> {
    const token = socket.handshake.auth.token;
    if (!token) {
      callback("No token provided");
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      await this.chatService.sendMessage(data.conversationId, decoded.userId, data.content);
      callback();
    } catch (error) {
      console.error("Error sending message:", error);
      callback("Failed to send message");
    }
  }

  async handleJoinChat(socket: Socket, conversationId: string, callback: (error?: string) => void): Promise<void> {
    const token = socket.handshake.auth.token;
    if (!token) {
      callback("No token provided");
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      const hasAccess = await this.chatService.validateConversationAccess(conversationId, decoded.userId);
      if (!hasAccess) {
        callback("User does not have access to this conversation");
        socket.disconnect();
        return;
      }

      socket.join(`chat:${conversationId}`);
      console.log(`User ${decoded.userId} joined chat room ${conversationId}`);

      const messages = await this.chatService.getMessages(conversationId, decoded.userId);
      socket.emit("chatHistory", messages);
      callback();
    } catch (error) {
      console.error("Error joining chat:", error);
      callback("Invalid token");
      socket.disconnect();
    }
  }

  async createConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { participants } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!participants || !Array.isArray(participants)) {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Participants array is required",
        });
        return;
      }

      const allParticipants = participants.includes(userId)
        ? participants
        : [...participants, userId];

      const conversation = await this.chatService.createConversation(allParticipants);

      res.status(StatusCode.CREATED).json({
        success: true,
        conversation,
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to create conversation",
      });
    }
  }

  async getConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.userId;
      console.log("req.params",req.params)
      console.log("userId",userId)
      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const hasAccess = await this.chatService.validateConversationAccess(conversationId, userId);
      if (!hasAccess) {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "Access to conversation denied",
        });
        return;
      }

      const conversation = await this.chatService.getConversation(conversationId);

      res.status(StatusCode.OK).json({
        success: true,
        conversation,
      });
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get conversation",
      });
    }
  }

  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const hasAccess = await this.chatService.validateConversationAccess(conversationId, userId);
      if (!hasAccess) {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "Access to conversation denied",
        });
        return;
      }

      const messages = await this.chatService.getMessages(conversationId, userId);

      res.status(StatusCode.OK).json({
        success: true,
        messages,
      });
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get messages",
      });
    }
  }

  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!content) {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Message content is required",
        });
        return;
      }

      const hasAccess = await this.chatService.validateConversationAccess(conversationId, userId);
      if (!hasAccess) {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "Access to conversation denied",
        });
        return;
      }

      const message = await this.chatService.sendMessage(conversationId, userId, content);

      res.status(StatusCode.CREATED).json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send message",
      });
    }
  }

  async getUserConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user?.userId;

      if (!requestingUserId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (userId !== requestingUserId) {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "Access denied",
        });
        return;
      }

      const conversations = await this.chatService.getUserConversations(userId);

      res.status(StatusCode.OK).json({
        success: true,
        conversations,
      });
    } catch (error) {
      console.error("Error getting user conversations:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get user conversations",
      });
    }
  }

async getOrCreateRideConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { rideId, driverId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(StatusCode.UNAUTHORIZED).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    if (!rideId || !driverId) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: "rideId and driverId are required",
      });
      return;
    }

    const conversation = await this.chatService.getOrCreateRideConversation(rideId, userId, driverId);

    res.status(StatusCode.OK).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Error getting or creating ride conversation:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get or create conversation",
    });
  }
}
}



export default ChatController;