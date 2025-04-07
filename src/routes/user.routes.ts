import { Router } from "express";
import { UserController } from "../controllers/implimentation/user.controller";
import UserService from "../services/implementation/user.service";
import authMiddleware from "../middlewares/auth.middleware";

const userService = new UserService();
const userController = new UserController(userService);
const router = Router();

router.get("/profile", authMiddleware, userController.getProfile.bind(userController));
router.put("/profile", authMiddleware, userController.updateProfile.bind(userController));

export default router;