// src/models/SubscriptionPlan.ts
import { Schema, model, Document } from "mongoose";

export interface ISubscriptionPlan extends Document {
  name: string;
  durationMonths: number;
  price: number;
  description: string;
  status: "Active" | "Blocked";
  createdAt?: Date;
  updatedAt?: Date;
}

const SubscriptionPlanSchema: Schema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true, unique: true },
    durationMonths: { type: Number, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["Active", "Blocked"], 
      default: "Active" 
    },
  },
  { timestamps: true }
);

export const SubscriptionPlanModel = model<ISubscriptionPlan>("SubscriptionPlan", SubscriptionPlanSchema);