import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { ISubscriptionController } from "../controllers/implimentation/subscription/isubscriptionController";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const subscriptionController = container.get<ISubscriptionController>(TYPES.ISubscriptionController);

router.get("/plans", subscriptionController.getPlans.bind(subscriptionController));
router.post("/subscribe", subscriptionController.subscribe.bind(subscriptionController));
router.post("/subscribe-wallet", subscriptionController.subscribeWithWallet.bind(subscriptionController));
router.get("/check/:userId", subscriptionController.checkSubscription.bind(subscriptionController));
router.post("/create-order", subscriptionController.createOrder.bind(subscriptionController));
router.post("/verify", subscriptionController.verifyAndSubscribe.bind(subscriptionController));
router.get("/status", authMiddleware, subscriptionController.getSubscriptionStatus.bind(subscriptionController));

export default router;