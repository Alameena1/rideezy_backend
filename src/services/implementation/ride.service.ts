import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IRideService } from "../interfaces/ride/irideService";
import { IRideRepository } from "../../repositories/interface/ride/irideRepository";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { CreateRideDto } from "../../dtos/create-ride.dto";
import { OSRMClient, RouteResponse } from "../../infrastructure/map-api/osrm.client";
import { IRide, RideCreationData } from "../../models/ride.model";
import axios from "axios";
import Razorpay from "razorpay";
import { createHmac } from "crypto";

@injectable()
export class RideService implements IRideService {
  private rideRepo: IRideRepository;
  private vehicleRepo: IVehicleRepository;
  private userRepo: IUserRepository;
  private subscriptionService: ISubscriptionService;
  private osrmClient: OSRMClient;
  private razorpay: Razorpay;

  constructor(
    @inject(TYPES.IRideRepository) rideRepository: IRideRepository,
    @inject(TYPES.IVehicleRepository) vehicleRepository: IVehicleRepository,
    @inject(TYPES.IUserRepository) userRepository: IUserRepository,
    @inject(TYPES.ISubscriptionService) subscriptionService: ISubscriptionService
  ) {
    this.rideRepo = rideRepository;
    this.vehicleRepo = vehicleRepository;
    this.userRepo = userRepository;
    this.subscriptionService = subscriptionService;
    this.osrmClient = new OSRMClient(process.env.OSRM_URL || "http://localhost:5000");
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_KOCURsj88Mu4Sj",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI",
    });
  }

  async startRide(dto: CreateRideDto): Promise<IRide> {
    const canBook = await this.subscriptionService.canBookRide(dto.driverId!);
    console.log("Ride Creation DTO:", dto);
    if (!canBook) {
      throw new Error("Ride limit exceeded. Please subscribe to book more rides.");
    }

    const vehicle = await this.vehicleRepo.findById(dto.vehicleId);
    if (!vehicle) {
      throw new Error("Selected vehicle not found");
    }
    if (vehicle.user.toString() !== dto.driverId) {
      throw new Error("Vehicle does not belong to the driver");
    }
    if (vehicle.status !== "Approved") {
      throw new Error("Vehicle is not approved for rides");
    }

    if (dto.startPoint === dto.endPoint) {
      throw new Error("Start point and end point cannot be the same");
    }

    const driver = await this.userRepo.findUserById(dto.driverId!);
    if (!driver) {
      throw new Error("Driver not found");
    }
    const driverName = driver.fullName;

    const route = await this.osrmClient.getRoute([dto.startPoint, dto.endPoint]);
    const routeCoordinates = route.coordinates;
    if (routeCoordinates.length < 2) {
      console.error("Invalid route coordinates during ride creation:", routeCoordinates);
      throw new Error("Failed to calculate route between start and end points");
    }

    const [startLat, startLng] = dto.startPoint.split(",").map(Number);
    const [endLat, endLng] = dto.endPoint.split(",").map(Number);
    const startPlaceName = await this.reverseGeocode(startLat, startLng);
    const endPlaceName = await this.reverseGeocode(endLat, endLng);

    const distanceKm = dto.distanceKm;
    const totalFuelCost = dto.totalFuelCost;
    const costPerPerson = dto.costPerPerson;
    const routeGeometry = dto.routeGeometry;
    const totalPeople = dto.passengerCount + 1;

    let rideId: string;
    let existingRide: IRide | null;
    do {
      rideId = `RIDE_${Date.now()}`;
      existingRide = await this.rideRepo.findOne({ rideId });
    } while (existingRide);

    const rideData: RideCreationData = {
      rideId: rideId,
      driverId: dto.driverId!,
      driverName: driverName,
      vehicleId: dto.vehicleId,
      date: new Date(dto.date),
      time: dto.time,
      startPoint: dto.startPoint,
      startPlaceName,
      endPoint: dto.endPoint,
      endPlaceName,
      distanceKm: distanceKm,
      mileage: vehicle.mileage,
      fuelPrice: dto.fuelPrice,
      passengerCount: 0,
      totalFuelCost: totalFuelCost,
      costPerPerson: costPerPerson,
      totalPeople: totalPeople,
      passengers: [],
      status: "Pending",
      routeGeometry: routeGeometry,
      pickupPoints: [],
      dropoffPoints: [],
      routeCoordinates: routeCoordinates,
    };

    console.log(`Saving ride with routeCoordinates: ${routeCoordinates.length} points`);
    const ride = await this.rideRepo.createRide(rideData);
    return ride;
  }

  async joinRide(rideId: string, passengerId: string, pickupLocation: string, dropoffLocation: string): Promise<IRide> {
    const ride = await this.rideRepo.findOne({ rideId });
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (ride.passengers.some((p) => p.passengerId === passengerId)) {
      throw new Error("Passenger is already part of this ride");
    }

    const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
    const currentDateTime = new Date();
    if (currentDateTime >= rideDateTime) {
      await this.rideRepo.updateOne({ rideId }, { status: "Started" });
      throw new Error("Ride has already started");
    }

    const vehicle = await this.vehicleRepo.findById(ride.vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }
    const maxCapacity = 4;
    if (ride.passengers.length >= maxCapacity) {
      throw new Error("Ride is full");
    }

    const [startLat, startLng] = ride.startPoint.split(",").map(Number);
    const [endLat, endLng] = ride.endPoint.split(",").map(Number);
    const [pickupLat, pickupLng] = pickupLocation.split(",").map(Number);
    const [dropoffLat, dropoffLng] = dropoffLocation.split(",").map(Number);

    if (
      isNaN(startLat) ||
      isNaN(startLng) ||
      isNaN(endLat) ||
      isNaN(endLng) ||
      isNaN(pickupLat) ||
      isNaN(pickupLng) ||
      isNaN(dropoffLat) ||
      isNaN(dropoffLng)
    ) {
      throw new Error("Invalid coordinates format");
    }

    if (ride.startPoint === ride.endPoint) {
      throw new Error("Start point and end point cannot be the same");
    }

    const passenger = await this.userRepo.findUserById(passengerId);
    if (!passenger) {
      throw new Error("Passenger not found");
    }
    const passengerName = passenger.fullName;

    const pickupPlaceName = await this.reverseGeocode(pickupLat, pickupLng);
    const dropoffPlaceName = await this.reverseGeocode(dropoffLat, dropoffLng);

    let routeCoordinates = ride.routeCoordinates || [];
    if (routeCoordinates.length < 2) {
      const route = await this.osrmClient.getRoute([ride.startPoint, ride.endPoint]);
      routeCoordinates = route.coordinates;
      await this.rideRepo.updateOne({ rideId }, { routeCoordinates });
    }

    const JOIN_THRESHOLD = 0.5; // 500 meters
    let pickupPointStr = pickupLocation;
    let dropoffPointStr = dropoffLocation;

    const nearestPickupPoint = await this.osrmClient.findNearestPointOnRoute(routeCoordinates, [
      pickupLat,
      pickupLng,
    ]);
    const distanceToPickupRoute = this.osrmClient.haversineDistance(nearestPickupPoint, [
      pickupLat,
      pickupLng,
    ]);
    if (distanceToPickupRoute > JOIN_THRESHOLD) {
      throw new Error("Pickup location is too far from the route");
    }
    pickupPointStr = `${nearestPickupPoint[0]},${nearestPickupPoint[1]}`;

    const nearestDropoffPoint = await this.osrmClient.findNearestPointOnRoute(routeCoordinates, [
      dropoffLat,
      dropoffLng,
    ]);
    const distanceToDropoffRoute = this.osrmClient.haversineDistance(nearestDropoffPoint, [
      dropoffLat,
      dropoffLng,
    ]);
    if (distanceToDropoffRoute > JOIN_THRESHOLD) {
      throw new Error("Drop-off location is too far from the route");
    }
    dropoffPointStr = `${nearestDropoffPoint[0]},${nearestDropoffPoint[1]}`;

    const pickupPoints = [
      ...ride.pickupPoints,
      { passengerId, location: pickupPointStr, placeName: pickupPlaceName },
    ];
    const dropoffPoints = [
      ...ride.dropoffPoints,
      { passengerId, location: dropoffPointStr, placeName: dropoffPlaceName },
    ];
    const updatedPassengers = [...ride.passengers, { passengerId, passengerName }];
    const newPassengerCount = updatedPassengers.length;

    const fuelNeeded = ride.distanceKm / ride.mileage;
    const totalFuelCost = fuelNeeded * ride.fuelPrice;
    const costPerPerson = ride.totalPeople > 0 ? totalFuelCost / ride.totalPeople : 0;

    await this.rideRepo.updateOne(
      { rideId },
      {
        passengers: updatedPassengers,
        passengerCount: newPassengerCount,
        totalFuelCost,
        costPerPerson,
        pickupPoints,
        dropoffPoints,
      }
    );

    const updatedRide = await this.rideRepo.findOne({ rideId });
    if (!updatedRide) {
      throw new Error("Failed to retrieve updated ride");
    }

    return updatedRide;
  }

  async getRides(userId: string): Promise<IRide[]> {
    const rides = await this.rideRepo.find({ driverId: userId });
    return rides;
  }

  async findNearestRides(
    userLocation: string,
    destination: string,
    maxDistanceToRouteKm: number = 1.0,
    maxDistanceToEndKm: number = 5
  ): Promise<IRide[]> {
    const [userLat, userLng] = userLocation.split(",").map(Number);
    const [destLat, destLng] = destination.split(",").map(Number);

    if (isNaN(userLat) || isNaN(userLng) || isNaN(destLat) || isNaN(destLng)) {
      throw new Error("Invalid coordinates format");
    }

    const userCoords: [number, number] = [userLat, userLng];
    const destCoords: [number, number] = [destLat, destLng];

    const currentDateTime = new Date();
    console.log(`Current DateTime: ${currentDateTime.toISOString()}`);

    const rides = await this.rideRepo.find({
      status: "Pending",
    });

    console.log(`Found ${rides.length} Pending Rides`);

    if (!rides || rides.length === 0) {
      console.log("No pending rides found");
      return [];
    }

    const availableRides = await Promise.all(
      rides.map(async (ride) => {
        const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
        console.log(`Ride ${ride.rideId} DateTime: ${rideDateTime.toISOString()}`);

        if (currentDateTime >= rideDateTime) {
          console.log(`Ride ${ride.rideId} has started`);
          await this.rideRepo.updateOne({ rideId: ride.rideId }, { status: "Started" });
          return null;
        }

        const maxCapacity = 4;
        if (ride.passengers.length >= maxCapacity) {
          console.log(`Ride ${ride.rideId} is full (Passengers: ${ride.passengers.length})`);
          return null;
        }

        const [startLat, startLng] = ride.startPoint.split(",").map(Number);
        const [endLat, endLng] = ride.endPoint.split(",").map(Number);
        const startCoords: [number, number] = [startLat, startLng];
        const endCoords: [number, number] = [endLat, endLng];

        console.log(`Ride ${ride.rideId} Start Point:`, ride.startPoint);
        console.log(`Ride ${ride.rideId} End Point:`, ride.endPoint);

        let route: RouteResponse = {
          distance: 0,
          duration: 0,
          geometry: JSON.stringify({
            type: "LineString",
            coordinates: [
              [startLng, startLat],
              [endLng, endLat],
            ],
          }),
          coordinates: [
            [startLat, startLng],
            [endLat, endLng],
          ],
        };

        if (ride.routeCoordinates && ride.routeCoordinates.length >= 2) {
          const firstCoord = ride.routeCoordinates[0];
          const lastCoord = ride.routeCoordinates[ride.routeCoordinates.length - 1];
          const distToStart = this.osrmClient.haversineDistance(
            [firstCoord[0], firstCoord[1]],
            startCoords
          );
          const distToEnd = this.osrmClient.haversineDistance(
            [lastCoord[0], lastCoord[1]],
            endCoords
          );
          const areCoordinatesValid =
            distToStart < 0.1 &&
            distToEnd < 0.1 &&
            (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]);

          if (areCoordinatesValid) {
            console.log(`Using stored route coordinates for Ride ${ride.rideId}`);
            route = {
              distance: ride.distanceKm,
              duration: 0,
              geometry: ride.routeGeometry,
              coordinates: ride.routeCoordinates,
            };
          } else {
            console.log(`Stored route coordinates for Ride ${ride.rideId} are invalid:`, ride.routeCoordinates);
          }
        }

        if (
          route.coordinates.length < 2 ||
          (route.coordinates[0][0] === route.coordinates[1][0] &&
            route.coordinates[0][1] === route.coordinates[1][1])
        ) {
          console.log(`Fetching route for Ride ${ride.rideId} from OSRM`);
          const routeResponse = await this.osrmClient.getRoute([ride.startPoint, ride.endPoint]);
          route = {
            distance: routeResponse.distance,
            duration: routeResponse.duration,
            geometry: routeResponse.geometry,
            coordinates: routeResponse.coordinates,
          };
          await this.rideRepo.updateOne(
            { rideId: ride.rideId },
            { $set: { routeCoordinates: route.coordinates } }
          );
          console.log(`Updated Ride ${ride.rideId} with new route coordinates`);
        }

        if (route.coordinates.length < 2) {
          console.error(`Failed to fetch route for ride ${ride.rideId}: Invalid route coordinates`);
          return null;
        }

        console.log(`Ride ${ride.rideId} Route Coordinates:`, route.coordinates);

        const nearestPointToUser = await this.osrmClient.findNearestPointOnRoute(
          route.coordinates,
          userCoords
        );
        const distanceToRoute = this.osrmClient.haversineDistance(nearestPointToUser, userCoords);

        console.log(`User Location:`, userCoords);
        console.log(`Nearest Point to User:`, nearestPointToUser);
        console.log(`Distance to Route (km):`, distanceToRoute);

        if (distanceToRoute > maxDistanceToRouteKm) {
          console.log(
            `Ride ${ride.rideId} excluded: User location too far from route (${distanceToRoute} km)`
          );
          return null;
        }

        const nearestPointToDest = await this.osrmClient.findNearestPointOnRoute(
          route.coordinates,
          destCoords
        );
        const distanceToDest = this.osrmClient.haversineDistance(nearestPointToDest, destCoords);

        console.log(`Destination:`, destCoords);
        console.log(`Nearest Point to Destination:`, nearestPointToDest);
        console.log(`Distance to Destination (km):`, distanceToDest);

        if (distanceToDest > maxDistanceToRouteKm) {
          console.log(
            `Ride ${ride.rideId} excluded: Destination too far from route (${distanceToDest} km)`
          );
          return null;
        }

        const distanceToStart = this.osrmClient.haversineDistance(startCoords, userCoords);
        const distanceToEnd = this.osrmClient.haversineDistance(endCoords, destCoords);
        const NEARBY_THRESHOLD = 0.1; // 100 meters
        const isNearStart = distanceToStart < NEARBY_THRESHOLD;
        const isNearEnd = distanceToEnd < NEARBY_THRESHOLD;
        if (isNearStart && isNearEnd) {
          console.log(
            `Ride ${ride.rideId} included: Near-exact match (Start distance: ${distanceToStart} km, End distance: ${distanceToEnd} km)`
          );
          return {
            ride,
            distanceToRoute,
            distanceToDest,
          };
        }

        let userIndex = -1;
        let destIndex = -1;

        if (route.coordinates.length === 2) {
          const userToStart = this.osrmClient.haversineDistance(userCoords, startCoords);
          const userToEnd = this.osrmClient.haversineDistance(userCoords, endCoords);
          const destToStart = this.osrmClient.haversineDistance(destCoords, startCoords);
          const destToEnd = this.osrmClient.haversineDistance(destCoords, endCoords);

          console.log(`User to Start: ${userToStart} km, User to End: ${userToEnd} km`);
          console.log(`Dest to Start: ${destToStart} km, Dest to End: ${destToEnd} km`);

          const userCloserToStart = userToStart < userToEnd;
          const destCloserToEnd = destToEnd < destToStart;

          if (userCloserToStart && destCloserToEnd) {
            userIndex = 0;
            destIndex = 1;
            console.log(
              `Route has only 2 points, assuming linear progression: User Index: ${userIndex}, Dest Index: ${destIndex}`
            );
          } else {
            console.log(`Ride ${ride.rideId} excluded: Direction mismatch with 2-point route`);
            return null;
          }
        } else {
          for (let i = 0; i < route.coordinates.length; i++) {
            const distToUser = this.osrmClient.haversineDistance(
              route.coordinates[i],
              nearestPointToUser
            );
            if (distToUser < 0.005 && userIndex === -1) {
              userIndex = i;
              console.log(`Matched User at index ${i}: Distance ${distToUser} km`);
            }

            const distToDest = this.osrmClient.haversineDistance(
              route.coordinates[i],
              nearestPointToDest
            );
            if (distToDest < 0.005 && destIndex === -1) {
              destIndex = i;
              console.log(`Matched Destination at index ${i}: Distance ${distToDest} km`);
            }

            if (userIndex !== -1 && destIndex !== -1) {
              break;
            }
          }
        }

        console.log(`User Index: ${userIndex}, Dest Index: ${destIndex}`);

        if (userIndex === -1 || destIndex === -1) {
          console.log(
            `Ride ${ride.rideId} excluded: Could not match points on route (User Index: ${userIndex}, Dest Index: ${destIndex})`
          );
          return null;
        }

        if (userIndex > destIndex) {
          console.log(
            `Ride ${ride.rideId} excluded: Direction mismatch (User Index: ${userIndex}, Dest Index: ${destIndex})`
          );
          return null;
        }

        console.log(`Ride ${ride.rideId} included in results`);
        return {
          ride,
          distanceToRoute,
          distanceToDest,
        };
      })
    );

    const filteredRides = availableRides
      .filter(
        (ride): ride is { ride: IRide; distanceToRoute: number; distanceToDest: number } =>
          ride !== null
      )
      .sort((a, b) => {
        const totalDistanceA = a.distanceToRoute + a.distanceToDest;
        const totalDistanceB = b.distanceToRoute + b.distanceToDest;
        return totalDistanceA - totalDistanceB;
      });

    console.log(`Returning ${filteredRides.length} rides`);
    return filteredRides.map((item) => item.ride);
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      return response.data.display_name || `${lat},${lng}`;
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return `${lat},${lng}`;
    }
  }

async createRidePaymentOrder(rideId: string): Promise<any> {
  const ride = await this.rideRepo.findOne({ rideId });
  if (!ride) {
    throw new Error("Ride not found");
  }

  const rideDateTime = new Date(`${ride.date.toISOString().split("T")[0]}T${ride.time}:00`);
  const currentDateTime = new Date();
  if (currentDateTime >= rideDateTime) {
    await this.rideRepo.updateOne({ rideId }, { status: "Started" });
    throw new Error("Ride has already started");
  }

  const maxCapacity = 4;
  if (ride.passengers.length >= maxCapacity) {
    throw new Error("Ride is full");
  }

  // Log the costPerPerson to debug
  console.log(`Ride ${rideId} costPerPerson: ₹${ride.costPerPerson}`);

  // Calculate amount in paise and round to the nearest integer
  const amountInPaise = Math.round(ride.costPerPerson * 100);
  if (amountInPaise < 100) {
    throw new Error(`Amount must be at least ₹1 (100 paise), got ₹${ride.costPerPerson}`);
  }

  const timestamp = Date.now().toString().slice(-6);
  const shortRideId = rideId.slice(-8);
  const receipt = `ride_${shortRideId}_${timestamp}`;

  const options = {
    amount: amountInPaise,
    currency: "INR",
    receipt: receipt,
  };

  console.log("Creating Razorpay order for ride payment with options:", options);
  const order = await this.razorpay.orders.create(options);
  console.log("Razorpay order created for ride:", order);

  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
  };
}

  // New method to verify payment and join the ride
  async verifyAndJoinRide(
    rideId: string,
    passengerId: string,
    pickupLocation: string,
    dropoffLocation: string,
    paymentId: string,
    orderId: string,
    signature: string
  ): Promise<IRide> {
    const generatedSignature = createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET || "64CY4QIGucP0t33gP8JodsqI"
    )
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      throw new Error("Invalid payment signature");
    }

    return await this.joinRide(rideId, passengerId, pickupLocation, dropoffLocation);
  }
}