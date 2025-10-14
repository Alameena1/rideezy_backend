import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IVehicleService } from "../../services/interfaces/vehicle/ivehicleService";
import { IVehicleController } from "../interface/vehicle/ivehicleController";
import { StatusCode } from "../../constants/status-codes.enum";
import { ResponseMessages } from "../../constants/response-messages.const";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

@injectable()
export class VehicleController implements IVehicleController {
  private vehicleService: IVehicleService;

  constructor(@inject(TYPES.IVehicleService) vehicleService: IVehicleService) {
    this.vehicleService = vehicleService;
  }

  async addVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const vehicleData = req.body;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      // Updated validation for new fields
      const { 
        vehicleName, 
        vehicleType, 
        licensePlate, 
        vehicleImage, 
        insurance,
        pollution 
      } = vehicleData;
      
      if (!vehicleName || !vehicleType || !licensePlate || !vehicleImage) {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: "Vehicle name, type, license plate, and image are required" 
        });
        return;
      }

      // Check insurance data
      if (!insurance?.number || !insurance?.image || !insurance?.startDate || !insurance?.endDate) {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: "Insurance number, image, start date, and end date are required" 
        });
        return;
      }

      // Check pollution data
      if (!pollution?.number || !pollution?.image || !pollution?.startDate || !pollution?.endDate) {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: "Pollution number, image, start date, and end date are required" 
        });
        return;
      }

      const newVehicle = await this.vehicleService.addVehicle(userId, vehicleData);
      res.status(StatusCode.CREATED).json({ 
        success: true, 
        message: "Vehicle added successfully", 
        data: newVehicle 
      });
    } catch (error) {
      next(error);
    }
  }

  async getVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      // Get pagination and search parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || '';

      const result = await this.vehicleService.getUserVehicles(userId, page, limit, search);
      res.status(StatusCode.OK).json({ 
        success: true, 
        data: result 
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    const vehicleId = req.params.id;
    const vehicleData = req.body;

    if (!userId) {
      res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
      return;
    }

    if (!vehicleId) {
      res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
      return;
    }

    // For updates, don't validate insurance and pollution as strictly
    // Only validate if they are being updated
    if (vehicleData.insurance) {
      if (!vehicleData.insurance.number || !vehicleData.insurance.startDate || !vehicleData.insurance.endDate) {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: "Insurance number, start date, and end date are required when updating insurance" 
        });
        return;
      }
      // If insurance image is not provided in update, remove it to avoid validation errors
      if (!vehicleData.insurance.image) {
        delete vehicleData.insurance.image;
      }
    }

    if (vehicleData.pollution) {
      if (!vehicleData.pollution.number || !vehicleData.pollution.startDate || !vehicleData.pollution.endDate) {
        res.status(StatusCode.BAD_REQUEST).json({ 
          success: false, 
          message: "Pollution number, start date, and end date are required when updating pollution" 
        });
        return;
      }
      // If pollution image is not provided in update, remove it to avoid validation errors
      if (!vehicleData.pollution.image) {
        delete vehicleData.pollution.image;
      }
    }

    const updatedVehicle = await this.vehicleService.updateVehicle(userId, vehicleId, vehicleData);
    res.status(StatusCode.OK).json({ 
      success: true, 
      message: "Vehicle updated successfully", 
      data: updatedVehicle 
    });
  } catch (error) {
    next(error);
  }
}

  async deleteVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const vehicleId = req.params.id;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      if (!vehicleId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      await this.vehicleService.deleteVehicle(userId, vehicleId);
      res.status(StatusCode.OK).json({ 
        success: true, 
        message: "Vehicle deleted successfully" 
      });
    } catch (error) {
      next(error);
    }
  }

  async reapplyVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const vehicleId = req.params.id;
      const vehicleData = req.body;

      if (!userId) {
        res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessages.UNAUTHORIZED });
        return;
      }

      if (!vehicleId) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const updatedVehicle = await this.vehicleService.reapplyVehicle(userId, vehicleId, vehicleData);
      res.status(StatusCode.OK).json({ 
        success: true, 
        message: "Vehicle reapplied successfully", 
        data: updatedVehicle 
      });
    } catch (error) {
      next(error);
    }
  }
}