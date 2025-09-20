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

      const { vehicleName, vehicleType, licensePlate, vehicleImage, documentImage } = vehicleData;
      if (!vehicleName || !vehicleType || !licensePlate || !vehicleImage || !documentImage) {
        res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessages.MISSING_FIELDS });
        return;
      }

      const newVehicle = await this.vehicleService.addVehicle(userId, vehicleData);
      res.status(StatusCode.CREATED).json({ success: true, message: "Vehicle added successfully", data: newVehicle });
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

      const vehicles = await this.vehicleService.getUserVehicles(userId);
      res.status(StatusCode.OK).json({ success: true, data: vehicles });
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

      const updatedVehicle = await this.vehicleService.updateVehicle(userId, vehicleId, vehicleData);
      res.status(StatusCode.OK).json({ success: true, message: "Vehicle updated successfully", data: updatedVehicle });
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
      res.status(StatusCode.OK).json({ success: true, message: "Vehicle deleted successfully" });
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
      res.status(StatusCode.OK).json({ success: true, message: "Vehicle reapplied successfully", data: updatedVehicle });
    } catch (error) {
      next(error);
    }
  }
}