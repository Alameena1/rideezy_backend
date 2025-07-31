import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { ITrackingController } from "../controllers/interface/tracking/itrackingController";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const trackingController = container.get<ITrackingController>(TYPES.ITrackingController);

router.post("/:rideId/start", authMiddleware, trackingController.startTracking.bind(trackingController));
router.put("/:rideId/position", authMiddleware, trackingController.updateTrackingPosition.bind(trackingController));
router.get("/:rideId/position", authMiddleware, trackingController.getTrackingPosition.bind(trackingController));
router.put("/:rideId/stop", authMiddleware, trackingController.stopTracking.bind(trackingController));
router.get("/:rideId/status", authMiddleware, trackingController.getTrackingStatus.bind(trackingController)); 

export default router; 