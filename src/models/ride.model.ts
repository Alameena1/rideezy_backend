import { Schema, model, Document, Types } from 'mongoose';

// src/models/ride.model.ts
export interface IRide extends Document {
  rideId: string;
  driverId: string;
  driverName: string; // Add driverName
  vehicleId: string;
  date: Date;
  time: string;
  startPoint: string;
  startPlaceName: string; // Add startPlaceName
  endPoint: string;
  endPlaceName: string; // Add endPlaceName
  distanceKm: number;
  mileage: number;
  fuelPrice: number;
  passengerCount: number;
  totalFuelCost: number;
  costPerPerson: number;
  totalPeople: number;
  passengers: { passengerId: string; passengerName: string }[];
  status: 'Pending' | 'Started' | 'Completed';
  routeGeometry: string;
  pickupPoints: { passengerId: string; location: string; placeName: string }[];
  dropoffPoints: { passengerId: string; location: string; placeName: string }[];
  routeCoordinates?: [number, number][];
}

export type RideCreationData = Omit<
  IRide,
  keyof Document | 'createdAt' | 'updatedAt' | '__v'
>;

const rideSchema = new Schema<IRide>(
  {
    rideId: { type: String, required: true, unique: true },
    driverId: { type: String, required: true },
    driverName: { type: String, required: true }, // Add driverName
    vehicleId: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    startPoint: { type: String, required: true },
    startPlaceName: { type: String, required: true }, // Add startPlaceName
    endPoint: { type: String, required: true },
    endPlaceName: { type: String, required: true }, // Add endPlaceName
    distanceKm: { type: Number, required: true },
    mileage: { type: Number, required: true },
    fuelPrice: { type: Number, required: true },
    passengerCount: { type: Number, required: true },
    totalFuelCost: { type: Number, required: true },
    costPerPerson: { type: Number, required: true },
    totalPeople: { type: Number, required: true },
    passengers: {
      type: [
        {
          passengerId: { type: String, required: true },
          passengerName: { type: String, required: true },
        },
      ],
      default: [],
    },
    status: { type: String, enum: ['Pending', 'Started', 'Completed'], default: 'Pending' },
    routeGeometry: { type: String, required: true },
    pickupPoints: {
      type: [
        {
          passengerId: { type: String, required: true },
          location: { type: String, required: true },
          placeName: { type: String, required: true }, // Add placeName
        },
      ],
      required: true,
      default: [],
    },
    dropoffPoints: {
      type: [
        {
          passengerId: { type: String, required: true },
          location: { type: String, required: true },
          placeName: { type: String, required: true }, // Add placeName
        },
      ],
      required: true,
      default: [],
    },
    routeCoordinates: { type: [[Number]], required: false },
  },
  { timestamps: true }
);

export const RideModel = model<IRide>('Ride', rideSchema);