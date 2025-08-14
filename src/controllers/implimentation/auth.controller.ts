import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import { IAuthController } from "../interface/auth/interface";
import AuthService from "../../services/implementation/auth.service";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";

@injectable()
export class AuthController implements IAuthController {
  private authService: AuthService;

  constructor(@inject(TYPES.IAuthService) authService: AuthService) {
    this.authService = authService;
  }

  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.authService.signup(req.body);
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
      const response = await this.authService.resendOTP(email);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      next(error);
    }
  }

  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {   
    console.log("dshcbdshicbsdhic")
    try {
      const { email, otp } = req.body;
   
      if (!email || !otp) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_AND_OTP_REQUIRED });
        return;
      }
      const response = await this.authService.verifyOTP(email, otp);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      console.log(error)
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_AND_PASSWORD_REQUIRED });
        return;
      }
      const tokens = await this.authService.login(email, password);
      res.status(StatusCode.OK).json({ success: true, message: ResponseMessages.LOGIN_SUCCESS, ...tokens });
    } catch (error: any) {
      if (error.message === ResponseMessages.ACCOUNT_BLOCKED) {
        res.status(StatusCode.FORBIDDEN).json({ success: false, message: error.message });
        return;
      }
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.INVALID_CREDENTIALS });
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.REFRESH_TOKEN_REQUIRED });
        return;
      }
      const newToken = await this.authService.refreshToken(refreshToken);
      res.status(StatusCode.OK).json({ success: true, ...newToken });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.REFRESH_TOKEN_REQUIRED });
        return;
      }
      await this.authService.logout(token);
      res.status(StatusCode.OK).json({ success: true, message: ResponseMessages.LOGOUT_SUCCESS });
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, email, image } = req.body as { fullName: string; email: string; image: string };
      if (!fullName || !email || !image) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }
      const user = await this.authService.handleGoogleAuth({ fullName, email, image });
      res.status(StatusCode.OK).json({
        success: true,
        message: ResponseMessages.GOOGLE_LOGIN_SUCCESS,
        user: user.user,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.EMAIL_REQUIRED });
        return;
      }
      const response = await this.authService.forgotPassword(email);
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
      const response = await this.authService.resetPassword(token, newPassword);
      res.status(StatusCode.OK).json(response);
    } catch (error) {
      next(error);
    }
  }
}
