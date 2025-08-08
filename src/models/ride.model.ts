import { Schema, model, Document, Types } from "mongoose";

export interface PickupDropoffPoint {
  passengerId: string;
  location: string;
  placeName: string;
}

export interface Passenger {
  droppedOff: boolean;
  pickedUp: any; // Consider refining this type (e.g., to boolean) based on your needs
  passengerId: string;
  passengerName: string;
}

export interface PendingRequest {
  passengerId: string;
  passengerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  paymentId: string;
  pickupPlaceName: string;
  dropoffPlaceName: string;
  orderId: string;
  signature: string;
  requestedAt: Date;
  status: "pending" | "accepted" | "rejected";
}

export interface IRide extends Document {
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
  costPerPerson: number;
  totalPeople: number;
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
  costPerPerson: number;
  totalPeople: number;
  passengers: Passenger[];
  status: string;
  routeGeometry?: string;
  pickupPoints: PickupDropoffPoint[];
  dropoffPoints: PickupDropoffPoint[];
  routeCoordinates: [number, number][];
}

const RideSchema = new Schema<IRide>({ 
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
  costPerPerson: { type: Number, required: true },
  totalPeople: { type: Number, required: true },
  passengers: [
    {
      passengerId: { type: String, required: true },
      passengerName: { type: String, required: true },
      pickedUp: { type: Boolean, default: false },
      droppedOff: { type: Boolean, default: false },
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
    },
  ],
  routeCoordinates: { type: [[Number]], required: true },
});

export const RideModel = model<IRide>("Ride", RideSchema);