import { Request, Response, NextFunction } from "express";
import { IUser } from "../../../models/user.model";

export interface IAuthController {
  signup(req: Request, res: Response, next: NextFunction): Promise<void>;
  resendOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
  verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
  login(req: Request, res: Response, next: NextFunction): Promise<void>;
  refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
  logout(req: Request, res: Response, next: NextFunction): Promise<void>;
  googleAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
}