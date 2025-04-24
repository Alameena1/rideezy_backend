import { Router } from "express";
import container from "../di/container"; 
import { IAuthController } from "../controllers/interface/auth/interface"; 
import { TYPES } from "../di/types"; 

const router = Router();


const authController = container.get<IAuthController>(TYPES.IAuthController);

router.post("/signup", authController.signup.bind(authController));
router.post("/resend-otp", authController.resendOTP.bind(authController));
router.post("/verify-otp", authController.verifyOTP.bind(authController));
router.post("/login", authController.login.bind(authController));
router.post("/refresh-token", authController.refreshToken.bind(authController));
router.post("/logout", authController.logout.bind(authController));
router.post("/google-auth", authController.googleAuth.bind(authController));

export default router;