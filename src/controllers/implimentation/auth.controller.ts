import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import { IAuthController } from "../interface/auth/interface";
import AuthService from "../../services/implementation/auth.service";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";

@injectable()
export class AuthController implements IAuthController {
  private _authService: AuthService;

  constructor(@inject(TYPES.IAuthService) authService: AuthService) {
    this._authService = authService;
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, password } = req.body;
    try {
      console.log("Login attempt:", { email, passwordLength: password?.length });
      if (!email || !password) {
        console.error("Login: Missing email or password", { email, hasPassword: !!password });
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_AND_PASSWORD_REQUIRED });
        return;
      }
      const { accessToken, refreshToken, user } = await this._authService.login(email, password);
      console.log("Login success:", { userId: user.id, email: user.email, role: user.role });

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

      console.log("login success user", user);

      // Include accessToken and refreshToken in the response body
      res.status(StatusCode.OK).json({
        success: true,
        message: ResponseMessages.LOGIN_SUCCESS,
        user,
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      console.error("Login error:", { message: error.message, email: email || "unknown" });
      if (error.message === ResponseMessages.ACCOUNT_BLOCKED) {
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: error.message });
        return;
      }
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.INVALID_CREDENTIALS });
    }
  }

  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this._authService.signup(req.body);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      next(error);
    }
  }

  async resendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_REQUIRED });
        return;
      }
      const response = await this._authService.resendOTP(email);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      next(error);
    }
  }

  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_AND_OTP_REQUIRED });
        return;
      }
      const response = await this._authService.verifyOTP(email, otp);
      console.log("oiowjodjsoidhouh",response)
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.REFRESH_TOKEN_REQUIRED });
      return;
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } = await this._authService.refreshToken(refreshToken);

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // ~30 days
        path: "/",
      });

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });
      res.status(StatusCode.OK).json({ success: true, message: "Token refreshed", accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: "Invalid refresh token" });
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.REFRESH_TOKEN_REQUIRED });
        return;
      }
      await this._authService.logout(token);
      res.clearCookie("accessToken", { path: "/" });
      res.clearCookie("refreshToken", { path: "/" });
      res.status(StatusCode.OK).json({ success: true, message: ResponseMessages.LOGOUT_SUCCESS });
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, email, image, idToken } = req.body as { fullName: string; email: string; image: string; idToken: string };
      if (!fullName || !email || !image || !idToken) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Missing required fields: fullName, email, image, idToken" });
        return;
      }
      const { user, accessToken, refreshToken } = await this._authService.handleGoogleAuth({ fullName, email, image, idToken });

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // ~30 days
        path: "/",
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      res.status(StatusCode.OK).json({
        success: true,
        message: ResponseMessages.GOOGLE_LOGIN_SUCCESS,
        user,
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      console.error("Google auth error:", error.message);
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_REQUIRED });
        return;
      }
      const response = await this._authService.forgotPassword(email);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.TOKEN_AND_NEW_PASSWORD_REQUIRED });
        return;
      }
      const response = await this._authService.resetPassword(token, newPassword);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      next(error);
    }
  }
}