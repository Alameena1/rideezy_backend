import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { ISubscriptionController } from "../controllers/interface/subscription/isubscriptionController";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const subscriptionController = container.get<ISubscriptionController>(TYPES.ISubscriptionController);

router.get("/plans", authMiddleware, (req, res) => subscriptionController.getPlans(req, res));
router.post("/subscribe", authMiddleware, (req, res) => subscriptionController.subscribe(req, res));
router.get("/check/:userId", authMiddleware, (req, res) => subscriptionController.checkSubscription(req, res));
router.post("/create-order", authMiddleware, (req, res) => subscriptionController.createOrder(req, res));
router.post("/verify-and-subscribe", authMiddleware, (req, res) => subscriptionController.verifyAndSubscribe(req, res));
export default router;