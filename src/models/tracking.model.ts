import { Schema, model, Document, Types } from "mongoose";

export interface ITracking extends Document {
  rideId: Types.ObjectId;
  currentPosition: [number, number]; 
  lastUpdated: Date;
  status: "Started" | "Completed";
  driverId: Types.ObjectId;
}

const TrackingSchema = new Schema<ITracking>(
  {
    rideId: { type: Schema.Types.ObjectId, ref: "Ride", required: true, unique: true },
    currentPosition: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: [number, number]) => v.length === 2 && !v.some(isNaN),
        message: "Current position must be a valid [latitude, longitude] array",
      },
    },
    lastUpdated: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["Started", "Completed"], required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const TrackingModel = model<ITracking>("Tracking", TrackingSchema);