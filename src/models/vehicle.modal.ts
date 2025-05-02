import { Schema, model, Document, Types } from 'mongoose';
import { IUser } from './user.model';

export interface IVehicle extends Document {
  user: Types.ObjectId | IUser;
  vehicleName: string;
  vehicleType: string;
  licensePlate: string;
  color?: string;
  insuranceNumber?: string;
  vehicleImage: string; // Changed to required
  documentImage: string; // Changed to required
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt?: Date;
  updatedAt?: Date;
  mileage: number; // Added mileage property
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
    mileage: {
      type: Number,
      required: true, // Mileage is now required for ride calculations
    },
  },
  { timestamps: true }
);

const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);
export default VehicleModel;