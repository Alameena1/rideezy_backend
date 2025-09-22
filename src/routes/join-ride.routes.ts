import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { IJoinRideController } from "../controllers/interface/ride/ijoin-ride.controller";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const joinRideController = container.get<IJoinRideController>(TYPES.IJoinRideController);

router.post("/join", authMiddleware, joinRideController.joinRide.bind(joinRideController));
router.get("/joined", authMiddleware, joinRideController.getJoinedRides.bind(joinRideController));
router.post("/nearest", authMiddleware, joinRideController.findNearestRides.bind(joinRideController));
router.post("/create-ride-order", authMiddleware, joinRideController.createRidePaymentOrder.bind(joinRideController));
router.post("/verify-and-join", authMiddleware, joinRideController.verifyAndJoinRide.bind(joinRideController));
router.delete('/joined/:rideId', authMiddleware, joinRideController.cancelJoinedRide.bind(joinRideController));
router.put("/:rideId/requests/:passengerId", authMiddleware, joinRideController.handleJoinRequest.bind(joinRideController));

export default router;