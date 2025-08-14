// src/controllers/interface/chat/IChatController.ts
import { Socket } from "socket.io";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../../types/express";

interface IChatController {
  handleSendMessage(socket: Socket, data: { conversationId: string; content: string }, callback: (error?: string) => void): Promise<void>;
  handleJoinChat(socket: Socket, conversationId: string, callback: (error?: string) => void): Promise<void>;
  createConversation(req: AuthenticatedRequest, res: Response): Promise<void>;
  getConversation(req: AuthenticatedRequest, res: Response): Promise<void>;
  getMessages(req: AuthenticatedRequest, res: Response): Promise<void>;
  sendMessage(req: AuthenticatedRequest, res: Response): Promise<void>;
  getUserConversations(req: AuthenticatedRequest, res: Response): Promise<void>;
  getOrCreateRideConversation(req: AuthenticatedRequest, res: Response): Promise<void>;
}

export default IChatController;