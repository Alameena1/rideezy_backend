import { Socket } from "socket.io";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../../types/express";

interface IChatController {
  handleSendMessage(socket: Socket, data: { conversationId: string; content: string; messageType?: 'text' | 'image' | 'file'; imageUrl?: string; fileUrl?: string; fileName?: string }, callback: (error?: string) => void): Promise<void>;
  handleJoinChat(socket: Socket, conversationId: string, callback: (error?: string) => void): Promise<void>;
  handleDeleteMessage(socket: Socket, data: { messageId: string }, callback: (error?: string) => void): Promise<void>;
  createConversation(req: AuthenticatedRequest, res: Response): Promise<void>;
  getConversation(req: AuthenticatedRequest, res: Response): Promise<void>;
  getMessages(req: AuthenticatedRequest, res: Response): Promise<void>;
  sendMessage(req: AuthenticatedRequest, res: Response): Promise<void>;
  sendImageMessage(req: AuthenticatedRequest, res: Response): Promise<void>;
  getUserConversations(req: AuthenticatedRequest, res: Response): Promise<void>;
  getOrCreateRideConversation(req: AuthenticatedRequest, res: Response): Promise<void>;
  deleteMessage(req: AuthenticatedRequest, res: Response): Promise<void>;
  uploadChatImage(req: AuthenticatedRequest, res: Response): Promise<void>;
}

export default IChatController;