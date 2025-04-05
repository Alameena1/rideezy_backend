import { Router, RequestHandler } from "express";
import { AuthController } from "../controllers/implimentation/auth.controller";
import AuthService from "../services/implementation/auth.service";
import authMiddleware from "../middlewares/auth.middleware";

const authService = new AuthService();
const authController = new AuthController(authService);

const router = Router();

const bindHandler = <T extends (...args: any[]) => any>(fn: T): RequestHandler => fn.bind(authController) as RequestHandler;

router.post("/signup", bindHandler(authController.signup));
router.post("/resend-otp", bindHandler(authController.resendOTP));
router.post("/verify-otp", bindHandler(authController.verifyOTP));
router.post("/login", bindHandler(authController.login));
router.post("/refresh-token", bindHandler(authController.refreshToken));
router.post("/logout", bindHandler(authController.logout));
router.post("/google-auth", bindHandler(authController.googleAuth));

router.put("/profile", authMiddleware, bindHandler(authController.updateProfile));
router.get("/profile", authMiddleware, bindHandler(authController.getProfile));

export default router;