import { Request, Response } from "express";

export interface IAdminController {
  adminLogin(req: Request, res: Response): Promise<void>;
  refreshToken(req: Request, res: Response): Promise<void>;
  logout(req: Request, res: Response): Promise<void>;
  getUsers(req: Request, res: Response): Promise<void>;
  updateUserStatus(req: Request, res: Response): Promise<void>;
  getVehicles(req: Request, res: Response): Promise<void>;
  updateVehicleStatus(req: Request, res: Response): Promise<void>;
  verifyGovId(req: Request, res: Response): Promise<void>;
  createSubscriptionPlan(req: Request, res: Response): Promise<void>;
  updateSubscriptionPlan(req: Request, res: Response): Promise<void>;
  deleteSubscriptionPlan(req: Request, res: Response): Promise<void>;
  getSubscriptionPlans(req: Request, res: Response): Promise<void>;
  updateSubscriptionPlanStatus(req: Request, res: Response): Promise<void>;
  getRideDetails(req: Request, res: Response): Promise<void>;
  blockRide(req: Request, res: Response): Promise<void>;
  cancelRide(req: Request, res: Response): Promise<void>;
  getAllRides(req: Request, res: Response): Promise<void>;
}