import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { IVehicleController } from "../controllers/interface/vehicle/ivehicleController";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const vehicleController = container.get<IVehicleController>(TYPES.IVehicleController);

router.post("/", authMiddleware, vehicleController.addVehicle.bind(vehicleController));
router.get("/", authMiddleware, vehicleController.getVehicles.bind(vehicleController));
router.put("/:id", authMiddleware, vehicleController.updateVehicle.bind(vehicleController)); // New route

export default router;