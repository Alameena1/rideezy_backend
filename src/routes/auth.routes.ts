import { Router } from "express";
import { AuthController } from "../controllers/implimentation/auth.controller";
import AuthService from "../services/implementation/auth.service";

const authService = new AuthService();
const authController = new AuthController(authService);
const router = Router();

router.post("/signup", authController.signup.bind(authController));
router.post("/resend-otp", authController.resendOTP.bind(authController));
router.post("/verify-otp", authController.verifyOTP.bind(authController));
router.post("/login", authController.login.bind(authController));
router.post("/refresh-token", authController.refreshToken.bind(authController));
router.post("/logout", authController.logout.bind(authController));
router.post("/google-auth", authController.googleAuth.bind(authController));

export default router;