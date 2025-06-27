import Razorpay from 'razorpay';
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IRideService } from "../interfaces/ride/irideService";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IRideRepository } from "../../repositories/interface/ride/irideRepository";
import { IOSRMClient, RouteResponse } from "../../infrastructure/map-api/osrm.client";
import { CreateRideDto } from "../../dtos/create-ride.dto";
import { IRide } from "../../models/ride.model";
import { JoinedRideDto } from "../../dtos/joined-ride.dto";
import { createHmac } from "crypto";
import { EditRideDto } from "../../dtos/edit-ride.dto";
import { Types } from "mongoose";

interface RideCreationData {
  rideId: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  date: Date;
  time: string;
  startPoint: string;
  startPlaceName: string;
  endPoint: string;
  endPlaceName: string;
  distanceKm: number;
  mileage: number;
  fuelPrice: number;
  passengerCount: number;
  totalFuelCost: number;
  platformFee: number;
  totalRideCost: number;
  costPerPerson: number;
  totalPeople: number;
  passengers: any[];
  status: string;
  routeGeometry?: string;
  pickupPoints: any[];
  dropoffPoints: any[];
  routeCoordinates: [number, number][];
}

@injectable()
export class RideService implements IRideService {
  private razorpay: Razorpay;

  constructor(
    @inject(TYPES.IUserRepository) private userRepo: IUserRepository,
    @inject(TYPES.IVehicleRepository) private vehicleRepo: IVehicleRepository,
    @inject(TYPES.IRideRepository) private rideRepo: IRideRepository,
    @inject(TYPES.ISubscriptionService) private subscriptionService: ISubscriptionService,
    @inject(TYPES.IOSRMClient) private osrmClient: IOSRMClient
  ) {
    // Initialize Razorpay client
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error(`[${new Date().toISOString()}] Razorpay environment variables not set`);
      throw new Error("Razorpay configuration missing");
    }
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  async startRide(dto: CreateRideDto): Promise<IRide> {
    const session = await this.userRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const driver = await this.userRepo.findUserById(dto.driverId!, { session });
        if (!driver) throw new Error("Driver not found");
        if (driver.govId?.verificationStatus !== "Verified") throw new Error("Driver must be verified");

        const canBook = await this.subscriptionService.canBookRide(dto.driverId!);
        if (!canBook) throw new Error("Ride limit exceeded");

        const vehicle = await this.vehicleRepo.findById(dto.vehicleId, { session });
        if (!vehicle) throw new Error("Vehicle not found");
        if (vehicle.user.toString() !== dto.driverId) throw new Error("Vehicle mismatch");
        if (vehicle.status !== "Approved") throw new Error("Vehicle not approved");

        if (dto.startPoint === dto.endPoint) throw new Error("Start and end points cannot be the same");

        const driverName = driver.fullName;
        const route = await this.osrmClient.getRoute([dto.startPoint, dto.endPoint]);
        const rawCoordinates = route.coordinates;
        console.log("[RideService] Raw route coordinates:", JSON.stringify(rawCoordinates, null, 2));
        const routeCoordinates: [number, number][] = rawCoordinates.map((coord: number[]) => {
          if (coord.length !== 2 || isNaN(coord[0]) || isNaN(coord[1])) {
            throw new Error(`Invalid coordinate format at index ${rawCoordinates.indexOf(coord as any)}: ${[coord.join(",")]}`);
          };
          return [coord[0], coord[1]] as [number, number];
        });
        if (routeCoordinates.length < 2) throw new Error("Invalid route");

        const [startLat, startLng] = dto.startPoint.split(",").map(Number);
        const [endLat, endLng] = dto.endPoint.split(",").map(Number);
        const startPlaceName = await this.osrmClient.reverseGeocode(startLat, startLng);
        const endPlaceName = await this.osrmClient.reverseGeocode(endLat, endLng);

        const distanceKm = dto.distance;
        const fuelNeeded = distanceKm / vehicle.mileage;
        let totalFuelCost = fuelNeeded * dto.fuelPrice;
        const totalPeople = dto.passengerCount + 1;
        let platformFee = dto.platformFee || 0;

        const isSubscribed = driver.subscription && driver.subscription.endDate > new Date();
        if (!isSubscribed) {
          platformFee = Math.ceil(totalFuelCost * 0.1);
          if (!driver.wallet) throw new Error("Driver's wallet is not initialized. Please contact support.");
          if (driver.wallet.balance < platformFee) throw new Error(`Insufficient wallet balance. Please add ₹${platformFee - driver.wallet.balance} to your wallet.`);
          driver.wallet.balance -= platformFee;
          driver.wallet.transactions.push({
            transactionId: `TXN_${Date.now()}`,
            type: "WITHDRAWAL",
            amount: platformFee,
            status: "COMPLETED",
            createdAt: new Date(),
          });
          await this.userRepo.updateOne({ _id: driver._id }, { $set: { wallet: driver.wallet } }, { session });
        }

        const totalRideCost = totalFuelCost + platformFee;
        const costPerPerson = totalRideCost / totalPeople;

        let rideId: string;
        let existingRide: IRide | null;
        do {
          rideId = `RIDE_${Date.now()}`;
          existingRide = await this.rideRepo.findOne({ rideId }, { session });
        } while (existingRide);

        const rideData: RideCreationData = {
          rideId,
          driverId: dto.driverId!,
          driverName,
          vehicleId: dto.vehicleId,
          date: new Date(dto.date),
          time: dto.time,
          startPoint: dto.startPoint,
          startPlaceName: dto.startPlaceName || startPlaceName,
          endPoint: dto.endPoint,
          endPlaceName: dto.endPlaceName || endPlaceName,
          distanceKm,
          mileage: vehicle.mileage,
          fuelPrice: dto.fuelPrice,
          passengerCount: 0,
          totalFuelCost,
          platformFee,
          totalRideCost,
          costPerPerson,
          totalPeople,
          passengers: [],
          status: "Pending",
          routeGeometry: dto.routeGeometry,
          pickupPoints: [],
          dropoffPoints: [],
          routeCoordinates,
        };
        console.log("[RideService] Start ride service data:", JSON.stringify(rideData, null, 2));

        return await this.rideRepo.createRide(rideData, { session });
      });
      return result!;
    } catch (error) {
      console.error(`[RideService] Error starting ride: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async joinRide(rideId: string, passengerId: string, pickupLocation: string, dropoffLocation: string): Promise<IRide> {
    const session = await this.rideRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        // Fetch the passenger
        const passenger = await this.userRepo.findUserById(passengerId, { session });
        if (!passenger) {
          console.error(`[${new Date().toISOString()}] Passenger not found: ${passengerId}`);
          throw new Error("Passenger not found");
        }
        console.log(`[${new Date().toISOString()}] Passenger found: ${passenger.fullName}`);
        if (passenger.govId?.verificationStatus !== "Verified") throw new Error("Passenger must be verified");

        // Fetch the ride
        const ride = await this.rideRepo.findOne({ rideId }, { session });
        if (!ride) {
          console.error(`[${new Date().toISOString()}] Ride not found for rideId: ${rideId}`);
          throw new Error("Ride not found");
        }
        if (ride.passengers.some((p) => p.passengerId === passengerId)) throw new Error("Already joined");

        // Check if ride has started
        const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
        if (new Date() >= rideDateTime) {
          await this.rideRepo.updateOne({ rideId }, { status: "Started" }, { session });
          throw new Error("Ride has started");
        }

        // Fetch the vehicle
        const vehicle = await this.vehicleRepo.findById(ride.vehicleId, { session });
        if (!vehicle) throw new Error("Vehicle not found");
        if (ride.passengers.length >= 4) throw new Error("Ride is full");

        // Validate coordinates
        const [startLat, startLng] = ride.startPoint.split(",").map(Number);
        const [endLat, endLng] = ride.endPoint.split(",").map(Number);
        const [pickupLat, pickupLng] = pickupLocation.split(",").map(Number);
        const [dropoffLat, dropoffLng] = dropoffLocation.split(",").map(Number);
        if ([startLat, startLng, endLat, endLng, pickupLat, pickupLng, dropoffLat, dropoffLng].some(isNaN))
          throw new Error("Invalid coordinates");

        // Fetch place names
        const passengerName = passenger.fullName;
        const pickupPlaceName = await this.osrmClient.reverseGeocode(pickupLat, pickupLng);
        const dropoffPlaceName = await this.osrmClient.reverseGeocode(dropoffLat, dropoffLng);

        // Update route coordinates if needed
        let routeCoordinates = ride.routeCoordinates || [];
        if (routeCoordinates.length < 2) {
          const route = await this.osrmClient.getRoute([ride.startPoint, ride.endPoint]);
          routeCoordinates = route.coordinates;
          await this.rideRepo.updateOne({ rideId }, { routeCoordinates }, { session });
        }

        // Validate pickup and dropoff proximity
        const JOIN_THRESHOLD = 0.5;
        const nearestPickupPoint = await this.osrmClient.findNearestPointOnRoute(routeCoordinates, [
          pickupLat,
          pickupLng,
        ]);
        if (this.osrmClient.haversineDistance(nearestPickupPoint, [pickupLat, pickupLng]) > JOIN_THRESHOLD)
          throw new Error("Pickup too far");
        const pickupPointStr = `${nearestPickupPoint[0]},${nearestPickupPoint[1]}`;

        const nearestDropoffPoint = await this.osrmClient.findNearestPointOnRoute(routeCoordinates, [
          dropoffLat,
          dropoffLng,
        ]);
        if (this.osrmClient.haversineDistance(nearestDropoffPoint, [dropoffLat, dropoffLng]) > JOIN_THRESHOLD)
          throw new Error("Drop-off too far");
        const dropoffPointStr = `${nearestDropoffPoint[0]},${nearestDropoffPoint[1]}`;

        // Update ride details
        const pickupPoints = [...ride.pickupPoints, { passengerId, location: pickupPointStr, placeName: pickupPlaceName }];
        const dropoffPoints = [
          ...ride.dropoffPoints,
          { passengerId, location: dropoffPointStr, placeName: dropoffPlaceName },
        ];
        const updatedPassengers = [...ride.passengers, { passengerId, passengerName }];
        const newPassengerCount = updatedPassengers.length;

        // Calculate costs
        const fuelNeeded = ride.distanceKm / ride.mileage;
        const totalFuelCost = fuelNeeded * ride.fuelPrice;
        const totalRideCost = totalFuelCost + ride.platformFee;
        const costPerPerson = totalRideCost / (ride.totalPeople + 1);

        // Fetch the driver
        const driver = await this.userRepo.findUserById(ride.driverId, { session });
        if (!driver) {
          console.error(`[${new Date().toISOString()}] Driver not found for rideId: ${rideId}`);
          throw new Error("Driver not found");
        }

        // Add costPerPerson to driver's wallet (payment via Razorpay, so no deduction from passenger's wallet)
        if (!driver.wallet) throw new Error("Driver's wallet is not initialized. Please contact support.");
        driver.wallet.balance += ride.costPerPerson;
        driver.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "DEPOSIT",
          amount: ride.costPerPerson,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this.userRepo.updateOne(
          { _id: driver._id },
          { $set: { wallet: driver.wallet } },
          { session }
        );

        // Update ride details
        await this.rideRepo.updateOne(
          { rideId },
          {
            passengers: updatedPassengers,
            passengerCount: newPassengerCount,
            totalFuelCost,
            costPerPerson,
            pickupPoints,
            dropoffPoints,
          },
          { session }
        );

        return await this.rideRepo.findOne({ rideId }, { session })!;
      });
      return result!;
    } catch (error) {
      console.error(`[RideService] Error joining ride ${rideId}: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getJoinedRides(userId: string): Promise<JoinedRideDto[]> {
    const rides = await this.rideRepo.find({
      "passengers.passengerId": userId,
    });

    const userMap = new Map<string, string>();
    for (const ride of rides) {
      for (const passenger of ride.passengers) {
        if (!userMap.has(passenger.passengerId)) {
          const user = await this.userRepo.findUserById(passenger.passengerId);
          userMap.set(passenger.passengerId, user?.fullName || "Unknown");
        }
      }
    }

    return rides.map((ride) => ({
      _id: (ride._id as Types.ObjectId).toString(),
      rideId: ride.rideId,
      driverId: ride.driverId,
      driverName: ride.driverName,
      vehicleId: ride.vehicleId,
      date: ride.date.toISOString().split("T")[0],
      time: ride.time,
      startPoint: ride.startPoint,
      startPlaceName: ride.startPlaceName,
      endPlaceName: ride.endPlaceName,
      endPoint: ride.endPoint,
      distanceKm: ride.distanceKm,
      mileage: ride.mileage,
      fuelPrice: ride.fuelPrice,
      passengerCount: ride.passengerCount,
      totalFuelCost: ride.totalFuelCost,
      platformFee: ride.platformFee,
      totalRideCost: ride.totalRideCost,
      costPerPerson: ride.costPerPerson,
      totalPeople: ride.totalPeople,
      passengers: ride.passengers.map((p) => ({
        passengerId: p.passengerId,
        passengerName: userMap.get(p.passengerId) || "Unknown",
      })),
      status: ride.status,
      routeGeometry: ride.routeGeometry,
      pickupPoints: ride.pickupPoints,
      dropoffPoints: ride.dropoffPoints,
      routeCoordinates: ride.routeCoordinates,
      paymentStatus: "Pending",
    }));
  }

  async getRides(userId: string): Promise<IRide[]> {
    return await this.rideRepo.find({ driverId: userId });
  }

  async findNearestRides(
    userLocation: string,
    destination: string,
    maxDistanceToRouteKm: number = 1.0,
    maxDistanceToEndKm: number = 5
  ): Promise<IRide[]> {
    const [userLat, userLng] = userLocation.split(",").map(Number);
    const [destLat, destLng] = destination.split(",").map(Number);
    if ([userLat, userLng, destLat, destLng].some(isNaN)) throw new Error("Invalid coordinates");

    const userCoords: [number, number] = [userLat, userLng];
    const destCoords: [number, number] = [destLat, destLng];
    const currentDateTime = new Date();

    const rides = await this.rideRepo.find({ status: "Pending" });
    if (!rides.length) return [];

    const availableRides = await Promise.all(
      rides.map(async (ride) => {
        const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
        if (currentDateTime >= rideDateTime) {
          await this.rideRepo.updateOne({ rideId: ride.rideId }, { status: "Started" });
          return null;
        }
        if (ride.passengers.length >= 4) return null;

        const [startLat, startLng] = ride.startPoint.split(",").map(Number);
        const [endLat, endLng] = ride.endPoint.split(",").map(Number);
        const startCoords: [number, number] = [startLat, startLng];
        const endCoords: [number, number] = [endLat, endLng];

        let route: RouteResponse = {
          distance: ride.distanceKm,
          duration: 0,
          geometry: ride.routeGeometry || "",
          coordinates: ride.routeCoordinates || [[startLat, startLng], [endLat, endLng]],
        };

        if (!route.coordinates.length || route.coordinates.length < 2) {
          const routeResponse = await this.osrmClient.getRoute([ride.startPoint, ride.endPoint]);
          route = routeResponse;
          await this.rideRepo.updateOne({ rideId: ride.rideId }, { $set: { routeCoordinates: route.coordinates } });
        }

        const nearestPointToUser = await this.osrmClient.findNearestPointOnRoute(route.coordinates, userCoords);
        const distanceToRoute = this.osrmClient.haversineDistance(nearestPointToUser, userCoords);
        if (distanceToRoute > maxDistanceToRouteKm) return null;

        const nearestPointToDest = await this.osrmClient.findNearestPointOnRoute(route.coordinates, destCoords);
        const distanceToDest = this.osrmClient.haversineDistance(nearestPointToDest, destCoords);
        if (distanceToDest > maxDistanceToEndKm) return null;

        const distanceToStart = this.osrmClient.haversineDistance(startCoords, userCoords);
        const distanceToEnd = this.osrmClient.haversineDistance(endCoords, destCoords);
        if (distanceToStart < 0.1 && distanceToEnd < 0.1) return { ride, distanceToRoute, distanceToDest };

        let userIndex = -1,
          destIndex = -1;
        for (let i = 0; i < route.coordinates.length; i++) {
          const distToUser = this.osrmClient.haversineDistance(route.coordinates[i], nearestPointToUser);
          if (distToUser < 0.005 && userIndex === -1) userIndex = i;
          const distToDest = this.osrmClient.haversineDistance(route.coordinates[i], nearestPointToDest);
          if (distToDest < 0.005 && destIndex === -1) destIndex = i;
          if (userIndex !== -1 && destIndex !== -1) break;
        }

        if (userIndex === -1 || destIndex === -1 || userIndex > destIndex) return null;

        return { ride, distanceToRoute, distanceToDest };
      })
    );

    return availableRides
      .filter((r): r is { ride: IRide; distanceToRoute: number; distanceToDest: number } => r !== null)
      .sort((a, b) => a.distanceToRoute + a.distanceToDest - (b.distanceToRoute + b.distanceToDest))
      .map((item) => item.ride);
  }

  async createRidePaymentOrder(rideId: string): Promise<any> {
    if (!this.razorpay) {
      console.error(`[${new Date().toISOString()}] Razorpay client not initialized`);
      throw new Error("Payment service not initialized");
    }

    const ride = await this.rideRepo.findOne({ rideId });
    if (!ride) {
      console.error(`[${new Date().toISOString()}] Ride not found for rideId: ${rideId}`);
      throw new Error("Ride not found");
    }
    const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
    if (new Date() >= rideDateTime) {
      await this.rideRepo.updateOne({ rideId }, { status: "Started" });
      throw new Error("Ride started");
    }
    if (ride.passengers.length >= 4) throw new Error("Ride full");

    const amountInPaise = Math.round(ride.costPerPerson * 100);
    if (amountInPaise < 100) throw new Error(`Amount too low: ₹${ride.costPerPerson}`);

    const receipt = `ride_${rideId.slice(-8)}_${Date.now().toString().slice(-6)}`;
    const options = { amount: amountInPaise, currency: "INR", receipt };
    console.log(`[${new Date().toISOString()}] Creating Razorpay order for ride ${rideId}:`, options);
    try {
      const order = await this.razorpay.orders.create(options);
      console.log(`[${new Date().toISOString()}] Created Razorpay order:`, order);
      return { id: order.id, amount: order.amount, currency: order.currency };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error creating Razorpay order: ${(error as Error).message}`);
      throw new Error(`Failed to create payment order: ${(error as Error).message}`);
    }
  }

  async verifyAndJoinRide(
    rideId: string,
    passengerId: string,
    pickupLocation: string,
    dropoffLocation: string,
    paymentId: string,
    orderId: string,
    signature: string
  ): Promise<IRide> {
    console.log(`[${new Date().toISOString()}] Verifying payment for ride ${rideId}, orderId: ${orderId}, paymentId: ${paymentId}`);
    const generatedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    console.log(`[${new Date().toISOString()}] Generated signature: ${generatedSignature}, Received: ${signature}`);
    if (generatedSignature !== signature) {
      console.error(`[${new Date().toISOString()}] Invalid signature for ride ${rideId}`);
      throw new Error("Invalid signature");
    }

    return await this.joinRide(rideId, passengerId, pickupLocation, dropoffLocation);
  }

  async editRide(rideId: string, driverId: string, dto: EditRideDto): Promise<IRide> {
    const ride = await this.rideRepo.findOne({ rideId });
    if (!ride) throw new Error("Ride not found");
    if (ride.driverId !== driverId) throw new Error("Unauthorized");
    if (ride.status !== "Pending") throw new Error("Only Pending rides editable");

    const newDateTime = new Date(`${dto.date}T${dto.time}:00`);
    if (newDateTime <= new Date()) throw new Error("Future date required");

    await this.rideRepo.updateOne({ rideId }, { date: new Date(dto.date), time: dto.time });
    return (await this.rideRepo.findOne({ rideId }))!;
  }

  async cancelRide(rideId: string, driverId: string): Promise<void> {
    const session = await this.rideRepo.startSession();
    try {
      await session.withTransaction(async () => {
        // Fetch the ride
        const ride = await this.rideRepo.findOne({ rideId }, { session });
        if (!ride) throw new Error("Ride not found");
        if (ride.driverId !== driverId) throw new Error("Unauthorized");
        if (ride.status !== "Pending") throw new Error("Only Pending rides cancellable");

        // Fetch the driver
        const driver = await this.userRepo.findUserById(ride.driverId, { session });
        if (!driver) throw new Error("Driver not found");
        if (!driver.wallet) throw new Error("Driver's wallet is not initialized. Please contact support.");

        // Refund costPerPerson to each passenger's wallet
        const totalRefund = ride.costPerPerson * ride.passengers.length;
        if (driver.wallet.balance < totalRefund) {
          throw new Error(`Driver's wallet has insufficient balance for refund. Please contact support.`);
        }

        for (const passenger of ride.passengers) {
          const passengerData = await this.userRepo.findUserById(passenger.passengerId, { session });
          if (!passengerData) {
            console.error(`[${new Date().toISOString()}] Passenger not found: ${passenger.passengerId}`);
            continue; // Skip if passenger not found, log error
          }
          if (!passengerData.wallet) {
            console.error(`[${new Date().toISOString()}] Passenger wallet not initialized: ${passenger.passengerId}`);
            continue; // Skip if wallet not initialized, log error
          }
          passengerData.wallet.balance += ride.costPerPerson;
          passengerData.wallet.transactions.push({
            transactionId: `TXN_${Date.now()}`,
            type: "REFUND",
            amount: ride.costPerPerson,
            status: "COMPLETED",
            createdAt: new Date(),
          });
          await this.userRepo.updateOne(
            { _id: passengerData._id },
            { $set: { wallet: passengerData.wallet } },
            { session }
          );
        }

        // Deduct total refunded amount from driver's wallet
        driver.wallet.balance -= totalRefund;
        driver.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "WITHDRAWAL",
          amount: totalRefund,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this.userRepo.updateOne(
          { _id: driver._id },
          { $set: { wallet: driver.wallet } },
          { session }
        );

        // Update ride status to Cancelled
        await this.rideRepo.updateOne({ rideId }, { status: "Cancelled" }, { session });
      });
    } catch (error) {
      console.error(`[RideService] Error cancelling ride ${rideId}: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async cancelJoinedRide(rideId: string, passengerId: string): Promise<void> {
    const session = await this.rideRepo.startSession();
    try {
      await session.withTransaction(async () => {
        // Fetch the ride
        const ride = await this.rideRepo.findOne({ rideId }, { session });
        if (!ride) throw new Error("Ride not found");
        if (!ride.passengers.some((p) => p.passengerId === passengerId)) throw new Error("Not a passenger");
        if (ride.status !== "Pending") throw new Error("Only Pending rides cancellable");

        // Fetch the passenger and driver
        const passenger = await this.userRepo.findUserById(passengerId, { session });
        if (!passenger) throw new Error("Passenger not found");
        const driver = await this.userRepo.findUserById(ride.driverId, { session });
        if (!driver) throw new Error("Driver not found");

        // Refund costPerPerson to passenger's wallet
        if (!passenger.wallet) throw new Error("Passenger's wallet is not initialized. Please contact support.");
        passenger.wallet.balance += ride.costPerPerson;
        passenger.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "REFUND",
          amount: ride.costPerPerson,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this.userRepo.updateOne(
          { _id: passenger._id },
          { $set: { wallet: passenger.wallet } },
          { session }
        );

        // Deduct costPerPerson from driver's wallet
        if (!driver.wallet) throw new Error("Driver's wallet is not initialized. Please contact support.");
        if (driver.wallet.balance < ride.costPerPerson) {
          throw new Error(`Driver's wallet has insufficient balance for refund. Please contact support.`);
        }
        driver.wallet.balance -= ride.costPerPerson;
        driver.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "WITHDRAWAL",
          amount: ride.costPerPerson,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this.userRepo.updateOne(
          { _id: driver._id },
          { $set: { wallet: driver.wallet } },
          { session }
        );

        // Update ride details
        const updatedPassengers = ride.passengers.filter((p) => p.passengerId !== passengerId);
        const updatedPickupPoints = ride.pickupPoints.filter((p) => p.passengerId !== passengerId);
        const updatedDropoffPoints = ride.dropoffPoints.filter((p) => p.passengerId !== passengerId);
        const newPassengerCount = updatedPassengers.length;

        const fuelNeeded = ride.distanceKm / ride.mileage;
        const totalFuelCost = fuelNeeded * ride.fuelPrice;
        const costPerPerson = ride.totalPeople > 0 ? (totalFuelCost + ride.platformFee) / ride.totalPeople : 0;

        await this.rideRepo.updateOne(
          { rideId },
          {
            passengers: updatedPassengers,
            passengerCount: newPassengerCount,
            pickupPoints: updatedPickupPoints,
            dropoffPoints: updatedDropoffPoints,
            totalFuelCost,
            costPerPerson,
          },
          { session }
        );
      });
    } catch (error) {
      console.error(`[RideService] Error cancelling joined ride ${rideId}: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }
}