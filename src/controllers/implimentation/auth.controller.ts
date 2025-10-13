import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import { IAuthController } from "../interface/auth/interface";
import AuthService from "../../services/implementation/auth.service";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";
import logger from "../../config/logger";

@injectable()
export class AuthController implements IAuthController {
  private _authService: AuthService;

  constructor(@inject(TYPES.IAuthService) authService: AuthService) {
    this._authService = authService;
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, password } = req.body;
    try {
      logger.info("Login attempt:", { email, passwordLength: password?.length });
      
      if (!email || !password) {
        logger.warn("Login: Missing email or password", { email, hasPassword: !!password });
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_AND_PASSWORD_REQUIRED });
        return;
      }
      
      const { accessToken, refreshToken, user } = await this._authService.login(email, password);
      logger.info("Login success:", { userId: user.id, email: user.email, role: user.role });

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      logger.debug("Login response prepared for user:", { userId: user.id });
      
      res.status(StatusCode.OK).json({
        success: true,
        message: ResponseMessages.LOGIN_SUCCESS,
        user,
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      logger.error("Login error:", { message: error.message, email: email || "unknown" });
      
      if (error.message === ResponseMessages.ACCOUNT_BLOCKED) {
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: error.message });
        return;
      }
      
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.INVALID_CREDENTIALS });
    }
  }

  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info("Signup request received");
      const response = await this._authService.signup(req.body);
      logger.info("Signup processed successfully");
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      logger.error("Signup error:", error);
      next(error);
    }
  }

  async resendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        logger.warn("Resend OTP: Missing email");
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_REQUIRED });
        return;
      }
      
      logger.info(`Resend OTP request for: ${email}`);
      const response = await this._authService.resendOTP(email);
      logger.info(`OTP resent successfully for: ${email}`);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      logger.error("Resend OTP error:", error);
      next(error);
    }
  }

  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        logger.warn("Verify OTP: Missing email or OTP");
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_AND_OTP_REQUIRED });
        return;
      }
      
      logger.info(`OTP verification attempt for: ${email}`);
      const response = await this._authService.verifyOTP(email, otp);
      logger.info(`OTP verified successfully for: ${email}`);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      logger.error("Verify OTP error:", error);
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      logger.warn("Refresh token: No token provided in cookies");
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.REFRESH_TOKEN_REQUIRED });
      return;
    }

    try {
      logger.debug("Refresh token request received");
      const { accessToken, refreshToken: newRefreshToken } = await this._authService.refreshToken(refreshToken);

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });
      
      logger.info("Tokens refreshed successfully");
      res.status(StatusCode.OK).json({ success: true, message: "Token refreshed", accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      logger.error("Refresh token error:", error);
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: "Invalid refresh token" });
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        logger.warn("Logout: Missing refresh token");
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.REFRESH_TOKEN_REQUIRED });
        return;
      }
      
      logger.info("Logout request received");
      await this._authService.logout(token);
      res.clearCookie("accessToken", { path: "/" });
      res.clearCookie("refreshToken", { path: "/" });
      
      logger.info("Logout completed successfully");
      res.status(StatusCode.OK).json({ success: true, message: ResponseMessages.LOGOUT_SUCCESS });
    } catch (error) {
      logger.error("Logout error:", error);
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, email, image, idToken } = req.body as { fullName: string; email: string; image: string; idToken: string };
      
      if (!fullName || !email || !image || !idToken) {
        logger.warn("Google auth: Missing required fields", { fullName: !!fullName, email: !!email, image: !!image, idToken: !!idToken });
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Missing required fields: fullName, email, image, idToken" });
        return;
      }
      
      logger.info(`Google auth attempt for: ${email}`);
      const { user, accessToken, refreshToken } = await this._authService.handleGoogleAuth({ fullName, email, image, idToken });

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      logger.info(`Google auth successful for user: ${user.id}`);
      res.status(StatusCode.OK).json({
        success: true,
        message: ResponseMessages.GOOGLE_LOGIN_SUCCESS,
        user,
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      logger.error("Google auth error:", error);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        logger.warn("Forgot password: Missing email");
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_REQUIRED });
        return;
      }
      
      logger.info(`Forgot password request for: ${email}`);
      const response = await this._authService.forgotPassword(email);
      logger.info(`Password reset email sent to: ${email}`);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      logger.error("Forgot password error:", error);
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        logger.warn("Reset password: Missing token or new password");
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.TOKEN_AND_NEW_PASSWORD_REQUIRED });
        return;
      }
      
      logger.info("Password reset attempt");
      const response = await this._authService.resetPassword(token, newPassword);
      logger.info("Password reset successful");
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      logger.error("Reset password error:", error);
      next(error);
    }
  }
}