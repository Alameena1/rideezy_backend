import { Schema, model, Document, Types } from 'mongoose';
import { IUser } from './user.model';

export interface IVehicle extends Document {
  user: Types.ObjectId | IUser;
  vehicleName: string;
  vehicleType: string;
  licensePlate: string;
  color?: string;
  insuranceNumber?: string;
  vehicleImage: string;
  documentImage: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  note: string;
  createdAt?: Date;
  updatedAt?: Date;
  mileage: number;
  seatCapacity: number; // New field for seat capacity
  _id: any;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vehicleName: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      required: true,
      trim: true,
      enum: ['Motorcycle', 'Car', 'Truck', 'Van'],
    },
    licensePlate: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    insuranceNumber: {
      type: String,
      trim: true,
    },
    vehicleImage: {
      type: String,
      required: true,
      trim: true,
    },
    documentImage: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    note: {
      type: String,
      trim: true,
    },
    mileage: {
      type: Number,
      required: true,
    },
    seatCapacity: {
      type: Number,
      required: true, // Seat capacity is required
      min: [1, 'Seat capacity must be at least 1'],
    },
  },
  { timestamps: true }
);

const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);
export default VehicleModel;