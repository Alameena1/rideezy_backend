import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export interface IVehicleController {
  addVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>; 
}