// src/websocket/socket.io.ts
import { Server, Socket } from "socket.io";
import container from "../di/container";
import { TYPES } from "../di/types";
import IChatController from "../controllers/interface/chat/IChatController";
import jwt from "jsonwebtoken";
import { Request } from "express";

interface JwtPayload {
  userId: string;
  email: string;
  role?: string;
}

export const initializeSocket = (io: Server) => {
  const chatController = container.get<IChatController>(TYPES.IChatController);

  // Authentication middleware
  io.use(async (socket: Socket & { userId?: string }, next) => {
    try {
      const token = socket.handshake.auth.token || 
                   (socket.handshake.headers.authorization?.split(' ')[1]);
      console.log("token in socjket", token)
      if (!token) {
        throw new Error("Authentication error: No token provided");
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      
      if (error instanceof jwt.TokenExpiredError) {
        // Attempt to refresh token if expired
        try {
          const refreshToken = socket.handshake.auth.refreshToken;
          if (!refreshToken) throw new Error("No refresh token provided");
          
          // Call your refresh token endpoint
          const newToken = await refreshAccessToken(refreshToken);
          
          // Verify the new token
          const decoded = jwt.verify(newToken, process.env.JWT_SECRET as string) as JwtPayload;
          socket.userId = decoded.userId;
          socket.emit("token_refreshed", { token: newToken });
          next();
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          next(new Error("Authentication failed: Token expired and could not be refreshed"));
        }
      } else {
        next(new Error("Authentication error: Invalid token"));
      }
    }
  });

  // Helper function to refresh token
  const refreshAccessToken = async (refreshToken: string): Promise<string> => {
    // Implement your token refresh logic here
    // This should call your auth service's refresh endpoint
    // Return the new access token
    return "new_access_token";
  };

  io.on("connection", (socket: Socket & { userId?: string }) => {
    console.log("New WebSocket connection:", socket.id, "for user:", socket.userId);

    socket.on("joinConversation", (conversationId: string, callback: (error?: string) => void) => {
      if (!socket.userId) {
        return callback("Authentication required");
      }
      chatController.handleJoinChat(socket, conversationId, callback);
    });

    socket.on("sendMessage", (data: { conversationId: string; content: string }, callback: (error?: string) => void) => {
      if (!socket.userId) {
        return callback("Authentication required");
      }
      chatController.handleSendMessage(socket, data, callback);
    });

    socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
      if (!socket.userId) return;
      
      socket.to(`chat:${data.conversationId}`).emit("typing", {
        userId: socket.userId,
        isTyping: data.isTyping,
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });

    // Handle token refresh requests from client
    socket.on("refresh_token", async (refreshToken: string, callback) => {
      try {
        const newToken = await refreshAccessToken(refreshToken);
        callback({ success: true, token: newToken });
      } catch (error) {
        callback({ success: false, error: "Failed to refresh token" });
      }
    });
  });
};