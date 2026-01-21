import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { IAdminService } from "../../services/interfaces/admin/interface";
import { TYPES } from "../../di/types";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
} from "../../helpers/jwt.util";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";
import { z } from "zod";
import {
  AdminLoginDto,
  BlockRideSchema,
  UnblockRideSchema,
  CreateSubscriptionPlanDto,
  DashboardMetricsQueryDto,
  GovIdVerificationDto,
  LogoutDto,
  PaginationQueryDtoType,
  RefreshTokenDto,
  RideSearchQueryDto,
  RideSearchQueryDtoType,
  SubscriptionPlanStatusDto,
  UpdateSubscriptionPlanDto,
  UserSearchQueryDto,
  UserSearchQueryDtoType,
  UserStatusDto,
  VehicleSearchQueryDto,
  VehicleSearchQueryDtoType,
  VehicleStatusDto,
  UserResponseDto,
} from "../../dtos/admin.dto";
import { IAdminController } from "../interface/admin/interface";
import AdminModel from "../../models/admin";

interface AuthenticatedRequest extends Request {
  admin?: { userId: string; email: string; role: string };
}

@injectable()
export class AdminController implements IAdminController {
  constructor(
    @inject(TYPES.IAdminService) private _adminService: IAdminService
  ) {}

  private validateRequest<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");
        throw new Error(`Validation failed: ${errorMessage}`);
      }
      throw error;
    }
  }

  private ensureRequiredParams<T extends PaginationQueryDtoType>(params: T): T {
    return {
      ...params,
      page: params.page || 1,
      limit: params.limit || 10,
      sortOrder: params.sortOrder || "desc",
    };
  }

getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const queryParams = this.validateRequest(UserSearchQueryDto, req.query);
    const ensuredParams = this.ensureRequiredParams(queryParams);

    const result = await this._adminService.getAllUsers(ensuredParams);

    // Ensure consistent response structure
    res.status(StatusCode.OK).json({
      success: true,
      message: "Users fetched successfully",
      data: result.data,
      pagination: {
        currentPage: result.pagination.currentPage,
        totalPages: result.pagination.totalPages,
        totalItems: result.pagination.totalItems,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev,
      },
    });
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(StatusCode.BAD_REQUEST).json({
      success: false,
      message: (error as Error).message,
    });
  }
};

  getVehicles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const queryParams = this.validateRequest(VehicleSearchQueryDto, req.query);
      const ensuredParams = this.ensureRequiredParams(queryParams);

      const result = await this._adminService.getAllVehicles(ensuredParams);

      res.status(StatusCode.OK).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  getAllRides = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParams = this.validateRequest(RideSearchQueryDto, req.query);
      const ensuredParams = this.ensureRequiredParams(queryParams);

      const result = await this._adminService.getAllRides(ensuredParams);

      res.status(StatusCode.OK).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  adminLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginData = this.validateRequest(AdminLoginDto, req.body);

      console.log("🔐 Admin login attempt:", { email: loginData.email });

      const { accessToken, refreshToken } = await this._adminService.authenticateAdmin(
        loginData.email,
        loginData.password
      );

      // Get admin details directly from database
      const admin = await AdminModel.findOne({ email: loginData.email }).select('-password').lean();
      if (!admin) {
        throw new Error("Admin not found");
      }

      console.log("✅ Admin login successful:", { adminId: admin._id, email: admin.email });

      // Return the EXACT SAME structure as user login
      res.status(StatusCode.OK).json({
        success: true,
        message: ResponseMessages.LOGIN_SUCCESS,
        accessToken,
        refreshToken,
        user: {
          id: admin._id.toString(), // Use the ID from the database query
          email: admin.email,
          role: "admin",
          fullName: "Administrator"
        }
      });

    } catch (error: any) {
      console.error("❌ Admin login error:", error.message);
      res.status(StatusCode.UNAUTHORIZED).json({
        success: false,
        message: error.message || ResponseMessages.INVALID_CREDENTIALS,
      });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = this.validateRequest(RefreshTokenDto, req.body);

      const decoded = verifyRefreshToken(refreshToken, "admin");
      const newAccessToken = generateAccessToken(
        decoded.userId,
        decoded.email || "",
        "admin"
      );
      const newRefreshToken = generateRefreshToken(decoded.userId, "admin");

      await this._adminService.saveRefreshToken(decoded.userId, newRefreshToken);

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

      res.status(StatusCode.OK).json({
        success: true,
        message: "Token refreshed",
        token: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(StatusCode.UNAUTHORIZED).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { refreshToken } = this.validateRequest(LogoutDto, req.body);

      if (refreshToken && req.admin?.userId) {
        await this._adminService.invalidateRefreshToken(
          req.admin.userId,
          refreshToken
        );
      }

      res.clearCookie("adminAuthToken", { path: "/" });
      res.clearCookie("refreshToken", { path: "/" });

      res.status(StatusCode.OK).json({
        success: true,
        message: ResponseMessages.LOGOUT_SUCCESS,
      });
    } catch (error) {
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  updateUserStatus = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const updateData = this.validateRequest(UserStatusDto, req.body);

      if (!userId) {
        throw new Error("User ID is required in URL path");
      }

      await this._adminService.updateUserStatus(userId, updateData.status);

      res.status(StatusCode.OK).json({
        success: true,
        message: `User status updated to ${updateData.status}`,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  updateVehicleStatus = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { vehicleId } = req.params;
      const updateData = this.validateRequest(VehicleStatusDto, {
        vehicleId,
        ...req.body,
      });

      await this._adminService.updateVehicleStatus(
        updateData.vehicleId,
        updateData.status,
        updateData.note
      );

      res.status(StatusCode.OK).json({
        success: true,
        message: `Vehicle status updated to ${updateData.status}`,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  verifyGovId = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const verificationData = this.validateRequest(
        GovIdVerificationDto,
        req.body
      );

      const user = await this._adminService.verifyGovId(
        verificationData.userId,
        verificationData.status,
        verificationData.rejectionNote
      );

      res.status(StatusCode.OK).json({
        success: true,
        message: `Government ID ${verificationData.status}`,
        user,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  createSubscriptionPlan = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const planData = this.validateRequest(
        CreateSubscriptionPlanDto,
        req.body
      );

      const plan = await this._adminService.createSubscriptionPlan(planData);

      res.status(StatusCode.CREATED).json({
        success: true,
        message: "Subscription plan created",
        plan,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  updateSubscriptionPlan = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { planId } = req.params;
      const planData = this.validateRequest(
        UpdateSubscriptionPlanDto,
        req.body
      );

      const plan = await this._adminService.updateSubscriptionPlan(
        planId,
        planData
      );

      res.status(StatusCode.OK).json({
        success: true,
        message: "Subscription plan updated",
        plan,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  updateSubscriptionPlanStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { planId } = req.params;
      const { status } = this.validateRequest(
        SubscriptionPlanStatusDto,
        req.body
      );

      await this._adminService.updateSubscriptionPlanStatus(planId, status);

      res.status(StatusCode.OK).json({
        success: true,
        message: `Subscription plan status updated to ${status}`,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  getDashboardMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParams = this.validateRequest(
        DashboardMetricsQueryDto,
        req.query
      );

      const metrics = await this._adminService.getDashboardMetrics({
        startDate: queryParams.startDate
          ? new Date(queryParams.startDate)
          : undefined,
        endDate: queryParams.endDate
          ? new Date(queryParams.endDate)
          : undefined,
      });

      res.status(StatusCode.OK).json({
        success: true,
        ...metrics,
      });
    } catch (error) {
      res.status(StatusCode.BAD_REQUEST).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  deleteSubscriptionPlan = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const { planId } = req.params;

    if (!planId) {
      res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    try {
      await this._adminService.deleteSubscriptionPlan(planId);
      res
        .status(StatusCode.OK)
        .json({ success: true, message: "Subscription plan deleted" });
    } catch (error) {
      res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: (error as Error).message });
    }
  };

getSubscriptionPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const queryParams = this.validateRequest(UserSearchQueryDto, req.query);
    const ensuredParams = this.ensureRequiredParams(queryParams);

    const result = await this._adminService.getSubscriptionPlans(ensuredParams);

    res.status(StatusCode.OK).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(StatusCode.BAD_REQUEST).json({
      success: false,
      message: (error as Error).message,
    });
  }
};

  getRideDetails = async (req: Request, res: Response): Promise<void> => {
    const { rideId } = req.params;

    if (!rideId) {
      res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    try {
      const ride = await this._adminService.getRideDetails(rideId);
      res.status(StatusCode.OK).json(ride);
    } catch (error) {
      res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: (error as Error).message });
    }
  };

  // UPDATED: Block ride with detailed information
  blockRide = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { rideId } = req.params;

    if (!rideId) {
      res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    try {
      const blockData = this.validateRequest(BlockRideSchema, req.body);
      
      if (!req.admin?.userId) {
        throw new Error("Admin authentication required");
      }

      await this._adminService.blockRide(rideId, blockData, req.admin.userId);
      
      res
        .status(StatusCode.OK)
        .json({ 
          success: true, 
          message: "Ride blocked successfully",
          blockDetails: blockData
        });
    } catch (error) {
      console.error("Error blocking ride:", error);
      res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: (error as Error).message });
    }
  };

  // NEW: Unblock ride
  unblockRide = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { rideId } = req.params;

    if (!rideId) {
      res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    try {
      await this._adminService.unblockRide(rideId);
      
      res
        .status(StatusCode.OK)
        .json({ success: true, message: "Ride unblocked successfully" });
    } catch (error) {
      console.error("Error unblocking ride:", error);
      res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: (error as Error).message });
    }
  };

  cancelRide = async (req: Request, res: Response): Promise<void> => {
    const { rideId } = req.params;

    if (!rideId) {
      res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    try {
      await this._adminService.updateRideStatus(rideId, "Cancelled");
      res
        .status(StatusCode.OK)
        .json({ success: true, message: "Ride cancelled" });
    } catch (error) {
      res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: (error as Error).message });
    }
  };

  getDashboardData = async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    try {
      const metrics = await this._adminService.getDashboardMetrics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.status(StatusCode.OK).json(metrics);
    } catch (error) {
      res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: (error as Error).message });
    }
  };

  checkUserOngoingRides = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(StatusCode.BAD_REQUEST).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      const result = await this._adminService.checkUserOngoingRides(userId);

      res.status(StatusCode.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Error checking user ongoing rides:", error);
      res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };
}