import { model, Schema, Types, Document } from "mongoose";

export interface ITracking extends Document {
  rideId: Types.ObjectId;
  currentPosition: [number, number];
  lastUpdated: Date;
  status: "Started" | "Paused" | "Completed";
  driverId: Types.ObjectId;
  pickupActions: { passengerId: string; location: string; status: "Pending" | "Completed" }[];
  dropoffActions: { passengerId: string; location: string; status: "Pending" | "Completed" }[];
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
    status: { type: String, enum: ["Started", "Paused", "Completed"], required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pickupActions: [
      {
        passengerId: { type: String, required: true },
        location: { type: String, required: true },
        status: { type: String, enum: ["Pending", "Completed"], default: "Pending" },
      },
    ],
    dropoffActions: [
      {
        passengerId: { type: String, required: true },
        location: { type: String, required: true },
        status: { type: String, enum: ["Pending", "Completed"], default: "Pending" },
      },
    ],
  },
  { timestamps: true }
);

export const TrackingModel = model<ITracking & Document>("Tracking", TrackingSchema);