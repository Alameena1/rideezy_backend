import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../types/express";

export interface IInitiateRideController {
  startRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  editRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  cancelRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  startTracking(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}