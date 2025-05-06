// src/controllers/interface/admin/interface.ts
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
}