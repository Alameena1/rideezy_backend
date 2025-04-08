
import { Router } from "express";
import container from "../di/container";
import { TYPES } from "../di/types";
import { IUserController } from "../controllers/interface/user/interface";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();
const userController = container.get<IUserController>(TYPES.IUserController);

router.get("/profile", authMiddleware, userController.getProfile.bind(userController));
router.put("/profile", authMiddleware, userController.updateProfile.bind(userController));

export default router;