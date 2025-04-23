import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IVehicleService } from "../../services/interfaces/vehicle/ivehicleService";
import { IVehicleController } from "../interface/vehicle/ivehicleController";

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
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
  
      const { vehicleName, vehicleType, licensePlate, vehicleImage, documentImage } = vehicleData;
      if (!vehicleName || !vehicleType || !licensePlate || !vehicleImage || !documentImage) {
        res.status(400).json({
          success: false,
          message: "Missing required fields: vehicleName, vehicleType, licensePlate, vehicleImage, or documentImage",
        });
        return;
      }
  
      const newVehicle = await this.vehicleService.addVehicle(userId, vehicleData);
      res.status(201).json({ success: true, message: "Vehicle added successfully", data: newVehicle });
    } catch (error) {
      next(error);
    }
  }

  async getVehicles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const vehicles = await this.vehicleService.getUserVehicles(userId);
      res.status(200).json({ success: true, data: vehicles });
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
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!vehicleId) {
        res.status(400).json({ success: false, message: "Vehicle ID is required" });
        return;
      }

      const updatedVehicle = await this.vehicleService.updateVehicle(userId, vehicleId, vehicleData);
      res.status(200).json({ success: true, message: "Vehicle updated successfully", data: updatedVehicle });
    } catch (error) {
      next(error);
    }
  }

  async deleteVehicle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const vehicleId = req.params.id;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!vehicleId) {
        res.status(400).json({ success: false, message: "Vehicle ID is required" });
        return;
      }

      await this.vehicleService.deleteVehicle(userId, vehicleId);
      res.status(200).json({ success: true, message: "Vehicle deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}