import { createHmac } from 'crypto';
import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IJoinRideService } from "../interfaces/ride/ijoin-ride.service";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { IJoinRideRepository } from "../../repositories/interface/ride/ijoin-ride-repository";
import { IOSRMClient } from "../../infrastructure/map-api/osrm.client";
import { IRide } from "../../models/ride.model";
import { JoinedRideDto } from "../../dtos/joined-ride.dto";
import { INotificationService } from "../interfaces/notification/iNotificationService";
import Razorpay from "razorpay";
import { Types } from "mongoose";
import logger from "../../config/logger";

@injectable()
export class JoinRideService implements IJoinRideService {
  private _razorpay!: Razorpay;

  constructor(
    @inject(TYPES.IUserRepository) private _userRepo: IUserRepository,
    @inject(TYPES.IJoinRideRepository) private _rideRepo: IJoinRideRepository,
    @inject(TYPES.ISubscriptionService) private _subscriptionService: ISubscriptionService,
    @inject(TYPES.IOSRMClient) private _osrmClient: IOSRMClient,
    @inject(TYPES.INotificationService) private _notificationService: INotificationService
  ) {
    this._razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    });
  }

  async joinRide(
    rideId: string,
    passengerId: string,
    pickupLocation: string,
    dropoffLocation: string
  ): Promise<IRide> {
    const session = await this._rideRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        logger.info(`Starting joinRide transaction for rideId: ${rideId}, passengerId: ${passengerId}`);

        const passenger = await this._userRepo.findUserById(passengerId, { session });
        if (!passenger) {
          logger.error(`Passenger not found: ${passengerId}`);
          throw new Error("Passenger not found");
        }
        if (passenger.govId?.verificationStatus !== "Verified") {
          logger.warn(`Passenger not verified: ${passengerId}`);
          throw new Error("Passenger must be verified");
        }

        const canJoin = await this._subscriptionService.canJoinRide(passengerId);
        if (!canJoin) {
          const { joinRides } = await this._subscriptionService.getRemainingRideCounts(passengerId);
          logger.warn(`Ride join limit exceeded for passengerId: ${passengerId}, remaining joins: ${joinRides}`);
          throw new Error(`Ride join limit exceeded. Remaining joins: ${joinRides}`);
        }

        const ride = await this._rideRepo.findOne({ rideId }, { session });
        if (!ride) {
          logger.error(`Ride not found: ${rideId}`);
          throw new Error("Ride not found");
        }

        logger.debug(`Ride found:`, {
          rideId: ride.rideId,
          status: ride.status,
          passengers: ride.passengers.length,
          passengerCount: ride.passengerCount,
          pendingRequests: ride.pendingRequests
        });

        if (ride.passengers.some((p) => p.passengerId === passengerId)) {
          logger.warn(`Passenger ${passengerId} already joined ride ${rideId}`);
          throw new Error("Already joined");
        }
        if (new Date() >= new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`)) {
          await this._rideRepo.updateOne({ rideId }, { status: "Started" }, { session });
          logger.warn(`Ride ${rideId} has started`);
          throw new Error("Ride has started");
        }
        if (ride.passengers.length >= ride.passengerCount) {
          logger.warn(`Ride ${rideId} is full`);
          throw new Error("Ride is full");
        }

        const [pickupLat, pickupLng] = pickupLocation.split(",").map(Number);
        const [dropoffLat, dropoffLng] = dropoffLocation.split(",").map(Number);
        if ([pickupLat, pickupLng, dropoffLat, dropoffLng].some(isNaN)) {
          logger.error(`Invalid coordinates for ride ${rideId}:`, { pickupLocation, dropoffLocation });
          throw new Error("Invalid coordinates");
        }

        const pickupPlaceName = await this._osrmClient.reverseGeocode(pickupLat, pickupLng);
        const dropoffPlaceName = await this._osrmClient.reverseGeocode(dropoffLat, dropoffLng);
        logger.debug(`Geocoded locations:`, { pickupPlaceName, dropoffPlaceName });

        const JOIN_THRESHOLD = 0.5;
        let routeCoordinates = ride.routeCoordinates || [];
        if (routeCoordinates.length < 2) {
          logger.warn(`Route coordinates missing for ride ${rideId}, fetching new route`);
          const route = await this._osrmClient.getRoute([ride.startPoint, ride.endPoint]);
          routeCoordinates = route.coordinates;
          await this._rideRepo.updateOne({ rideId }, { routeCoordinates }, { session });
        }

        const nearestPickupPoint = await this._osrmClient.findNearestPointOnRoute(routeCoordinates, [pickupLat, pickupLng]);
        const pickupDistance = this._osrmClient.haversineDistance(nearestPickupPoint, [pickupLat, pickupLng]);
        if (pickupDistance > JOIN_THRESHOLD) {
          logger.warn(`Pickup too far for ride ${rideId}: ${pickupDistance} km`);
          throw new Error("Pickup too far");
        }
        const pickupPointStr = `${nearestPickupPoint[0]},${nearestPickupPoint[1]}`;

        const nearestDropoffPoint = await this._osrmClient.findNearestPointOnRoute(routeCoordinates, [dropoffLat, dropoffLng]);
        const dropoffDistance = this._osrmClient.haversineDistance(nearestDropoffPoint, [dropoffLat, dropoffLng]);
        if (dropoffDistance > JOIN_THRESHOLD) {
          logger.warn(`Drop-off too far for ride ${rideId}: ${dropoffDistance} km`);
          throw new Error("Drop-off too far");
        }
        const dropoffPointStr = `${nearestDropoffPoint[0]},${nearestDropoffPoint[1]}`;

        let startIndex = 0;
        let minDistStart = Infinity;
        for (let i = 0; i < routeCoordinates.length; i++) {
          const dist = this._osrmClient.haversineDistance(routeCoordinates[i], nearestPickupPoint);
          if (dist < minDistStart) {
            minDistStart = dist;
            startIndex = i;
          }
        }

        let endIndex = routeCoordinates.length - 1;
        let minDistEnd = Infinity;
        for (let i = 0; i < routeCoordinates.length; i++) {
          const dist = this._osrmClient.haversineDistance(routeCoordinates[i], nearestDropoffPoint);
          if (dist < minDistEnd) {
            minDistEnd = dist;
            endIndex = i;
          }
        }

        if (startIndex >= endIndex) {
          logger.error(`Invalid segment for ride ${rideId}: Pickup after dropoff`);
          throw new Error("Invalid segment: Pickup after dropoff");
        }

        let segmentDistanceKm = 0;
        for (let i = startIndex; i < endIndex; i++) {
          segmentDistanceKm += this._osrmClient.haversineDistance(routeCoordinates[i], routeCoordinates[i + 1]);
        }
        logger.debug(`Segment for passengerId: ${passengerId} in ride: ${rideId}`, { startIndex, endIndex, segmentDistanceKm });

        const pendingRequest = {
          passengerId,
          passengerName: passenger.fullName,
          pickupLocation: pickupPointStr,
          dropoffLocation: dropoffPointStr,
          pickupPlaceName,
          dropoffPlaceName,
          requestedAt: new Date(),
          status: "pending" as const,
          distanceKm: segmentDistanceKm,
        };

        logger.debug(`Adding pending request for passengerId: ${passengerId} in ride: ${rideId}`, pendingRequest);

        const updateResult = await this._rideRepo.updateOne(
          { rideId },
          { $push: { pendingRequests: pendingRequest } },
          { session }
        );
        logger.debug(`MongoDB update result for ride ${rideId}:`, updateResult);

        const updatedRide = await this._rideRepo.findOne({ rideId }, { session });
        if (!updatedRide) {
          logger.error(`Updated ride not found: ${rideId}`);
          throw new Error("Updated ride not found");
        }
        logger.debug(`Updated ride pendingRequests for ride ${rideId}:`, updatedRide.pendingRequests);

        await this._notificationService.triggerRideJoinNotification(rideId, ride.driverId, passengerId);
        return updatedRide;
      });
      return result!;
    } catch (error) {
      logger.error(`Error joining ride ${rideId}: ${(error as Error).message}`);
      throw error;
    } finally {
      logger.debug(`Ending session for joinRide: ${rideId}`);
      session.endSession();
    }
  }

  async getJoinedRides(userId: string): Promise<JoinedRideDto[]> {
    const acceptedRides = await this._rideRepo.find({
      "passengers.passengerId": userId,
    });

    const pendingRides = await this._rideRepo.find({
      "pendingRequests.passengerId": userId,
    });

    const allRides = [...acceptedRides, ...pendingRides].filter((ride, index, self) =>
      index === self.findIndex((r) => r.rideId === ride.rideId)
    );

    const userMap = new Map<string, string>();
    for (const ride of allRides) {
      for (const passenger of ride.passengers) {
        if (!userMap.has(passenger.passengerId)) {
          const user = await this._userRepo.findUserById(passenger.passengerId);
          userMap.set(passenger.passengerId, user?.fullName || "Unknown");
        }
      }
      for (const request of ride.pendingRequests) {
        if (!userMap.has(request.passengerId)) {
          const user = await this._userRepo.findUserById(request.passengerId);
          userMap.set(request.passengerId, user?.fullName || "Unknown");
        }
      }
    }

    return allRides.map((ride) => {
      const userRequest = ride.pendingRequests.find((req) => req.passengerId === userId);
      const requestStatus = userRequest ? userRequest.status : "accepted";
      const userPassenger = ride.passengers.find((p) => p.passengerId === userId);
      const MIN_FARE = 20;
      const userCost = userPassenger 
        ? userPassenger.cost 
        : userRequest && userRequest.distanceKm !== undefined 
          ? Math.max(userRequest.distanceKm * ride.perKmRate, MIN_FARE) 
          : null;

      return {
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
        costPerPerson: userCost,
        totalPeople: ride.passengers.length + 1,
        passengers: ride.passengers.map((p) => ({
          passengerId: p.passengerId,
          passengerName: userMap.get(p.passengerId) || "Unknown",
        })),
        status: ride.status,
        routeGeometry: ride.routeGeometry,
        pickupPoints: ride.pickupPoints,
        dropoffPoints: ride.dropoffPoints,
        routeCoordinates: ride.routeCoordinates,
        paymentStatus: "Paid",
        requestStatus: requestStatus,
      };
    });
  }

  async findNearestRides(
    userLocation: string,
    destination: string,
    maxDistanceToRouteKm: number = 1.0,
    maxDistanceToEndKm: number = 5
  ): Promise<IRide[]> {
    const [userLat, userLng] = userLocation.split(",").map(Number);
    const [destLat, destLng] = destination.split(",").map(Number);
    if ([userLat, userLng, destLat, destLng].some(isNaN)) {
      logger.error("Invalid coordinates provided for findNearestRides");
      throw new Error("Invalid coordinates");
    }

    const userCoords: [number, number] = [userLat, userLng];
    const destCoords: [number, number] = [destLat, destLng];
    const currentDateTime = new Date();

    const rides = await this._rideRepo.find({ status: "Pending" });
    if (!rides.length) {
      logger.debug("No pending rides found for findNearestRides");
      return [];
    }

    const availableRides = await Promise.all(
      rides.map(async (ride) => {
        const rideDateTime = new Date(
          `${ride.date.toISOString().split("T")[0]}T${ride.time}:00`
        );
        if (currentDateTime >= rideDateTime) {
          await this._rideRepo.updateOne(
            { rideId: ride.rideId },
            { status: "Started" }
          );
          return null;
        }
        if (ride.passengers.length >= ride.passengerCount) return null;

        const [startLat, startLng] = ride.startPoint.split(",").map(Number);
        const [endLat, endLng] = ride.endPoint.split(",").map(Number);
        const startCoords: [number, number] = [startLat, startLng];
        const endCoords: [number, number] = [endLat, endLng];

        let routeCoordinates = ride.routeCoordinates || [
          [startLat, startLng],
          [endLat, endLng],
        ];

        if (!routeCoordinates.every(([lat, lng]) => !isNaN(lat) && !isNaN(lng))) {
          logger.warn(`Invalid route coordinates for ride ${ride.rideId}, fetching new route`);
          const route = await this._osrmClient.getRoute(
            [ride.startPoint, ride.endPoint],
            ride.routeGeometry
          );
          routeCoordinates = route.coordinates;
          await this._rideRepo.updateOne(
            { rideId: ride.rideId },
            {
              $set: {
                routeCoordinates: route.coordinates,
                routeGeometry: route.geometry,
              },
            }
          );
        }

        const nearestPointToUser = await this._osrmClient.findNearestPointOnRoute(routeCoordinates, userCoords);
        const distanceToRoute = this._osrmClient.haversineDistance(nearestPointToUser, userCoords);
        if (distanceToRoute > maxDistanceToRouteKm) return null;

        const nearestPointToDest = await this._osrmClient.findNearestPointOnRoute(routeCoordinates, destCoords);
        const distanceToDest = this._osrmClient.haversineDistance(nearestPointToDest, destCoords);
        if (distanceToDest > maxDistanceToEndKm) return null;

        if (
          this._osrmClient.haversineDistance(startCoords, userCoords) < 0.1 &&
          this._osrmClient.haversineDistance(endCoords, destCoords) < 0.1
        ) {
          return { ride, distanceToRoute, distanceToDest };
        }

        let userIndex = -1, destIndex = -1;
        const tolerance = 0.1;
        for (let i = 0; i < routeCoordinates.length; i++) {
          const distToUser = this._osrmClient.haversineDistance(routeCoordinates[i], nearestPointToUser);
          if (distToUser < tolerance && userIndex === -1) userIndex = i;
          const distToDest = this._osrmClient.haversineDistance(routeCoordinates[i], nearestPointToDest);
          if (distToDest < tolerance && destIndex === -1) destIndex = i;
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

  async createRidePaymentOrder(rideId: string, passengerId: string): Promise<any> {
    if (!this._razorpay) {
      logger.error("Razorpay client not initialized");
      throw new Error("Payment service not initialized");
    }

    logger.info(`Creating payment order for rideId: ${rideId}, passengerId: ${passengerId}`);

    const maxRetries = 3;
    let attempt = 0;
    let ride;

    while (attempt < maxRetries) {
      ride = await this._rideRepo.findOne({ rideId });
      if (!ride) {
        logger.error(`Ride not found for rideId: ${rideId}`);
        throw new Error("Ride not found");
      }

      logger.debug(`Ride details (attempt ${attempt + 1}):`, {
        rideId: ride.rideId,
        status: ride.status,
        pendingRequests: ride.pendingRequests,
        perKmRate: ride.perKmRate,
      });

      const request = ride.pendingRequests.find((req) => req.passengerId === passengerId);
      if (request) {
        break;
      }

      logger.warn(`Passenger request not found for passengerId: ${passengerId} in ride: ${rideId}, attempt ${attempt + 1}`, { pendingRequests: ride.pendingRequests });
      attempt++;
      if (attempt < maxRetries) {
        logger.debug(`Retrying after 1s delay...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!ride) {
      logger.error(`Ride not found after retries for rideId: ${rideId}`);
      throw new Error("Ride not found");
    }

    const request = ride.pendingRequests.find((req) => req.passengerId === passengerId);
    if (!request) {
      logger.error(`Passenger request not found for passengerId: ${passengerId} in ride: ${rideId} after ${maxRetries} attempts`, { pendingRequests: ride.pendingRequests });
      throw new Error("Passenger request not found");
    }

    const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
    if (new Date() >= rideDateTime) {
      await this._rideRepo.updateOne({ rideId }, { status: "Started" });
      logger.warn(`Ride has started for rideId: ${rideId}`);
      throw new Error("Ride started");
    }
    if (ride.passengers.length >= ride.passengerCount) {
      logger.warn(`Ride is full for rideId: ${rideId}`);
      throw new Error("Ride full");
    }

    const MIN_FARE = 20;
    if (!ride.perKmRate || !request.distanceKm) {
      logger.error(`Missing perKmRate or distanceKm for ride ${rideId}:`, { perKmRate: ride.perKmRate, distanceKm: request.distanceKm });
      throw new Error("Invalid ride cost parameters");
    }

    const passengerCost = Math.max(request.distanceKm * ride.perKmRate, MIN_FARE);
    logger.debug(`Calculated passengerCost for ride ${rideId}: ₹${passengerCost} (distanceKm: ${request.distanceKm}, perKmRate: ${ride.perKmRate})`);

    const amountInPaise = Math.round(passengerCost * 100);
    logger.debug(`Amount in paise for ride ${rideId}: ${amountInPaise}`);
    if (amountInPaise < 100) {
      logger.error(`Amount too low for ride ${rideId}: ₹${passengerCost} (${amountInPaise} paise)`);
      throw new Error(`Amount too low: ₹${passengerCost}`);
    }

    const receipt = `ride_${rideId.slice(-8)}_${Date.now().toString().slice(-6)}`;
    const options = { amount: amountInPaise, currency: "INR", receipt };
    logger.debug(`Creating Razorpay order for ride ${rideId}:`, options);

    try {
      const order = await this._razorpay.orders.create(options);
      logger.info(`Created Razorpay order for ride ${rideId}:`, order);
      return { id: order.id, amount: order.amount, currency: order.currency };
    } catch (error) {
      logger.error(`Error creating Razorpay order for ride ${rideId}: ${(error as Error).message}`);
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
    logger.info(`Verifying payment for ride ${rideId}, orderId: ${orderId}, paymentId: ${paymentId}`);
    
    const generatedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
      
    if (generatedSignature !== signature) {
      logger.error(`Invalid signature for ride ${rideId}`);
      throw new Error("Invalid signature");
    }

    const session = await this._rideRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const ride = await this._rideRepo.findOne({ rideId }, { session });
        if (!ride) throw new Error("Ride not found");
        if (ride.status !== "Pending") throw new Error("Ride has started or ended");

        const passenger = await this._userRepo.findUserById(passengerId, { session });
        if (!passenger) throw new Error("Passenger not found");

        const updatedRide = await this.joinRide(rideId, passengerId, pickupLocation, dropoffLocation);
        await this._notificationService.triggerRideJoinNotification(rideId, ride.driverId, passengerId);

        return updatedRide;
      });
      return result;
    } catch (error) {
      logger.error(`Error in verifyAndJoinRide for ride ${rideId}: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async cancelJoinedRide(rideId: string, passengerId: string): Promise<void> {
    const session = await this._rideRepo.startSession();
    try {
      await session.withTransaction(async () => {
        const ride = await this._rideRepo.findOne({ rideId }, { session });
        if (!ride) throw new Error("Ride not found");
        if (!ride.passengers.some((p) => p.passengerId === passengerId))
          throw new Error("Not a passenger");
        if (ride.status !== "Pending")
          throw new Error("Only Pending rides cancellable");

        const passenger = await this._userRepo.findUserById(passengerId, { session });
        if (!passenger) throw new Error("Passenger not found");
        const driver = await this._userRepo.findUserById(ride.driverId, { session });
        if (!driver) throw new Error("Driver not found");

        const passengerCost = ride.passengerCosts.find((pc) => pc.passengerId === passengerId)?.cost || 0;
        if (!passenger.wallet)
          throw new Error("Passenger's wallet is not initialized. Please contact support.");
        
        passenger.wallet.balance += passengerCost;
        passenger.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "REFUND",
          amount: passengerCost,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this._userRepo.updateOne(
          { _id: passenger._id },
          { $set: { wallet: passenger.wallet } },
          { session }
        );

        await this._notificationService.triggerRideCancellationNotification(
          rideId,
          passengerId,
          `You have cancelled your participation in ride ${rideId}. Refund of ${passengerCost} credited to your wallet.`
        );

        if (!driver.wallet)
          throw new Error("Driver's wallet is not initialized. Please contact support.");
        if (driver.wallet.balance < passengerCost) {
          throw new Error(`Driver's wallet has insufficient balance for refund. Please contact support.`);
        }
        driver.wallet.balance -= passengerCost;
        driver.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "WITHDRAWAL",
          amount: passengerCost,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this._userRepo.updateOne(
          { _id: driver._id },
          { $set: { wallet: driver.wallet } },
          { session }
        );

        await this._notificationService.triggerRideCancellationNotification(
          rideId,
          ride.driverId,
          `Passenger ${passengerId} has cancelled their participation in ride ${rideId}.`
        );

        const updatedPassengers = ride.passengers.filter((p) => p.passengerId !== passengerId);
        const updatedPickupPoints = ride.pickupPoints.filter((p) => p.passengerId !== passengerId);
        const updatedDropoffPoints = ride.dropoffPoints.filter((p) => p.passengerId !== passengerId);
        const updatedPassengerDistances = ride.passengerDistances.filter((pd) => pd.passengerId !== passengerId);
        const updatedPassengerCosts = ride.passengerCosts.filter((pc) => pc.passengerId !== passengerId);

        await this._rideRepo.updateOne(
          { rideId },
          {
            passengers: updatedPassengers,
            pickupPoints: updatedPickupPoints,
            dropoffPoints: updatedDropoffPoints,
            passengerDistances: updatedPassengerDistances,
            passengerCosts: updatedPassengerCosts,
          },
          { session }
        );
      });
    } catch (error) {
      logger.error(`Error cancelling joined ride ${rideId}: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async handleJoinRequest(
    rideId: string,
    driverId: string,
    passengerId: string,
    action: "accept" | "reject"
  ): Promise<void> {
    if (!rideId || typeof rideId !== "string") {
      logger.error("Invalid rideId: must be a non-empty string", rideId);
      throw new Error("Invalid rideId provided");
    }
    if (!driverId || typeof driverId !== "string" || driverId.length !== 24) {
      logger.error("Invalid driverId:", driverId);
      throw new Error("Invalid driverId provided");
    }
    if (!passengerId || typeof passengerId !== "string" || passengerId.length !== 24) {
      logger.error("Invalid passengerId:", passengerId);
      throw new Error("Invalid passengerId provided");
    }
    if (!["accept", "reject"].includes(action)) {
      logger.error("Invalid action:", action);
      throw new Error("Invalid action provided");
    }

    const session = await this._rideRepo.startSession();
    try {
      await session.withTransaction(async () => {
        const ride = await this._rideRepo.findOne({ _id: rideId }, { session });
        if (!ride) {
          logger.error("Ride not found for _id:", rideId);
          throw new Error("Ride not found");
        }
        if (ride.driverId !== driverId) {
          logger.error("Unauthorized driverId:", driverId, "for ride:", rideId);
          throw new Error("Unauthorized");
        }
        if (ride.status !== "Pending") {
          logger.error("Ride status is not Pending:", ride.status, "for ride:", rideId);
          throw new Error("Ride has started or ended");
        }

        const request = ride.pendingRequests.find(
          (r) => r.passengerId === passengerId && r.status === "pending"
        );
        if (!request) {
          logger.error("Request not found or already processed for passengerId:", passengerId, "in ride:", rideId);
          throw new Error("Request not found or already processed");
        }

        if (action === "reject") {
          const passengerCost = Math.max(request.distanceKm * ride.perKmRate, 20);

          if (request.paymentId) {
            logger.info("Processing refund for paymentId:", request.paymentId);
            try {
              await this._razorpay.payments.refund(request.paymentId, {
                amount: Math.round(passengerCost * 100),
              });
              logger.info(`Refund successful for paymentId: ${request.paymentId}`);
            } catch (refundError) {
              logger.error(`Failed to process Razorpay refund for paymentId: ${request.paymentId}`, refundError);
              throw new Error("Failed to process refund");
            }
          }

          const passenger = await this._userRepo.findUserById(passengerId, { session });
          if (!passenger) {
            logger.error("Passenger not found for passengerId:", passengerId);
            throw new Error("Passenger not found");
          }
          if (!passenger.wallet) {
            logger.error("Passenger's wallet is not initialized for passengerId:", passengerId);
            throw new Error("Passenger's wallet is not initialized");
          }

          passenger.wallet.balance += passengerCost;
          passenger.wallet.transactions.push({
            transactionId: `TXN_${Date.now()}`,
            type: "REFUND",
            amount: passengerCost,
            status: "COMPLETED",
            createdAt: new Date(),
          });

          await this._userRepo.updateOne(
            { _id: passengerId },
            { $set: { wallet: passenger.wallet } },
            { session }
          );

          await this._rideRepo.updateOne(
            { _id: rideId },
            { $pull: { pendingRequests: { passengerId } } },
            { session }
          );

          await this._notificationService.triggerRideJoinRejectedNotification(
            rideId,
            passengerId,
            passengerId,
            request.passengerName
          );
        } else if (action === "accept") {
          const canJoin = await this._subscriptionService.canJoinRide(passengerId);
          if (!canJoin) {
            const { joinRides } = await this._subscriptionService.getRemainingRideCounts(passengerId);
            throw new Error(`Passenger has exceeded their ride join limit. Remaining joins: ${joinRides}`);
          }

          if (!request.pickupPlaceName || typeof request.pickupPlaceName !== "string") {
            throw new Error("pickupPlaceName is required");
          }
          if (!request.dropoffPlaceName || typeof request.dropoffPlaceName !== "string") {
            throw new Error("dropoffPlaceName is required");
          }

          const MIN_FARE = 20;
          const passengerCost = Math.max(request.distanceKm * ride.perKmRate, MIN_FARE);

          const updatedPassengers = [
            ...ride.passengers,
            {
              passengerId,
              passengerName: request.passengerName,
              distanceKm: request.distanceKm,
              cost: passengerCost,
            },
          ];
          const pickupPoints = [
            ...ride.pickupPoints,
            { passengerId, location: request.pickupLocation, placeName: request.pickupPlaceName },
          ];
          const dropoffPoints = [
            ...ride.dropoffPoints,
            { passengerId, location: request.dropoffLocation, placeName: request.dropoffPlaceName },
          ];
          const passengerDistances = [
            ...ride.passengerDistances,
            { passengerId, distanceKm: request.distanceKm },
          ];
          const passengerCosts = [
            ...ride.passengerCosts,
            { passengerId, cost: passengerCost },
          ];

          const driver = await this._userRepo.findUserById(ride.driverId, { session });
          if (!driver) throw new Error("Driver not found");
          if (!driver.wallet) throw new Error("Driver's wallet is not initialized");
          driver.wallet.balance += passengerCost;
          driver.wallet.transactions.push({
            transactionId: `TXN_${Date.now()}`,
            type: "DEPOSIT",
            amount: passengerCost,
            status: "COMPLETED",
            createdAt: new Date(),
          });
          await this._userRepo.updateOne(
            { _id: driver._id },
            { $set: { wallet: driver.wallet } },
            { session }
          );

          await this._subscriptionService.decrementJoinRideCount(passengerId);

          await this._rideRepo.updateOne(
            { _id: rideId },
            {
              $set: {
                passengers: updatedPassengers,
                pickupPoints,
                dropoffPoints,
                passengerDistances,
                passengerCosts,
              },
              $pull: { pendingRequests: { passengerId } },
            },
            { session }
          );

          await this._notificationService.triggerRideJoinAcceptedNotification(
            rideId,
            passengerId,
            request.passengerName
          );
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error handling join request for ride ${rideId}: ${errorMessage}`);
      throw new Error(`Failed to handle join request: ${errorMessage}`);
    } finally {
      await session.endSession();
    }
  }
}