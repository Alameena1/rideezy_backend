import { Server, Socket } from "socket.io";
import container from "../di/container";
import { TYPES } from "../di/types";
import IChatController from "../controllers/interface/chat/IChatController";
import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: string;
  email: string;
  role?: string;
}

export const initializeSocket = (io: Server) => {
  const chatController = container.get<IChatController>(TYPES.IChatController);

  io.use(async (socket: Socket & { userId?: string; isAlive?: boolean }, next) => {
    try {
      const token = socket.handshake.auth.token || 
                   (socket.handshake.headers.authorization?.split(' ')[1]);
      
      console.log("Authentication attempt from:", socket.id);
      
      if (!token) {
        console.error("No token provided");
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = await new Promise<JwtPayload>((resolve, reject) => {
        jwt.verify(
          token, 
          process.env.JWT_SECRET as string, 
          (err: jwt.VerifyErrors | null, decoded: unknown) => {
            if (err) {
              reject(err);
            } else {
              resolve(decoded as JwtPayload);
            }
          }
        );
      });

      socket.userId = decoded.userId;
      console.log(`Authenticated user ${decoded.userId} on socket ${socket.id}`);
      next();
    } catch (error) {
      console.error("Authentication failed:", error);
      
      if (error instanceof jwt.TokenExpiredError) {
        try {
          const refreshToken = socket.handshake.auth.refreshToken;
          if (!refreshToken) {
            console.error("Token expired but no refresh token provided");
            return next(new Error("Token expired - please reauthenticate"));
          }
          
          const newToken = await refreshAccessToken(refreshToken);
          const decoded = jwt.verify(newToken, process.env.JWT_SECRET as string) as JwtPayload;
          socket.userId = decoded.userId;
          socket.emit("token_refreshed", { token: newToken });
          console.log("Token refreshed successfully");
          next();
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          next(new Error("Authentication failed: Could not refresh token"));
        }
      } else {
        next(new Error("Authentication error: Invalid token"));
      }
    }
  });

  // Connection handler with heartbeat
  io.on("connection", (socket: Socket & { userId?: string; isAlive?: boolean }) => {
    console.log(`New connection from ${socket.id} (user: ${socket.userId})`);

    // Heartbeat mechanism
    socket.isAlive = true;
    const heartbeatInterval = setInterval(() => {
      if (socket.isAlive === false) {
        console.log(`Terminating dead connection: ${socket.id}`);
        return socket.disconnect(true);
      }
      socket.isAlive = false;
      socket.emit("ping");
    }, 30000);

    // Join user's personal room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      console.log(`User ${socket.userId} joined personal room`);
    }

    // Event handlers
    socket.on("joinConversation", (conversationId: string, callback: (error?: string) => void) => {
      if (!socket.userId) {
        console.error("Unauthorized join attempt");
        return callback("Authentication required");
      }
      console.log(`User ${socket.userId} joining conversation ${conversationId}`);
      chatController.handleJoinChat(socket, conversationId, callback);
    });

    socket.on("sendMessage", (data: { conversationId: string; content: string }, callback: (error?: string) => void) => {
      if (!socket.userId) {
        console.error("Unauthorized message attempt");
        return callback("Authentication required");
      }
      console.log(`Message from ${socket.userId} in conversation ${data.conversationId}`);
      chatController.handleSendMessage(socket, data, callback);
    });

    socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
      if (!socket.userId) return;
      console.log(`Typing event from ${socket.userId} in ${data.conversationId}`);
      socket.to(`chat:${data.conversationId}`).emit("typing", {
        userId: socket.userId,
        isTyping: data.isTyping,
      });
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("disconnect", (reason) => {
      console.log(`Disconnected ${socket.id} (user: ${socket.userId}): ${reason}`);
      clearInterval(heartbeatInterval);
    });

    socket.on("error", (err: Error) => {
      console.error(`Socket error (${socket.id}):`, err);
    });
  });

 const refreshAccessToken = async (refreshToken: string): Promise<string> => {
  try {
    const response = await fetch('http://localhost:3001/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json();
    if (!data.success || !data.token) {
      throw new Error('Token refresh failed');
    }
    return data.token;
  } catch (error) {
    throw new Error('Token refresh failed');
  }
};
};

