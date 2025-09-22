import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../types/express";

export interface IJoinRideController {
  joinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getJoinedRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  findNearestRides(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  createRidePaymentOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  verifyAndJoinRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  cancelJoinedRide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  handleJoinRequest(req: AuthenticatedRequest, res: Response): Promise<void>;
}