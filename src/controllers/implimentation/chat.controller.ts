// controllers/chat.controller.ts
import { injectable, inject } from "inversify";
import IChatController from "../interface/chat/IChatController";
import IChatService from "../../services/interfaces/chat/IChatService";
import { TYPES } from "../../di/types";
import { Socket } from "socket.io";
import { Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../../types/express";
import { StatusCode } from "../../constants/status-codes.enum";
import multer from "multer";

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

@injectable()
class ChatController implements IChatController {
  constructor(@inject(TYPES.IChatService) private chatService: IChatService) {}

  async handleSendMessage(
    socket: Socket, 
    data: { 
      conversationId: string; 
      content: string; 
      messageType?: 'text' | 'image' | 'file'; 
      imageUrl?: string; 
      fileUrl?: string; 
      fileName?: string 
    }, 
    callback: (error?: string) => void
  ): Promise<void> {
    const token = socket.handshake.auth.token;
    if (!token) {
      callback("No token provided");
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.USER_JWT_SECRET as string) as JwtPayload;
      if (decoded.role !== "user") {
        callback("User access required");
        return;
      }

      await this.chatService.sendMessage(
        data.conversationId, 
        decoded.userId, 
        data.content, 
        data.messageType || 'text',
        data.imageUrl,
        data.fileUrl,
        data.fileName
      );
      callback(); // Success
    } catch (error) {
      console.error("Error sending message:", error);
      
      if (error instanceof jwt.JsonWebTokenError) {
        callback("Invalid token");
      } else if (error instanceof jwt.TokenExpiredError) {
        callback("Token expired");
      } else {
        callback("Failed to send message");
      }
    }
  }

  async handleDeleteMessage(socket: Socket, data: { messageId: string }, callback: (error?: string) => void): Promise<void> {
    const token = socket.handshake.auth.token;
    if (!token) {
      callback("No token provided");
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.USER_JWT_SECRET as string) as JwtPayload;
      if (decoded.role !== "user") {
        callback("User access required");
        return;
      }

      await this.chatService.deleteMessage(data.messageId, decoded.userId);
      callback(); // Success
    } catch (error) {
      console.error("Error deleting message:", error);
      
      if (error instanceof jwt.JsonWebTokenError) {
        callback("Invalid token");
      } else if (error instanceof jwt.TokenExpiredError) {
        callback("Token expired");
      } else {
        callback(error instanceof Error ? error.message : "Failed to delete message");
      }
    }
  }

  async handleJoinChat(socket: Socket, conversationId: string, callback: (error?: string) => void): Promise<void> {
    const token = socket.handshake.auth.token;
    if (!token) {
      callback("No token provided");
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.USER_JWT_SECRET as string) as JwtPayload;
      if (decoded.role !== "user") {
        callback("User access required");
        return;
      }
      const hasAccess = await this.chatService.validateConversationAccess(conversationId, decoded.userId);
      if (!hasAccess) {
        callback("User does not have access to this conversation");
        return;
      }

      socket.join(`chat:${conversationId}`);
      console.log(`User ${decoded.userId} joined chat room ${conversationId}`);

      const messages = await this.chatService.getMessages(conversationId, decoded.userId);
      socket.emit("chatHistory", messages);
      callback();
    } catch (error) {
      console.error("Error joining chat:", error);
      
      if (error instanceof jwt.JsonWebTokenError) {
        callback("Invalid token");
      } else if (error instanceof jwt.TokenExpiredError) {
        callback("Token expired");
      } else {
        callback("Failed to join conversation");
      }
    }
  }

  async createConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }
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
        message: `Failed to create conversation: ${(error as Error).message}`,
      });
    }
  }

  async getConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }
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

      const conversation = await this.chatService.getConversation(conversationId);

      res.status(StatusCode.OK).json({
        success: true,
        conversation,
      });
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to get conversation: ${(error as Error).message}`,
      });
    }
  }

  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }
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
        message: `Failed to get messages: ${(error as Error).message}`,
      });
    }
  }

  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }
      const { conversationId } = req.params;
      const { content, messageType, imageUrl, fileUrl, fileName } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!content && messageType === 'text') {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "Message content is required for text messages",
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

      const message = await this.chatService.sendMessage(
        conversationId, 
        userId, 
        content, 
        messageType || 'text',
        imageUrl,
        fileUrl,
        fileName
      );

      res.status(StatusCode.CREATED).json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to send message: ${(error as Error).message}`,
      });
    }
  }

  async sendImageMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }

      upload.single('image')(req, res, async (err) => {
        if (err) {
          return res.status(StatusCode.BAD_REQUEST).json({
            success: false,
            message: err.message,
          });
        }

        const { conversationId } = req.params;
        const { caption } = req.body;
        const userId = req.user?.userId;
        const file = req.file;

        if (!userId) {
          return res.status(StatusCode.UNAUTHORIZED).json({
            success: false,
            message: "User not authenticated",
          });
        }

        if (!file) {
          return res.status(StatusCode.BAD_REQUEST).json({
            success: false,
            message: "Image file is required",
          });
        }

        try {
          const hasAccess = await this.chatService.validateConversationAccess(conversationId, userId);
          if (!hasAccess) {
            return res.status(StatusCode.FORBIDDEN).json({
              success: false,
              message: "Access to conversation denied",
            });
          }

          // Upload image to Cloudinary
          const imageUrl = await this.chatService.uploadImage(file.buffer, file.originalname);

          // Send image message
          const message = await this.chatService.sendImageMessage(conversationId, userId, imageUrl, caption);

          res.status(StatusCode.CREATED).json({
            success: true,
            message,
          });
        } catch (error) {
          console.error("Error sending image message:", error);
          res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to send image message: ${(error as Error).message}`,
          });
        }
      });
    } catch (error) {
      console.error("Error in sendImageMessage:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to send image message: ${(error as Error).message}`,
      });
    }
  }

  async getUserConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }
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
        message: `Failed to get user conversations: ${(error as Error).message}`,
      });
    }
  }

  async getOrCreateRideConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }
      const { rideId, driverId, userId: bodyUserId } = req.body;
      const authenticatedUserId = req.user?.userId;

      if (!authenticatedUserId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (bodyUserId && bodyUserId !== authenticatedUserId) {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User ID in request body does not match authenticated user",
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

      const conversation = await this.chatService.getOrCreateRideConversation(rideId, authenticatedUserId, driverId);

      res.status(StatusCode.OK).json({
        success: true,
        conversation,
      });
    } catch (error) {
      console.error("Error getting or creating ride conversation:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to get or create conversation: ${(error as Error).message}`,
      });
    }
  }

  async deleteMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }
      const { messageId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const deletedMessage = await this.chatService.deleteMessage(messageId, userId);

      res.status(StatusCode.OK).json({
        success: true,
        message: "Message deleted successfully",
        deletedMessage,
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to delete message: ${(error as Error).message}`,
      });
    }
  }

  async uploadChatImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "user") {
        res.status(StatusCode.FORBIDDEN).json({
          success: false,
          message: "User access required",
        });
        return;
      }

      upload.single('image')(req, res, async (err) => {
        if (err) {
          return res.status(StatusCode.BAD_REQUEST).json({
            success: false,
            message: err.message,
          });
        }

        const file = req.file;
        const userId = req.user?.userId;

        if (!userId) {
          return res.status(StatusCode.UNAUTHORIZED).json({
            success: false,
            message: "User not authenticated",
          });
        }

        if (!file) {
          return res.status(StatusCode.BAD_REQUEST).json({
            success: false,
            message: "Image file is required",
          });
        }

        try {
          const imageUrl = await this.chatService.uploadImage(file.buffer, file.originalname);

          res.status(StatusCode.OK).json({
            success: true,
            imageUrl,
          });
        } catch (error) {
          console.error("Error uploading image:", error);
          res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to upload image: ${(error as Error).message}`,
          });
        }
      });
    } catch (error) {
      console.error("Error in uploadChatImage:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Failed to upload image: ${(error as Error).message}`,
      });
    }
  }
}

export default ChatController;