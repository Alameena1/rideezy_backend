import { Request, Response } from "express"; // Import specific Express types

export interface IAdminController {
  adminLogin(req: Request, res: Response): Promise<void>;
  refreshToken(req: Request, res: Response): Promise<void>;
  logout(req: Request, res: Response): Promise<void>;
  getUsers(req: Request, res: Response): Promise<void>;
  toggleUserStatus(req: Request, res: Response): Promise<void>;
  getVehicles(req: Request, res: Response): Promise<void>;
  updateVehicleStatus(req: Request, res: Response): Promise<void>;
}