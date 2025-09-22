import { createHmac } from 'crypto'; // Keep this import
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

@injectable()
export class JoinRideService implements IJoinRideService {
  private razorpay!: Razorpay;

  constructor(
    @inject(TYPES.IUserRepository) private userRepo: IUserRepository,
    @inject(TYPES.IJoinRideRepository) private rideRepo: IJoinRideRepository,
    @inject(TYPES.ISubscriptionService) private subscriptionService: ISubscriptionService,
    @inject(TYPES.IOSRMClient) private osrmClient: IOSRMClient,
    @inject(TYPES.INotificationService) private notificationService: INotificationService
  ) {
    // Initialize Razorpay with your credentials
    this.razorpay = new Razorpay({
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
      const session = await this.rideRepo.startSession();
      try {
        const result = await session.withTransaction(async () => {
          console.log(
            `[${new Date().toISOString()}] Starting joinRide transaction for rideId: ${rideId}, passengerId: ${passengerId}`
          );
          const passenger = await this.userRepo.findUserById(passengerId, { session });
          if (!passenger) {
            console.error(`[${new Date().toISOString()}] Passenger not found: ${passengerId}`);
            throw new Error("Passenger not found");
          }
          if (passenger.govId?.verificationStatus !== "Verified") {
            console.error(`[${new Date().toISOString()}] Passenger not verified: ${passengerId}`);
            throw new Error("Passenger must be verified");
          }
  
          const canJoin = await this.subscriptionService.canJoinRide(passengerId);
          if (!canJoin) {
            const { joinRides } = await this.subscriptionService.getRemainingRideCounts(passengerId);
            console.error(`[${new Date().toISOString()}] Ride join limit exceeded for passengerId: ${passengerId}, remaining joins: ${joinRides}`);
            throw new Error(`Ride join limit exceeded. Remaining joins: ${joinRides}`);
          }
  
          const ride = await this.rideRepo.findOne({ rideId }, { session });
          if (!ride) {
            console.error(`[${new Date().toISOString()}] Ride not found: ${rideId}`);
            throw new Error("Ride not found");
          }
          console.log(`[${new Date().toISOString()}] Ride found:`, {
            rideId: ride.rideId,
            status: ride.status,
            passengers: ride.passengers.length,
            passengerCount: ride.passengerCount,
            pendingRequests: ride.pendingRequests
          });
  
          if (ride.passengers.some((p) => p.passengerId === passengerId)) {
            console.error(`[${new Date().toISOString()}] Passenger ${passengerId} already joined ride ${rideId}`);
            throw new Error("Already joined");
          }
          if (new Date() >= new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`)) {
            await this.rideRepo.updateOne({ rideId }, { status: "Started" }, { session });
            console.error(`[${new Date().toISOString()}] Ride ${rideId} has started`);
            throw new Error("Ride has started");
          }
          if (ride.passengers.length >= ride.passengerCount) {
            console.error(`[${new Date().toISOString()}] Ride ${rideId} is full`);
            throw new Error("Ride is full");
          }
  
          const [pickupLat, pickupLng] = pickupLocation.split(",").map(Number);
          const [dropoffLat, dropoffLng] = dropoffLocation.split(",").map(Number);
          if ([pickupLat, pickupLng, dropoffLat, dropoffLng].some(isNaN)) {
            console.error(`[${new Date().toISOString()}] Invalid coordinates for ride ${rideId}:`, { pickupLocation, dropoffLocation });
            throw new Error("Invalid coordinates");
          }
  
          const pickupPlaceName = await this.osrmClient.reverseGeocode(pickupLat, pickupLng);
          const dropoffPlaceName = await this.osrmClient.reverseGeocode(dropoffLat, dropoffLng);
          console.log(`[${new Date().toISOString()}] Geocoded locations:`, { pickupPlaceName, dropoffPlaceName });
  
          const JOIN_THRESHOLD = 0.5;
          let routeCoordinates = ride.routeCoordinates || [];
          if (routeCoordinates.length < 2) {
            console.warn(`[${new Date().toISOString()}] Route coordinates missing for ride ${rideId}, fetching new route`);
            const route = await this.osrmClient.getRoute([ride.startPoint, ride.endPoint]);
            routeCoordinates = route.coordinates;
            await this.rideRepo.updateOne({ rideId }, { routeCoordinates }, { session });
          }
  
          const nearestPickupPoint = await this.osrmClient.findNearestPointOnRoute(routeCoordinates, [pickupLat, pickupLng]);
          const pickupDistance = this.osrmClient.haversineDistance(nearestPickupPoint, [pickupLat, pickupLng]);
          if (pickupDistance > JOIN_THRESHOLD) {
            console.error(`[${new Date().toISOString()}] Pickup too far for ride ${rideId}: ${pickupDistance} km`);
            throw new Error("Pickup too far");
          }
          const pickupPointStr = `${nearestPickupPoint[0]},${nearestPickupPoint[1]}`;
  
          const nearestDropoffPoint = await this.osrmClient.findNearestPointOnRoute(routeCoordinates, [dropoffLat, dropoffLng]);
          const dropoffDistance = this.osrmClient.haversineDistance(nearestDropoffPoint, [dropoffLat, dropoffLng]);
          if (dropoffDistance > JOIN_THRESHOLD) {
            console.error(`[${new Date().toISOString()}] Drop-off too far for ride ${rideId}: ${dropoffDistance} km`);
            throw new Error("Drop-off too far");
          }
          const dropoffPointStr = `${nearestDropoffPoint[0]},${nearestDropoffPoint[1]}`;
  
          let startIndex = 0;
          let minDistStart = Infinity;
          for (let i = 0; i < routeCoordinates.length; i++) {
            const dist = this.osrmClient.haversineDistance(routeCoordinates[i], nearestPickupPoint);
            if (dist < minDistStart) {
              minDistStart = dist;
              startIndex = i;
            }
          }
  
          let endIndex = routeCoordinates.length - 1;
          let minDistEnd = Infinity;
          for (let i = 0; i < routeCoordinates.length; i++) {
            const dist = this.osrmClient.haversineDistance(routeCoordinates[i], nearestDropoffPoint);
            if (dist < minDistEnd) {
              minDistEnd = dist;
              endIndex = i;
            }
          }
  
          if (startIndex >= endIndex) {
            console.error(`[${new Date().toISOString()}] Invalid segment for ride ${rideId}: Pickup after dropoff`);
            throw new Error("Invalid segment: Pickup after dropoff");
          }
  
          let segmentDistanceKm = 0;
          for (let i = startIndex; i < endIndex; i++) {
            segmentDistanceKm += this.osrmClient.haversineDistance(routeCoordinates[i], routeCoordinates[i + 1]);
          }
          console.log(
            `[${new Date().toISOString()}] Segment for passengerId: ${passengerId} in ride: ${rideId}`,
            { startIndex, endIndex, segmentDistanceKm }
          );
  
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
  
          console.log(
            `[${new Date().toISOString()}] Adding pending request for passengerId: ${passengerId} in ride: ${rideId}`,
            pendingRequest
          );
  
          const updateResult = await this.rideRepo.updateOne(
            { rideId },
            { $push: { pendingRequests: pendingRequest } },
            { session }
          );
          console.log(
            `[${new Date().toISOString()}] MongoDB update result for ride ${rideId}:`,
            updateResult
          );
  
          const updatedRide = await this.rideRepo.findOne({ rideId }, { session });
          if (!updatedRide) {
            console.error(`[${new Date().toISOString()}] Updated ride not found: ${rideId}`);
            throw new Error("Updated ride not found");
          }
          console.log(
            `[${new Date().toISOString()}] Updated ride pendingRequests for ride ${rideId}:`,
            updatedRide.pendingRequests
          );
  
          await this.notificationService.triggerRideJoinNotification(rideId, ride.driverId, passengerId);
          return updatedRide;
        });
        return result!;
      } catch (error) {
        console.error(`[RideService] Error joining ride ${rideId}:`, (error as Error).message);
        throw error;
      } finally {
        console.log(`[${new Date().toISOString()}] Ending session for joinRide: ${rideId}`);
        session.endSession();
      }
    }

  async getJoinedRides(userId: string): Promise<JoinedRideDto[]> {
      const acceptedRides = await this.rideRepo.find({
        "passengers.passengerId": userId,
      });
  
      const pendingRides = await this.rideRepo.find({
        "pendingRequests.passengerId": userId,
      });
  
      const allRides = [...acceptedRides, ...pendingRides].filter((ride, index, self) =>
        index === self.findIndex((r) => r.rideId === ride.rideId)
      );
  
      const userMap = new Map<string, string>();
      for (const ride of allRides) {
        for (const passenger of ride.passengers) {
          if (!userMap.has(passenger.passengerId)) {
            const user = await this.userRepo.findUserById(passenger.passengerId);
            userMap.set(passenger.passengerId, user?.fullName || "Unknown");
          }
        }
        for (const request of ride.pendingRequests) {
          if (!userMap.has(request.passengerId)) {
            const user = await this.userRepo.findUserById(request.passengerId);
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
      if ([userLat, userLng, destLat, destLng].some(isNaN))
        throw new Error("Invalid coordinates");
  
      const userCoords: [number, number] = [userLat, userLng];
      const destCoords: [number, number] = [destLat, destLng];
      const currentDateTime = new Date();
  
      const rides = await this.rideRepo.find({ status: "Pending" });
      if (!rides.length) return [];
  
      const availableRides = await Promise.all(
        rides.map(async (ride) => {
          const rideDateTime = new Date(
            `${ride.date.toISOString().split("T")[0]}T${ride.time}:00`
          );
          if (currentDateTime >= rideDateTime) {
            await this.rideRepo.updateOne(
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
  
          if (
            !routeCoordinates.every(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
          ) {
            console.warn(
              `Invalid route coordinates for ride ${ride.rideId}, fetching new route`
            );
            const route = await this.osrmClient.getRoute(
              [ride.startPoint, ride.endPoint],
              ride.routeGeometry
            );
            routeCoordinates = route.coordinates;
            await this.rideRepo.updateOne(
              { rideId: ride.rideId },
              {
                $set: {
                  routeCoordinates: route.coordinates,
                  routeGeometry: route.geometry,
                },
              }
            );
          }
  
          const nearestPointToUser =
            await this.osrmClient.findNearestPointOnRoute(
              routeCoordinates,
              userCoords
            );
          const distanceToRoute = this.osrmClient.haversineDistance(
            nearestPointToUser,
            userCoords
          );
          if (distanceToRoute > maxDistanceToRouteKm) return null;
  
          const nearestPointToDest =
            await this.osrmClient.findNearestPointOnRoute(
              routeCoordinates,
              destCoords
            );
          const distanceToDest = this.osrmClient.haversineDistance(
            nearestPointToDest,
            destCoords
          );
          if (distanceToDest > maxDistanceToEndKm) return null;
  
          if (
            this.osrmClient.haversineDistance(startCoords, userCoords) < 0.1 &&
            this.osrmClient.haversineDistance(endCoords, destCoords) < 0.1
          ) {
            return { ride, distanceToRoute, distanceToDest };
          }
  
          let userIndex = -1,
            destIndex = -1;
          const tolerance = 0.1;
          for (let i = 0; i < routeCoordinates.length; i++) {
            const distToUser = this.osrmClient.haversineDistance(
              routeCoordinates[i],
              nearestPointToUser
            );
            if (distToUser < tolerance && userIndex === -1) userIndex = i;
            const distToDest = this.osrmClient.haversineDistance(
              routeCoordinates[i],
              nearestPointToDest
            );
            if (distToDest < tolerance && destIndex === -1) destIndex = i;
            if (userIndex !== -1 && destIndex !== -1) break;
          }
  
          if (userIndex === -1 || destIndex === -1 || userIndex > destIndex)
            return null;
  
          return { ride, distanceToRoute, distanceToDest };
        })
      );
  
      return availableRides
        .filter(
          (
            r
          ): r is {
            ride: IRide;
            distanceToRoute: number;
            distanceToDest: number;
          } => r !== null
        )
        .sort(
          (a, b) =>
            a.distanceToRoute +
            a.distanceToDest -
            (b.distanceToRoute + b.distanceToDest)
        )
        .map((item) => item.ride);
    }

   async createRidePaymentOrder(rideId: string, passengerId: string): Promise<any> {
      if (!this.razorpay) {
        console.error(`[${new Date().toISOString()}] Razorpay client not initialized`);
        throw new Error("Payment service not initialized");
      }
  
      console.log(`[${new Date().toISOString()}] Creating payment order for rideId: ${rideId}, passengerId: ${passengerId}`);
  
      const maxRetries = 3;
      let attempt = 0;
      let ride;
  
      while (attempt < maxRetries) {
        ride = await this.rideRepo.findOne({ rideId });
        if (!ride) {
          console.error(`[${new Date().toISOString()}] Ride not found for rideId: ${rideId}`);
          throw new Error("Ride not found");
        }
  
        console.log(`[${new Date().toISOString()}] Ride details (attempt ${attempt + 1}):`, {
          rideId: ride.rideId,
          status: ride.status,
          pendingRequests: ride.pendingRequests,
          perKmRate: ride.perKmRate,
        });
  
        const request = ride.pendingRequests.find((req) => req.passengerId === passengerId);
        if (request) {
          break; // Found the request, proceed with payment order
        }
  
        console.warn(
          `[${new Date().toISOString()}] Passenger request not found for passengerId: ${passengerId} in ride: ${rideId}, attempt ${attempt + 1}`,
          { pendingRequests: ride.pendingRequests }
        );
        attempt++;
        if (attempt < maxRetries) {
          console.log(`[${new Date().toISOString()}] Retrying after 1s delay...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
  
      if (!ride) {
        console.error(`[${new Date().toISOString()}] Ride not found after retries for rideId: ${rideId}`);
        throw new Error("Ride not found");
      }
  
      const request = ride.pendingRequests.find((req) => req.passengerId === passengerId);
      if (!request) {
        console.error(
          `[${new Date().toISOString()}] Passenger request not found for passengerId: ${passengerId} in ride: ${rideId} after ${maxRetries} attempts`,
          { pendingRequests: ride.pendingRequests }
        );
        throw new Error("Passenger request not found");
      }
  
      const rideDateTime = new Date(
        `${ride.date.toISOString().split("T")[0]}T${ride.time}:00`
      );
      if (new Date() >= rideDateTime) {
        await this.rideRepo.updateOne({ rideId }, { status: "Started" });
        console.error(`[${new Date().toISOString()}] Ride has started for rideId: ${rideId}`);
        throw new Error("Ride started");
      }
      if (ride.passengers.length >= ride.passengerCount) {
        console.error(`[${new Date().toISOString()}] Ride is full for rideId: ${rideId}`);
        throw new Error("Ride full");
      }
  
      const MIN_FARE = 20;
      if (!ride.perKmRate || !request.distanceKm) {
        console.error(
          `[${new Date().toISOString()}] Missing perKmRate or distanceKm for ride ${rideId}:`,
          { perKmRate: ride.perKmRate, distanceKm: request.distanceKm }
        );
        throw new Error("Invalid ride cost parameters");
      }
  
      const passengerCost = Math.max(request.distanceKm * ride.perKmRate, MIN_FARE);
      console.log(
        `[${new Date().toISOString()}] Calculated passengerCost for ride ${rideId}: ₹${passengerCost} (distanceKm: ${request.distanceKm}, perKmRate: ${ride.perKmRate})`
      );
  
      const amountInPaise = Math.round(passengerCost * 100);
      console.log(
        `[${new Date().toISOString()}] Amount in paise for ride ${rideId}: ${amountInPaise}`
      );
      if (amountInPaise < 100) {
        console.error(
          `[${new Date().toISOString()}] Amount too low for ride ${rideId}: ₹${passengerCost} (${amountInPaise} paise)`
        );
        throw new Error(`Amount too low: ₹${passengerCost}`);
      }
  
      const receipt = `ride_${rideId.slice(-8)}_${Date.now().toString().slice(-6)}`;
      const options = { amount: amountInPaise, currency: "INR", receipt };
      console.log(
        `[${new Date().toISOString()}] Creating Razorpay order for ride ${rideId}:`,
        options
      );
  
      try {
        const order = await this.razorpay.orders.create(options);
        console.log(
          `[${new Date().toISOString()}] Created Razorpay order for ride ${rideId}:`,
          order
        );
        return { id: order.id, amount: order.amount, currency: order.currency };
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] Error creating Razorpay order for ride ${rideId}:`,
          (error as Error).message
        );
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
    console.log(
      `[${new Date().toISOString()}] Verifying payment for ride ${rideId}, orderId: ${orderId}, paymentId: ${paymentId}`
    );
    
    // This will now use the imported createHmac from crypto
    const generatedSignature = createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET || ""
    )
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
      
    if (generatedSignature !== signature) {
      console.error(
        `[${new Date().toISOString()}] Invalid signature for ride ${rideId}`
      );
      throw new Error("Invalid signature");
    }

    const session = await this.rideRepo.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne({ rideId }, { session });
        if (!ride) throw new Error("Ride not found");
        if (ride.status !== "Pending") throw new Error("Ride has started or ended");

        const passenger = await this.userRepo.findUserById(passengerId, { session });
        if (!passenger) throw new Error("Passenger not found");

        const updatedRide = await this.joinRide(rideId, passengerId, pickupLocation, dropoffLocation);
        await this.notificationService.triggerRideJoinNotification(
          rideId,
          ride.driverId,
          passengerId
        );

        return updatedRide;
      });
      return result;
    } catch (error) {
      console.error(
        `[RideService] Error submitting join request for ride ${rideId}: ${(error as Error).message}`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

   async cancelJoinedRide(rideId: string, passengerId: string): Promise<void> {
    const session = await this.rideRepo.startSession();
    try {
      await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne({ rideId }, { session });
        if (!ride) throw new Error("Ride not found");
        if (!ride.passengers.some((p) => p.passengerId === passengerId))
          throw new Error("Not a passenger");
        if (ride.status !== "Pending")
          throw new Error("Only Pending rides cancellable");

        const passenger = await this.userRepo.findUserById(passengerId, {
          session,
        });
        if (!passenger) throw new Error("Passenger not found");
        const driver = await this.userRepo.findUserById(ride.driverId, {
          session,
        });
        if (!driver) throw new Error("Driver not found");

        const passengerCost = ride.passengerCosts.find((pc) => pc.passengerId === passengerId)?.cost || 0;
        if (!passenger.wallet)
          throw new Error(
            "Passenger's wallet is not initialized. Please contact support."
          );
        passenger.wallet.balance += passengerCost;
        passenger.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "REFUND",
          amount: passengerCost,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this.userRepo.updateOne(
          { _id: passenger._id },
          { $set: { wallet: passenger.wallet } },
          { session }
        );

        await this.notificationService.triggerRideCancellationNotification(
          rideId,
          passengerId,
          `You have cancelled your participation in ride ${rideId}. Refund of ${passengerCost} credited to your wallet.`
        );

        if (!driver.wallet)
          throw new Error(
            "Driver's wallet is not initialized. Please contact support."
          );
        if (driver.wallet.balance < passengerCost) {
          throw new Error(
            `Driver's wallet has insufficient balance for refund. Please contact support.`
          );
        }
        driver.wallet.balance -= passengerCost;
        driver.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "WITHDRAWAL",
          amount: passengerCost,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this.userRepo.updateOne(
          { _id: driver._id },
          { $set: { wallet: driver.wallet } },
          { session }
        );

        await this.notificationService.triggerRideCancellationNotification(
          rideId,
          ride.driverId,
          `Passenger ${passengerId} has cancelled their participation in ride ${rideId}.`
        );

        const updatedPassengers = ride.passengers.filter(
          (p) => p.passengerId !== passengerId
        );
        const updatedPickupPoints = ride.pickupPoints.filter(
          (p) => p.passengerId !== passengerId
        );
        const updatedDropoffPoints = ride.dropoffPoints.filter(
          (p) => p.passengerId !== passengerId
        );
        const updatedPassengerDistances = ride.passengerDistances.filter(
          (pd) => pd.passengerId !== passengerId
        );
        const updatedPassengerCosts = ride.passengerCosts.filter(
          (pc) => pc.passengerId !== passengerId
        );

        await this.rideRepo.updateOne(
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
      console.error(
        `[RideService] Error cancelling joined ride ${rideId}: ${(error as Error).message}`
      );
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
      console.error("Invalid rideId: must be a non-empty string", rideId);
      throw new Error("Invalid rideId provided");
    }
    if (!driverId || typeof driverId !== "string" || driverId.length !== 24) {
      console.error("Invalid driverId:", driverId);
      throw new Error("Invalid driverId provided");
    }
    if (!passengerId || typeof passengerId !== "string" || passengerId.length !== 24) {
      console.error("Invalid passengerId:", passengerId);
      throw new Error("Invalid passengerId provided");
    }
    if (!["accept", "reject"].includes(action)) {
      console.error("Invalid action:", action);
      throw new Error("Invalid action provided");
    }

    const session = await this.rideRepo.startSession();
    try {
      await session.withTransaction(async () => {
        const ride = await this.rideRepo.findOne({ _id: rideId }, { session });
        if (!ride) {
          console.error("Ride not found for _id:", rideId);
          throw new Error("Ride not found");
        }
        if (ride.driverId !== driverId) {
          console.error("Unauthorized driverId:", driverId, "for ride:", rideId);
          throw new Error("Unauthorized");
        }
        if (ride.status !== "Pending") {
          console.error("Ride status is not Pending:", ride.status, "for ride:", rideId);
          throw new Error("Ride has started or ended");
        }

        const request = ride.pendingRequests.find(
          (r) => r.passengerId === passengerId && r.status === "pending"
        );
        if (!request) {
          console.error("Request not found or already processed for passengerId:", passengerId, "in ride:", rideId);
          throw new Error("Request not found or already processed");
        }

        if (action === "reject") {
          const passengerCost = Math.max(request.distanceKm * ride.perKmRate, 20);

          if (request.paymentId) {
            console.log("Processing refund for paymentId:", request.paymentId);
            try {
              await this.razorpay.payments.refund(request.paymentId, {
                amount: Math.round(passengerCost * 100),
              });
              console.log(`Refund successful for paymentId: ${request.paymentId}`);
            } catch (refundError) {
              console.error(`Failed to process Razorpay refund for paymentId: ${request.paymentId}`, refundError);
              throw new Error("Failed to process refund");
            }
          }

          // Update passenger's wallet
          const passenger = await this.userRepo.findUserById(passengerId, { session });
          if (!passenger) {
            console.error("Passenger not found for passengerId:", passengerId);
            throw new Error("Passenger not found");
          }
          if (!passenger.wallet) {
            console.error("Passenger's wallet is not initialized for passengerId:", passengerId);
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

          await this.userRepo.updateOne(
            { _id: passengerId },
            { $set: { wallet: passenger.wallet } },
            { session }
          );

          // Remove the pending request
          await this.rideRepo.updateOne(
            { _id: rideId },
            { $pull: { pendingRequests: { passengerId } } },
            { session }
          );

          // Trigger notification
          await this.notificationService.triggerRideJoinRejectedNotification(
            rideId,
            passengerId,
            passengerId,
            request.passengerName
          );
        } else if (action === "accept") {
          const canJoin = await this.subscriptionService.canJoinRide(passengerId);
          if (!canJoin) {
            const { joinRides } = await this.subscriptionService.getRemainingRideCounts(passengerId);
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

          const driver = await this.userRepo.findUserById(ride.driverId, { session });
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
          await this.userRepo.updateOne(
            { _id: driver._id },
            { $set: { wallet: driver.wallet } },
            { session }
          );

          await this.subscriptionService.decrementJoinRideCount(passengerId);

          await this.rideRepo.updateOne(
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

          await this.notificationService.triggerRideJoinAcceptedNotification(
            rideId,
            passengerId,
            request.passengerName
          );
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[RideService] Error handling join request for ride ${rideId}:`,
        errorMessage
      );
      throw new Error(`Failed to handle join request: ${errorMessage}`);
    } finally {
      await session.endSession();
    }
  }
}

// function createHmac(arg0: string, arg1: string) {
//     throw new Error("Function not implemented.");
// }
