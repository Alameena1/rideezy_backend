import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { IRideController } from "../controllers/interface/ride/irideController";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const rideController = container.get<IRideController>(TYPES.IRideController);

router.post("/start", authMiddleware, rideController.startRide.bind(rideController));
router.post("/join", authMiddleware, rideController.joinRide.bind(rideController));
router.get("/rides", authMiddleware, rideController.getRides.bind(rideController));
router.post("/nearest", authMiddleware, rideController.findNearestRides.bind(rideController));
router.post("/create-ride-order", authMiddleware, rideController.createRidePaymentOrder.bind(rideController));
router.post("/verify-and-join", authMiddleware, rideController.verifyAndJoinRide.bind(rideController));
router.get("/joined", authMiddleware, rideController.getJoinedRides.bind(rideController));

export default router;