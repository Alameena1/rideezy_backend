import { Router } from "express";
import  container  from "../di/container";
import { TYPES } from "../di/types";
import { ISubscriptionController } from "../controllers/interface/subscription/isubscriptionController";

const router = Router();
const subscriptionController = container.get<ISubscriptionController>(TYPES.ISubscriptionController);

// Get all subscription plans
router.get("/plans", (req, res) => subscriptionController.getPlans(req, res));

// Subscribe to a plan
router.post("/subscribe", (req, res) => subscriptionController.subscribe(req, res));

// Check subscription status
router.get("/check/:userId", (req, res) => subscriptionController.checkSubscription(req, res));

export default router;