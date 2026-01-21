import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { INotificationController } from "../controllers/interface/notification/iNotificationController";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const notificationController = container.get<INotificationController>(TYPES.INotificationController);

// Existing routes
router.post("/ride-join", authMiddleware, (req, res) => notificationController.triggerRideJoinNotification(req, res));
router.post("/ride-cancel", authMiddleware, (req, res) => notificationController.triggerRideCancellationNotification(req, res));
router.post("/wallet-transaction", authMiddleware, (req, res) => notificationController.triggerWalletTransactionNotification(req, res));
router.post("/subscription-expiry", authMiddleware, (req, res) => notificationController.triggerSubscriptionExpiryNotification(req, res));

// New routes for join request notifications
router.post("/ride-join-accepted", authMiddleware, (req, res) => notificationController.triggerRideJoinNotification(req, res));
router.post("/ride-join-rejected", authMiddleware, (req, res) => notificationController.triggerRideJoinNotification(req, res));

// Get and update routes
router.get("/:userId", (req, res) => notificationController.getUserNotifications(req, res));
router.patch("/:notificationId/read", authMiddleware, (req, res) => notificationController.markAsRead(req, res));

export default router;