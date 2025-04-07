import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export interface IUserController {
  getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}