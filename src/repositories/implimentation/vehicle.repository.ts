import { injectable } from "inversify";
import { ClientSession, Types } from "mongoose";
import { IVehicleRepository } from "../interface/vehicle/ivehicleRepository";
import { IVehicle } from "../../models/vehicle.modal";
import VehicleModel from "../../models/vehicle.modal";
import { BaseRepository } from "../base/base.repository";

interface VehicleListResult {
  vehicles: IVehicle[];
  totalCount: number;
}

@injectable()
export class VehicleRepository extends BaseRepository<IVehicle> implements IVehicleRepository {
  constructor() {
    super(VehicleModel);
  }

  async createVehicle(data: Partial<IVehicle>, options?: { session: ClientSession }): Promise<IVehicle> {
    return this.create(data, options);
  }

  async findVehiclesByUserId(
    userId: string, 
    skip: number = 0, 
    limit: number = 10, 
    search: string = '',
    options?: { session: ClientSession }
  ): Promise<VehicleListResult> {
    const query: any = { user: new Types.ObjectId(userId) };

    if (search) {
      query.$or = [
        { vehicleName: { $regex: search, $options: 'i' } },
        { licensePlate: { $regex: search, $options: 'i' } },
        { 'insurance.number': { $regex: search, $options: 'i' } },
        { 'pollution.number': { $regex: search, $options: 'i' } }
      ];
    }

    const [vehicles, totalCount] = await Promise.all([
      this.findWithQueryBuilder(query, {
        session: options?.session,
        sort: { createdAt: -1 },
        skip,
        limit
      }),
      this.count(query, options)
    ]);

    return { vehicles, totalCount };
  }

  async findById(vehicleId: string, options?: { session: ClientSession }): Promise<IVehicle | null> {
    console.log("[VehicleRepository] Finding vehicle with ID:", vehicleId);
    return super.findById(vehicleId, options);
  }

  async updateVehicle(
    vehicleId: string,
    data: Partial<IVehicle>,
    options?: { session: ClientSession }
  ): Promise<IVehicle> {
    const vehicle = await this.updateById(vehicleId, data, options);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }
    return vehicle;
  }

  async deleteVehicle(vehicleId: string, options?: { session: ClientSession }): Promise<void> {
    const success = await this.deleteById(vehicleId, options);
    if (!success) {
      throw new Error("Vehicle not found");
    }
  }

  async findVehiclesWithExpiringDocuments(expiryDate: Date): Promise<IVehicle[]> {
    const query = {
      $or: [
        { 'insurance.endDate': { $lte: expiryDate } },
        { 'pollution.endDate': { $lte: expiryDate } }
      ]
    };
    
    return this.findWithQueryBuilder(query, {
      populate: 'user'
    });
  }

  async updateExpiredDocumentStatuses(): Promise<void> {
    const now = new Date();
    
    await this.updateMany(
      {
        $or: [
          { 'insurance.endDate': { $lt: now }, 'insurance.status': { $ne: 'Expired' } },
          { 'pollution.endDate': { $lt: now }, 'pollution.status': { $ne: 'Expired' } }
        ]
      },
      {
        $set: {
          'insurance.status': 'Expired',
          'pollution.status': 'Expired'
        }
      }
    );
  }
}