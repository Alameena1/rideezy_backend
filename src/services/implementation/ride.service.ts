import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { IRideService } from '../interfaces/ride/irideService';
import { IRideRepository } from '../../repositories/interface/ride/irideRepository';
import { IVehicleRepository } from '../../repositories/interface/vehicle/ivehicleRepository';
import { config } from '../../config/dbconfig';
import { CreateRideDto } from '../../dtos/create-ride.dto';
import { IRide } from '../../models/ride.model';
import { Types } from 'mongoose';

@injectable()
export class RideService implements IRideService {
  private rideRepo: IRideRepository;
  private vehicleRepo: IVehicleRepository;

  constructor(
    @inject(TYPES.IRideRepository) rideRepository: IRideRepository,
    @inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository
  ) {
    this.rideRepo = rideRepository;
    this.vehicleRepo = vehicleRepository;
  }

  async startRide(dto: CreateRideDto): Promise<IRide> {
    const userObjectId = new Types.ObjectId(dto.driverId!);

    // Fetch and validate vehicle
    const vehicle = await this.vehicleRepo.findById(dto.vehicleId);
    if (!vehicle) {
      throw new Error('Selected vehicle not found');
    }
    if (vehicle.user.toString() !== dto.driverId) {
      throw new Error('Vehicle does not belong to the driver');
    }
    if (vehicle.status !== 'Approved') {
      throw new Error('Vehicle is not approved for rides');
    }

    // Validate cost calculations
    const fuelNeeded = dto.distance / vehicle.mileage;
    const expectedFuelCost = fuelNeeded * dto.fuelPrice;
    const totalPeople = dto.passengerCount + 1;
    const expectedCostPerPerson = expectedFuelCost / totalPeople;

    if (Math.abs(expectedFuelCost - dto.fuelCost) > 0.01) {
      throw new Error('Invalid fuel cost provided');
    }
    if (Math.abs(expectedCostPerPerson - dto.costPerPerson) > 0.01) {
      throw new Error('Invalid cost per person provided');
    }

    // Create ride object
    const rideData: Partial<IRide> = {
      rideId: `RIDE_${Date.now()}`,
      driverId: dto.driverId!,
      vehicleId: dto.vehicleId,
      date: new Date(dto.date),
      time: dto.time,
      startPoint: dto.startPoint,
      endPoint: dto.endPoint,
      distanceKm: dto.distance,
      mileage: vehicle.mileage,
      fuelPrice: dto.fuelPrice,
      passengerCount: dto.passengerCount,
      totalFuelCost: dto.fuelCost,
      costPerPerson: dto.costPerPerson,
      totalPeople: totalPeople,
      passengers: [],
      status: 'Pending',
      routeGeometry: dto.routeGeometry,
    };

   
    const ride = await this.rideRepo.createRide(rideData);
    return ride;
  }

  async getRides(userId: string): Promise<IRide[]> {
    const userObjectId = new Types.ObjectId(userId);
    const rides = await this.rideRepo.find({ driverId: userId });
    return rides;
  }
}