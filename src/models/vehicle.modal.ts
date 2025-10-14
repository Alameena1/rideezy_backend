import { Schema, model, Document, Types } from 'mongoose';
import { IUser } from './user.model';

export interface IVehicle extends Document {
  user: Types.ObjectId | IUser;
  vehicleName: string;
  vehicleType: string;
  licensePlate: string;
  color?: string;
  insurance: {
    number: string;
    image: string;
    startDate: Date;
    endDate: Date;
    status: 'Active' | 'Expired' | 'Pending';
  };
  pollution: {
    number: string;
    image: string;
    startDate: Date;
    endDate: Date;
    status: 'Active' | 'Expired' | 'Pending';
  };
  vehicleImage: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  note: string;
  createdAt?: Date;
  updatedAt?: Date;
  mileage: number;
  seatCapacity: number;
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
    insurance: {
      number: {
        type: String,
        required: true,
        trim: true,
      },
      image: {
        type: String,
        required: true,
        trim: true,
      },
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      status: {
        type: String,
        enum: ['Active', 'Expired', 'Pending'],
        default: 'Pending',
      },
    },
    pollution: {
      number: {
        type: String,
        required: true,
        trim: true,
      },
      image: {
        type: String,
        required: true,
        trim: true,
      },
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      status: {
        type: String,
        enum: ['Active', 'Expired', 'Pending'],
        default: 'Pending',
      },
    },
    vehicleImage: {
      type: String,
      required: true,
      trim: true,
    },
    // REMOVED: documentImage field
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
      required: true,
      min: [1, 'Seat capacity must be at least 1'],
    },
  },
  { timestamps: true }
);

// Add index for better search performance
VehicleSchema.index({ 
  vehicleName: 'text', 
  licensePlate: 'text',
  'insurance.number': 'text',
  'pollution.number': 'text'
});

// Middleware to update document status based on dates
VehicleSchema.pre('save', function(next) {
  const now = new Date();
  
  // Update insurance status
  if (this.insurance.endDate < now) {
    this.insurance.status = 'Expired';
  } else if (this.insurance.startDate <= now && this.insurance.endDate >= now) {
    this.insurance.status = 'Active';
  }
  
  // Update pollution status
  if (this.pollution.endDate < now) {
    this.pollution.status = 'Expired';
  } else if (this.pollution.startDate <= now && this.pollution.endDate >= now) {
    this.pollution.status = 'Active';
  }
  
  next();
});

const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);
export default VehicleModel;