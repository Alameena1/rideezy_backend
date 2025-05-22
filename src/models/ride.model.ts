import { Schema, model, Document, Types } from 'mongoose';

export interface IRide extends Document {
  rideId: string;
  driverId: string;
  vehicleId: string;
  date: Date;
  time: string;
  startPoint: string;
  endPoint: string;
  distanceKm: number;
  mileage: number;
  fuelPrice: number;
  passengerCount: number;
  totalFuelCost: number;
  costPerPerson: number;
  totalPeople: number;
  passengers: string[];
  status: 'Pending' | 'Started' | 'Completed';
  routeGeometry: string;
  pickupPoints: { passengerId: string; location: string }[];
}

// Type for creating a new ride (without Mongoose Document methods)
export type RideCreationData = Omit<
  IRide,
  keyof Document | 'createdAt' | 'updatedAt' | '__v'
>;

const rideSchema = new Schema<IRide>(
  {
    rideId: { type: String, required: true, unique: true },
    driverId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    startPoint: { type: String, required: true },
    endPoint: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    mileage: { type: Number, required: true },
    fuelPrice: { type: Number, required: true },
    passengerCount: { type: Number, required: true },
    totalFuelCost: { type: Number, required: true },
    costPerPerson: { type: Number, required: true },
    totalPeople: { type: Number, required: true },
    passengers: [{ type: String, default: [] }],
    status: { type: String, enum: ['Pending', 'Started', 'Completed'], default: 'Pending' },
    routeGeometry: { type: String, required: true },
    pickupPoints: {
      type: [
        {
          passengerId: { type: String, required: true },
          location: { type: String, required: true },
        },
      ],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

export const RideModel = model<IRide>('Ride', rideSchema);