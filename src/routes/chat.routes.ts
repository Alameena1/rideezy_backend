import express from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import IChatController from "../controllers/interface/chat/IChatController";
import authMiddleware from "../middlewares/auth.middleware";

const router = express.Router();
const chatController = container.get<IChatController>(TYPES.IChatController);

router.post("/conversations", authMiddleware, chatController.createConversation.bind(chatController));
router.get("/conversations/:conversationId", authMiddleware, chatController.getConversation.bind(chatController));
router.get("/conversations/:conversationId/messages", authMiddleware, chatController.getMessages.bind(chatController));
router.post("/conversations/:conversationId/messages", authMiddleware, chatController.sendMessage.bind(chatController));
router.post("/conversations/:conversationId/image", authMiddleware, chatController.sendImageMessage.bind(chatController));
router.get("/users/:userId/conversations", authMiddleware, chatController.getUserConversations.bind(chatController));
router.post("/ride-conversation", authMiddleware, chatController.getOrCreateRideConversation.bind(chatController));
router.delete("/messages/:messageId", authMiddleware, chatController.deleteMessage.bind(chatController));
router.post("/upload-image", authMiddleware, chatController.uploadChatImage.bind(chatController));

export default router;