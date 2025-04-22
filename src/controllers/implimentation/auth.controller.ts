import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import { IAuthController } from "../interface/auth/interface";
import AuthService from "../../services/implementation/auth.service";

@injectable()
export class AuthController implements IAuthController {
  private authService: AuthService;

  constructor(@inject(TYPES.IAuthService) authService: AuthService) {
    this.authService = authService;
  }

  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.authService.signup(req.body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async resendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: "Email is required" });
        return;
      }
      const response = await this.authService.resendOTP(email);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        res.status(400).json({ success: false, message: "Email and OTP are required" });
        return;
      }
      const response = await this.authService.verifyOTP(email, otp);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
   console.log("email and password",email, password)
      if (!email || !password) {
        res.status(400).json({ success: false, message: "Email and password are required" });
        return;
      }
      const tokens = await this.authService.login(email, password); 
        
      res.status(200).json({ success: true, message: "Login successful", ...tokens });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ success: false, message: "Refresh token required" });
        return;
      }
      const newToken = await this.authService.refreshToken(refreshToken);
      res.status(200).json({ success: true, ...newToken });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ success: false, message: "Refresh token required" });
        return;
      }
      await this.authService.logout(token);
      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, email, image } = req.body as { fullName: string; email: string; image: string };
      if (!fullName || !email || !image) {
        res.status(400).json({ success: false, message: "Missing required fields" });
        return;
      }

      const user = await this.authService.handleGoogleAuth({ fullName, email, image });
      res.status(200).json({
        success: true,
        message: "Google login successful",
        user: user.user,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }
}