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
  distanceKm: number;
  cost: number;
  refundAmount?: number;
  refundStatus?: "pending" | "processed" | "failed";
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
  distanceKm: number;
}

export interface EmergencyStop {
  reason: string;
  stoppedAt: Date;
  currentPosition: [number, number];
  totalDistanceTraveled: number;
  estimatedRemainingDistance: number;
  refundPercentage: number;
}

// NEW: Block Details interface
export interface BlockDetails {
  reason: string;
  blockType: string;
  duration: string;
  blockedAt: Date;
  blockedBy: string;
  previousStatus: string;
}

// Define the ride status type
export type RideStatus = "Pending" | "Started" | "Completed" | "Cancelled" | "EmergencyStopped" | "Blocked";

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
  perKmRate: number;
  passengerDistances: { passengerId: string; distanceKm: number }[];
  passengerCosts: { passengerId: string; cost: number }[];
  passengers: Passenger[];
  status: RideStatus; // UPDATED: Use the defined type
  routeGeometry?: string;
  pickupPoints: PickupDropoffPoint[];
  dropoffPoints: PickupDropoffPoint[];
  routeCoordinates: [number, number][];
  pendingRequests: PendingRequest[];
  emergencyStop?: EmergencyStop;
  currentPosition?: [number, number];
  totalDistanceTraveled?: number;
  blockDetails?: BlockDetails;
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
  perKmRate: number;
  passengers: any[];
  status: RideStatus; // UPDATED: Use the defined type instead of string
  routeGeometry?: string;
  pickupPoints: any[];
  dropoffPoints: any[];
  routeCoordinates: [number, number][];
  passengerDistances: { passengerId: string; distanceKm: number }[];
  passengerCosts: { passengerId: string; cost: number }[];
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
    perKmRate: { type: Number, required: true },
    passengerDistances: [
      {
        passengerId: { type: String, required: true },
        distanceKm: { type: Number, required: true },
      },
    ],
    passengerCosts: [
      {
        passengerId: { type: String, required: true },
        cost: { type: Number, required: true },
      },
    ],
    passengers: [
      {
        passengerId: { type: String, required: true },
        passengerName: { type: String, required: true },
        pickedUp: { type: Boolean, default: false },
        droppedOff: { type: Boolean, default: false },
        distanceKm: { type: Number, required: true },
        cost: { type: Number, required: true },
        refundAmount: { type: Number, default: 0 },
        refundStatus: { type: String, enum: ["pending", "processed", "failed"], default: "pending" },
      },
    ],
    status: { 
      type: String, 
      required: true,
      enum: ["Pending", "Started", "Completed", "Cancelled", "EmergencyStopped", "Blocked"]
    },
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
        distanceKm: { type: Number, required: true },
      },
    ],
    routeCoordinates: { type: [[Number]], required: true },
    emergencyStop: {
      reason: { type: String },
      stoppedAt: { type: Date },
      currentPosition: { type: [Number] },
      totalDistanceTraveled: { type: Number },
      estimatedRemainingDistance: { type: Number },
      refundPercentage: { type: Number },
    },
    currentPosition: { type: [Number] },
    totalDistanceTraveled: { type: Number, default: 0 },
    blockDetails: {
      reason: { type: String },
      blockType: { type: String },
      duration: { type: String, default: "temporary" },
      blockedAt: { type: Date },
      blockedBy: { type: String }, 
      previousStatus: { type: String }
    }
  },
  { timestamps: true }
);

export const RideModel = model<IRide>("Ride", RideSchema);