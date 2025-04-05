import { Request, Response, NextFunction } from "express";
import AuthService from "../../services/implementation/auth.service";
import AccessToken from "twilio/lib/jwt/AccessToken";


interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
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
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
      } else {
        res.status(500).json({ success: false, message: "Failed to resend OTP" });
      }
    }
  }

  async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      if(email){

      }
      if(!otp){
        // thorw new error
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

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const tokens = await this.authService.login(email, password);

    res.json({ message: "Login successful", ...tokens });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Your account has been blocked. Contact support.") {
        res.status(403).json({ message: error.message });
      } else {
        res.status(401).json({ message: error.message }); 
      }
    } else {
      res.status(500).json({ message: "Authentication failed" }); 
    }
  }
}

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ message: "Refresh token required" });
        return;
      }
  
      const newToken = await this.authService.refreshToken(refreshToken);
      res.status(200).json(newToken);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Invalid refresh token") {
        res.status(401).json({ message: "Invalid or expired refresh token" });
      } else {
        next(error);
      }
    }
  }
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ message: "Refresh token required" });
        return;
      }

      await this.authService.logout(token);
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, image } = req.body;
      if (!name || !email || !image) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      const user = await this.authService.handleGoogleAuth({ fullName: name, email, image });
      res.status(200).json({ message: "Google login successful", User: user,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,});
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const user = await this.authService.getProfile(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const updatedData = req.body;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const updatedUser = await this.authService.updateProfile(userId, updatedData);
      res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
    } catch (error) {
      next(error);
    }
  }
}