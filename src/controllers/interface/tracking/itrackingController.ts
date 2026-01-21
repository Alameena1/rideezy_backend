import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../types/express"; 

export interface ITrackingController {
  startTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateTrackingPosition(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getTrackingPosition(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  stopTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getTrackingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}