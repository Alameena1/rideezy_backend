import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { IAdminService } from "../../services/interfaces/admin/interface";
import { TYPES } from "../../di/types";
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from "../../helpers/jwt.util";
import { IAdminController } from "../interface/admin/interface";

interface AuthenticatedRequest extends Request {
  admin?: { userId: string; email: string; role: string };
}

@injectable()
export class AdminController implements IAdminController {
  constructor(@inject(TYPES.IAdminService) private adminService: IAdminService) {}

  adminLogin = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
      const { accessToken, refreshToken } = await this.adminService.authenticateAdmin(email, password);

      res.cookie("adminAuthToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: "/",
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      res.status(200).json({ success: true, message: "Login successful", accessToken });
    } catch (error: any) {
      console.error("Admin login error:", error.message);
      res.status(401).json({ success: false, message: error.message || "Invalid email or password" });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(401).json({ success: false, message: "No refresh token provided" });
      return;
    }

    try {
      const decoded = verifyRefreshToken(refreshToken, "admin");
      const newAccessToken = generateAccessToken(decoded.userId, decoded.email || "", "admin");
      const newRefreshToken = generateRefreshToken(decoded.userId, "admin");

      await this.adminService.saveRefreshToken(decoded.userId, newRefreshToken);

      res.cookie("adminAuthToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
        path: "/",
      });

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.status(200).json({ success: true, message: "Token refreshed", token: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const refreshToken = req.body.refreshToken;
    try {
      if (refreshToken && req.admin?.userId) {
        await this.adminService.invalidateRefreshToken(req.admin.userId, refreshToken);
      }
      res.clearCookie("adminAuthToken", { path: "/" });
      res.clearCookie("refreshToken", { path: "/" });
      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const users = await this.adminService.getAllUsers();
      console.log("Retrieved users:", users);
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  updateUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId, status } = req.body;

    try {
      await this.adminService.updateUserStatus(userId, status);
      res.status(200).json({ success: true, message: `User status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  getVehicles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const vehicles = await this.adminService.getAllVehicles();
      res.status(200).json(vehicles);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  // In AdminController.ts
updateVehicleStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { vehicleId } = req.params; // Get vehicleId from URL params
  const { status, note } = req.body; // Get status and note from request body
  
  console.log("Updating vehicle status:", { vehicleId, status, note });

  try {
    await this.adminService.updateVehicleStatus(vehicleId, status, note);
    res.status(200).json({ success: true, message: `Vehicle status updated to ${status}` });
  } catch (error) {
    console.error("Error updating vehicle status:", error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

  verifyGovId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId, status, rejectionNote } = req.body;
    try {
      const user = await this.adminService.verifyGovId(userId, status, rejectionNote);
      res.status(200).json({ success: true, message: `Government ID ${status}`, user });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  createSubscriptionPlan = async (req: Request, res: Response): Promise<void> => {
    const planData = req.body;
    try {
      const plan = await this.adminService.createSubscriptionPlan(planData);
      res.status(201).json({ success: true, message: "Subscription plan created", plan });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  updateSubscriptionPlan = async (req: Request, res: Response): Promise<void> => {
    const { planId } = req.params;
    const planData = req.body;
    try {
      const plan = await this.adminService.updateSubscriptionPlan(planId, planData);
      res.status(200).json({ success: true, message: "Subscription plan updated", plan });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  deleteSubscriptionPlan = async (req: Request, res: Response): Promise<void> => {
    const { planId } = req.params;
    try {
      await this.adminService.deleteSubscriptionPlan(planId);
      res.status(200).json({ success: true, message: "Subscription plan deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  getSubscriptionPlans = async (req: Request, res: Response): Promise<void> => {
    try {
      const plans = await this.adminService.getSubscriptionPlans();
      res.status(200).json(plans);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

updateSubscriptionPlanStatus = async (req: Request, res: Response): Promise<void> => {
  const { planId } = req.params; // Get planId from URL params
  const { status } = req.body;   // Get status from request body

  try {
    await this.adminService.updateSubscriptionPlanStatus(planId, status);
    res.status(200).json({ success: true, message: `Subscription plan status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

  getRideDetails = async (req: Request, res: Response): Promise<void> => {
    const { rideId } = req.params;
    try {
      const ride = await this.adminService.getRideDetails(rideId);
      res.status(200).json(ride);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  blockRide = async (req: Request, res: Response): Promise<void> => {
    const { rideId } = req.params;
    try {
      await this.adminService.updateRideStatus(rideId, "Blocked");
      res.status(200).json({ success: true, message: "Ride blocked" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  cancelRide = async (req: Request, res: Response): Promise<void> => {
    const { rideId } = req.params;
    try {
      await this.adminService.updateRideStatus(rideId, "Cancelled");
      res.status(200).json({ success: true, message: "Ride cancelled" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  getAllRides = async (req: Request, res: Response): Promise<void> => {
    try {
      const rides = await this.adminService.getAllRides();
      res.status(200).json(rides);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  getDashboardData = async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    try {
      const metrics = await this.adminService.getDashboardMetrics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.status(200).json(metrics);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };

  getDashboardMetrics = async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    try {
      const metrics = await this.adminService.getDashboardMetrics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.status(200).json(metrics);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  };
}
