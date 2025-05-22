import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { IRideService } from '../interfaces/ride/irideService';
import { IRideRepository } from '../../repositories/interface/ride/irideRepository';
import { IVehicleRepository } from '../../repositories/interface/vehicle/ivehicleRepository';
import { ISubscriptionService } from '../interfaces/subscription/isubscriptionService';
import { CreateRideDto } from '../../dtos/create-ride.dto';
import { Types } from 'mongoose';
import { OSRMClient } from '../../infrastructure/map-api/osrm.client';
import { IRide, RideCreationData } from '../../models/ride.model'; 


@injectable()
export class RideService implements IRideService {
  private rideRepo: IRideRepository;
  private vehicleRepo: IVehicleRepository;
  private subscriptionService: ISubscriptionService;
  private osrmClient: OSRMClient;

  constructor(
    @inject(TYPES.IRideRepository) rideRepository: IRideRepository,
    @inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository,
    @inject(TYPES.ISubscriptionService) subscriptionService: ISubscriptionService
  ) {
    this.rideRepo = rideRepository;
    this.vehicleRepo = vehicleRepository;
    this.subscriptionService = subscriptionService;
    this.osrmClient = new OSRMClient(process.env.OSRM_URL || 'http://localhost:5000');
  }

async startRide(dto: CreateRideDto): Promise<IRide> {
  const canBook = await this.subscriptionService.canBookRide(dto.driverId!);
  console.log("llllllllllpppppppp",dto)
  if (!canBook) {
    throw new Error("Ride limit exceeded. Please subscribe to book more rides.");
  }

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

  if (dto.startPoint === dto.endPoint) {
    throw new Error('Start point and end point cannot be the same');
  }

  // Use the values from dto instead of recalculating with OSRM
  const distanceKm = dto.distanceKm;
  const totalFuelCost = dto.totalFuelCost;
  const costPerPerson = dto.costPerPerson;
  const routeGeometry = dto.routeGeometry;
  const totalPeople = dto.passengerCount + 1; // Driver + passengers

  let rideId: string;
  let existingRide: IRide | null;
  do {
    rideId = `RIDE_${Date.now()}`;
    existingRide = await this.rideRepo.findOne({ rideId });
  } while (existingRide);

  const rideData: RideCreationData = {
    rideId: rideId,
    driverId: dto.driverId!,
    vehicleId: dto.vehicleId,
    date: new Date(dto.date),
    time: dto.time,
    startPoint: dto.startPoint,
    endPoint: dto.endPoint,
    distanceKm: distanceKm,
    mileage: vehicle.mileage,
    fuelPrice: dto.fuelPrice,
    passengerCount: dto.passengerCount,
    totalFuelCost: totalFuelCost,
    costPerPerson: costPerPerson,
    totalPeople: totalPeople,
    passengers: [],
    status: 'Pending',
    routeGeometry: routeGeometry,
    pickupPoints: [],
  };

  const ride = await this.rideRepo.createRide(rideData);
  return ride;
}

async joinRide(rideId: string, passengerId: string, pickupLocation: string): Promise<IRide> {
  const ride = await this.rideRepo.findOne({ rideId });
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (ride.passengers.includes(passengerId)) {
    throw new Error('Passenger is already part of this ride');
  }

  const rideDateTime = new Date(`${ride.date.toISOString().split('T')[0]}T${ride.time}:00`);
  const currentDateTime = new Date();
  if (currentDateTime >= rideDateTime) {
    await this.rideRepo.updateOne({ rideId }, { status: 'Started' });
    throw new Error('Ride has already started');
  }

  const vehicle = await this.vehicleRepo.findById(ride.vehicleId);
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }
  const maxCapacity = 4;
  if (ride.passengers.length >= maxCapacity) {
    throw new Error('Ride is full');
  }

  const [startLat, startLng] = ride.startPoint.split(',').map(Number);
  const [endLat, endLng] = ride.endPoint.split(',').map(Number);
  const [pickupLat, pickupLng] = pickupLocation.split(',').map(Number);

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng) || isNaN(pickupLat) || isNaN(pickupLng)) {
    throw new Error('Invalid coordinates format');
  }

  if (ride.startPoint === ride.endPoint) {
    throw new Error('Start point and end point cannot be the same');
  }

  let updatedRouteGeometry = ride.routeGeometry; // Start with existing GeoJSON
  let newDistance = ride.distanceKm;
  let pickupPoints = ride.pickupPoints;

  const initialRoute = await this.osrmClient.getRoute([ride.startPoint, ride.endPoint]);
  if (!initialRoute.coordinates || initialRoute.coordinates.length < 2) {
    throw new Error('Failed to calculate route between start and end points');
  }
  newDistance = initialRoute.distance || ride.distanceKm; // Fallback to existing distance if OSRM fails
  updatedRouteGeometry = initialRoute.geometry || ride.routeGeometry; // Fallback to existing geometry

  const distanceToStart = this.osrmClient.haversineDistance(
    [startLat, startLng],
    [pickupLat, pickupLng]
  );
  const JOIN_THRESHOLD = 0.05;

  if (distanceToStart > JOIN_THRESHOLD) {
    const nearestPoint = await this.osrmClient.findNearestPointOnRoute(
      initialRoute.coordinates,
      [pickupLat, pickupLng]
    );
    const distanceToRoute = this.osrmClient.haversineDistance(
      nearestPoint,
      [pickupLat, pickupLng]
    );

    console.log('Original Route Coordinates:', initialRoute.coordinates);
    console.log('Pickup Location:', [pickupLat, pickupLng]);
    console.log('Nearest Point:', nearestPoint);
    console.log('Distance to Route (km):', distanceToRoute);

    if (distanceToRoute > 0.5) {
      throw new Error('Pickup location is too far from the route');
    }

    const nearestPointStr = `${nearestPoint[0]},${nearestPoint[1]}`;
    const newRoute = await this.osrmClient.getRoute([
      ride.startPoint,
      nearestPointStr,
      ride.endPoint,
    ]);
    updatedRouteGeometry = newRoute.geometry || updatedRouteGeometry; // Fallback if OSRM fails
    newDistance = newRoute.distance || newDistance; // Fallback if OSRM fails

    pickupPoints.push({ passengerId, location: nearestPointStr });
  }

  const updatedPassengers = [...ride.passengers, passengerId];
  const newPassengerCount = updatedPassengers.length;
  const totalPeople = newPassengerCount + 1;

  const fuelNeeded = newDistance / ride.mileage;
  const totalFuelCost = fuelNeeded * ride.fuelPrice;
  const costPerPerson = totalPeople > 0 ? totalFuelCost / totalPeople : 0;

  await this.rideRepo.updateOne(
    { rideId },
    {
      passengers: updatedPassengers,
      passengerCount: newPassengerCount,
      totalPeople,
      distanceKm: newDistance,
      totalFuelCost,
      costPerPerson,
      routeGeometry: updatedRouteGeometry,
      pickupPoints,
    }
  );

  const updatedRide = await this.rideRepo.findOne({ rideId });
  if (!updatedRide) {
    throw new Error('Failed to retrieve updated ride');
  }

  return updatedRide;
}

  async getRides(userId: string): Promise<IRide[]> {
    const rides = await this.rideRepo.find({ driverId: userId });
    return rides;
  }
}