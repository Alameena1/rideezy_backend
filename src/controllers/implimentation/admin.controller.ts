import { Request, Response } from "express";
import { IAdminService } from "../../services/interfaces/admin/interface";
import { IAdminController } from "../interface/admin/interface";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import jwt from "jsonwebtoken";
import { generateAccessToken } from "../../helpers/jwt.util";

@injectable()
export class AdminController implements IAdminController {
  private adminService: IAdminService;

  constructor(@inject(TYPES.IAdminService) adminService: IAdminService) {
    this.adminService = adminService;
  }

  adminLogin = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    try {
      const { accessToken, refreshToken } = await this.adminService.authenticateAdmin(email, password);
    console.log("eouyfgb",accessToken)

      res.cookie("adminAuthToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
        path: "/",
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.status(200).json({ message: "Login successful" });
    } catch (error) {
      res.status(401).json({ message: "Invalid credentials" });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ message: "No refresh token" });
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { email: string };
      const newAccessToken = generateAccessToken(decoded.email);

      res.cookie("adminAuthToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
        path: "/",
      });

      res.status(200).json({ message: "Token refreshed" });
    } catch (error) {
      res.status(401).json({ message: "Invalid refresh token" });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { email: string };
        // If using refresh token rotation with a database, invalidate the refresh token
        await this.adminService.invalidateRefreshToken?.(decoded.email, refreshToken);
      } catch (error) {
        console.error("Error verifying refresh token during logout:", error);
      }
    }

    res.clearCookie("adminAuthToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });
    res.status(200).json({ message: "Logged out successfully" });
  };

  getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.adminService.getAllUsers();
      res.status(200).json({ message: "Users retrieved successfully", users });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve users" });
    }
  };

  toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { status } = req.body;
    try {
      await this.adminService.toggleUserStatus(userId, status);
      res.status(200).json({ message: `User status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user status" });
    }
  };

  getVehicles = async (req: Request, res: Response): Promise<void> => {
    try {
      const vehicles = await this.adminService.getAllVehicles();
      res.status(200).json({ message: "Vehicles retrieved successfully", vehicles });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve vehicles" });
    }
  };

  updateVehicleStatus = async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const { status, note } = req.body;
    try {
      await this.adminService.updateVehicleStatus(vehicleId, status, note);
      res.status(200).json({ message: `Vehicle status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to update vehicle status" });
    }
  };
}