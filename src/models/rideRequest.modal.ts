import { Schema, model, Document, Types } from "mongoose";

export interface IRideRequest extends Document {
  rideId: string;
  passengerId: string;
  pickupLocation: string;
  dropoffLocation: string;
  paymentOrderId: string;
  paymentId: string;
  signature: string;
  status: "Pending" | "Accepted" | "Rejected" | "Expired";
  createdAt: Date;
  updatedAt: Date;
}

const RideRequestSchema = new Schema<IRideRequest>(
  {
    rideId: { type: String, required: true, ref: "Ride" },
    passengerId: { type: String, required: true, ref: "User" },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    paymentOrderId: { type: String, required: true },
    paymentId: { type: String, required: true },
    signature: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Expired"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const RideRequestModel = model<IRideRequest>("RideRequest", RideRequestSchema);