import { Schema, model, Document, Types } from "mongoose";

export interface PickupDropoffPoint {
  passengerId: string;
  location: string;
  placeName: string;
}

export interface Passenger {
  passengerId: string;
  passengerName: string;
  pickedUp: boolean;
  droppedOff: boolean;
  distanceKm: number; // New: Store passenger's travel distance
  cost: number; // New: Store passenger's specific cost
}

export interface PendingRequest {
  passengerId: string;
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupPlaceName: string;
  dropoffPlaceName: string;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  requestedAt: Date;
  status: "pending" | "accepted" | "rejected";
  distanceKm: number; // New: Store passenger's segment distance
}

export interface IRide extends Document {
  createdAt: any;
  _id: Types.ObjectId;
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
  perKmRate: number; // New: Store per-km rate
  passengerDistances: { passengerId: string; distanceKm: number }[]; // New: Track distances
  passengerCosts: { passengerId: string; cost: number }[]; // New: Track costs
  passengers: Passenger[];
  status: string;
  routeGeometry?: string;
  pickupPoints: PickupDropoffPoint[];
  dropoffPoints: PickupDropoffPoint[];
  routeCoordinates: [number, number][];
  pendingRequests: PendingRequest[];
}

export interface RideCreationData {
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
  perKmRate: number; // New: Store per-km rate
  passengers: Passenger[];
  status: string;
  routeGeometry?: string;
  pickupPoints: PickupDropoffPoint[];
  dropoffPoints: PickupDropoffPoint[];
  routeCoordinates: [number, number][];
}

const RideSchema = new Schema<IRide>(
  {
    rideId: { type: String, required: true, unique: true },
    driverId: { type: String, required: true },
    driverName: { type: String, required: true },
    vehicleId: { type: String, ref: "Vehicle", required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    startPoint: { type: String, required: true },
    startPlaceName: { type: String, required: true },
    endPoint: { type: String, required: true },
    endPlaceName: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    mileage: { type: Number, required: true },
    fuelPrice: { type: Number, required: true },
    passengerCount: { type: Number, required: true },
    totalFuelCost: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    totalRideCost: { type: Number, required: true },
    perKmRate: { type: Number, required: true }, // New
    passengerDistances: [
      {
        passengerId: { type: String, required: true },
        distanceKm: { type: Number, required: true },
      },
    ], // New
    passengerCosts: [
      {
        passengerId: { type: String, required: true },
        cost: { type: Number, required: true },
      },
    ], // New
    passengers: [
      {
        passengerId: { type: String, required: true },
        passengerName: { type: String, required: true },
        pickedUp: { type: Boolean, default: false },
        droppedOff: { type: Boolean, default: false },
        distanceKm: { type: Number, required: true }, // New
        cost: { type: Number, required: true }, // New
      },
    ],
    status: { type: String, required: true },
    routeGeometry: { type: String },
    pickupPoints: [
      {
        passengerId: { type: String, required: true },
        location: { type: String, required: true },
        placeName: { type: String, required: true },
      },
    ],
    dropoffPoints: [
      {
        passengerId: { type: String, required: true },
        location: { type: String, required: true },
        placeName: { type: String, required: true },
      },
    ],
    pendingRequests: [
      {
        passengerId: { type: String, required: true },
        passengerName: { type: String, required: true },
        pickupLocation: { type: String, required: true },
        dropoffLocation: { type: String, required: true },
        pickupPlaceName: { type: String, required: true },
        dropoffPlaceName: { type: String, required: true },
        paymentId: { type: String, required: false },
        orderId: { type: String, required: false },
        signature: { type: String, required: false },
        requestedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
        distanceKm: { type: Number, required: true }, // New
      },
    ],
    routeCoordinates: { type: [[Number]], required: true },
  },
  { timestamps: true }
);

export const RideModel = model<IRide>("Ride", RideSchema);
