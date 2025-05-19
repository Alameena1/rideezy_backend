// src/controllers/implementation/admin.controller.ts
import { Request, Response } from "express";
import { IAdminService } from "../../services/interfaces/admin/interface";
import { IAdminController } from "../interface/admin/interface";
import { injectable, inject } from "inversify";
import { TYPES } from "../../di/types";
import { generateAccessToken, verifyRefreshToken } from "../../helpers/jwt.util";
import { ISubscriptionPlan } from "../../models/SubscriptionPlan";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role?: string };
}

@injectable()
export class AdminController implements IAdminController {
  private adminService: IAdminService;

  constructor(@inject(TYPES.IAdminService) adminService: IAdminService) {
    this.adminService = adminService;
  }

  adminLogin = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    console.log("Request body:", req.body);

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    try {
      const { accessToken, refreshToken } = await this.adminService.authenticateAdmin(email, password);
      console.log("Tokens generated:", accessToken, refreshToken);

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
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Authentication error:", err.message);
      if (err.message === "Email and password are required") {
        res.status(400).json({ message: "Email and password are required" });
        return;
      }
      if (err.message === "Invalid credentials") {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }
      res.status(500).json({ message: "Server error" });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ message: "No refresh token" });
      return;
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);
      const newAccessToken = generateAccessToken(decoded.userId, decoded.userId);

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
        const decoded = verifyRefreshToken(refreshToken);
        await this.adminService.invalidateRefreshToken?.(decoded.userId, refreshToken);
      } catch (error) {
        console.error("Error verifying refresh token during logout:", error);
      }
    }

    res.clearCookie("adminAuthToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });
    res.status(200).json({ message: "Logged out successfully" });
  };

  getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const users = await this.adminService.getAllUsers();
      res.status(200).json({ message: "Users retrieved successfully", users });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve users" });
    }
  };

  updateUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { status } = req.body;
    try {
      await this.adminService.updateUserStatus(userId, status); // Renamed to match AdminService
      res.status(200).json({ message: `User status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user status" });
    }
  };

  getVehicles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const vehicles = await this.adminService.getAllVehicles();
      res.status(200).json({ message: "Vehicles retrieved successfully", vehicles });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve vehicles" });
    }
  };

  updateVehicleStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const { status, note } = req.body;
    try {
      await this.adminService.updateVehicleStatus(vehicleId, status, note);
      res.status(200).json({ message: `Vehicle status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to update vehicle status" });
    }
  };

  verifyGovId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, status } = req.body;

      if (!userId || !status || !["Verified", "Rejected"].includes(status)) {
        res.status(400).json({ success: false, message: "Invalid userId or status" });
        return;
      }

      const updatedUser = await this.adminService.verifyGovId(userId, status);
      res.status(200).json({
        success: true,
        message: `Government ID ${status.toLowerCase()} successfully`,
        user: updatedUser,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  async createSubscriptionPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const planData: Partial<ISubscriptionPlan> = req.body;
      if (!planData.name || !planData.durationMonths || !planData.price || !planData.description) {
        res.status(400).json({ success: false, message: "All plan fields are required" });
        return;
      }
      const plan = await this.adminService.createSubscriptionPlan(planData);
      res.status(201).json({ success: true, message: "Subscription plan created", plan });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async updateSubscriptionPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const planData: Partial<ISubscriptionPlan> = req.body;
      const plan = await this.adminService.updateSubscriptionPlan(planId, planData);
      res.status(200).json({ success: true, message: "Subscription plan updated", plan });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async deleteSubscriptionPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      await this.adminService.deleteSubscriptionPlan(planId);
      res.status(200).json({ success: true, message: "Subscription plan deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async getSubscriptionPlans(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const plans = await this.adminService.getSubscriptionPlans();
      res.status(200).json({ success: true, plans });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async updateSubscriptionPlanStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const { status } = req.body;
      if (!["Active", "Blocked"].includes(status)) {
        res.status(400).json({ success: false, message: "Invalid status" });
        return;
      }
      await this.adminService.updateSubscriptionPlanStatus(planId, status);
      res.status(200).json({ success: true, message: `Plan status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}