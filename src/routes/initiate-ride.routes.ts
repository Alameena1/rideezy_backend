import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { IInitiateRideController } from "../controllers/interface/ride/iinitiate-ride.controller";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const initiateRideController = container.get<IInitiateRideController>(TYPES.IInitiateRideController);

router.post("/start", authMiddleware, initiateRideController.startRide.bind(initiateRideController));
router.get("/rides", authMiddleware, initiateRideController.getRides.bind(initiateRideController));
router.put('/:rideId', authMiddleware, initiateRideController.editRide.bind(initiateRideController));
router.delete('/:rideId', authMiddleware, initiateRideController.cancelRide.bind(initiateRideController));
router.put("/:rideId/start-tracking", authMiddleware, initiateRideController.startTracking.bind(initiateRideController));
router.put("/:rideId/update", authMiddleware, initiateRideController.updateRide.bind(initiateRideController));

export default router;