import { Request, Response, NextFunction } from "express";
import UserService from "../../services/implementation/user.service";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export class UserController {
  private userService: UserService;

  constructor(userService: UserService) {
    this.userService = userService;
  }

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const user = await this.userService.getProfile(userId);
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
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const updatedUser = await this.userService.updateProfile(userId, updatedData);
      res.status(200).json({ success: true, message: "Profile updated successfully", user: updatedUser });
    } catch (error) {
      next(error);
    }
  }
}