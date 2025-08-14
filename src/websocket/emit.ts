import { io } from "../app";

export const emitNotification = (userId: string, notification: any) => {
  console.log(`Emitting notification to user ${userId}:`, notification);
  io.to(`user:${userId}`).emit("newNotification", notification);
};

export const emitChatMessage = (conversationId: string, message: any) => {
  console.log(`Emitting message to conversation ${conversationId}:`, message);
  io.to(`chat:${conversationId}`).emit("newMessage", message);
};