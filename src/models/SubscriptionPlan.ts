import { Schema, model, Document, Types } from "mongoose";

export interface ISubscriptionPlan extends Document {
  name: string;
  durationMonths: number;
  price: number;
  description: string;
  maxStartingRides: number; // Maximum rides the user can start per subscription period
  maxJoiningRides: number;  // Maximum rides the user can join per subscription period
  status: "Active" | "Blocked";
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const SubscriptionPlanSchema: Schema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true, unique: true },
    durationMonths: { type: Number, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    maxStartingRides: { type: Number, required: true, default: 3 },
    maxJoiningRides: { type: Number, required: true, default: 3 },
    status: { 
      type: String, 
      enum: ["Active", "Blocked"], 
      default: "Active" 
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const SubscriptionPlanModel = model<ISubscriptionPlan>("SubscriptionPlan", SubscriptionPlanSchema);