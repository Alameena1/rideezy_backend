import { Schema, model, Document } from "mongoose";

export interface ISubscriptionPlan extends Document {
  name: string;
  durationMonths: number;
  price: number;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SubscriptionPlanSchema: Schema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true, unique: true },
    durationMonths: { type: Number, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

export const SubscriptionPlanModel = model<ISubscriptionPlan>("SubscriptionPlan", SubscriptionPlanSchema);