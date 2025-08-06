// src/websocket/emit.ts
import { Server } from "socket.io";
import { io } from "../app"; // Import io from app.ts

export const emitNotification = (userId: string, notification: any) => {
  console.log(`Emitting notification to user ${userId}:`, notification);
  io.to(userId).emit("newNotification", notification);
};