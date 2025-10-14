import { inject, injectable } from "inversify";
import { TYPES } from "../di/types";
import { IVehicleService } from "../services/interfaces/vehicle/ivehicleService";
import logger from "../config/logger";

@injectable()
export class DocumentExpiryCron {
  private vehicleService: IVehicleService;

  constructor(
    @inject(TYPES.IVehicleService) vehicleService: IVehicleService
  ) {
    this.vehicleService = vehicleService;
  }

  async checkDocumentExpiry(): Promise<void> {
    try {
      logger.info('Checking for expired documents...');
      await this.vehicleService.updateDocumentStatuses();
      await this.vehicleService.sendDocumentExpiryNotifications();
      logger.info('Document expiry check completed successfully');
    } catch (error) {
      logger.error('Error in document expiry cron:', error);
    }
  }
}