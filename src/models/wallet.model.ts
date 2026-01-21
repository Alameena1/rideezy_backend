import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  subscription?: {
    planId: Schema.Types.ObjectId;
    startDate: Date;
    endDate: Date;
  };
  monthlyRideCount: number;
  lastRideReset: Date;
  vehicles: string[];
  wallet: {
    balance: number;
    transactions: {
      transactionId: string;
      type: "DEPOSIT" | "WITHDRAWAL" | "SUBSCRIPTION";
      amount: number;
      status: "PENDING" | "COMPLETED" | "FAILED";
      createdAt: Date;
    }[];
  };
}

const UserSchema: Schema = new Schema<IUser>(
  {
    subscription: {
      planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      startDate: { type: Date },
      endDate: { type: Date },
    },
    monthlyRideCount: { type: Number, default: 0 },
    lastRideReset: { type: Date, default: Date.now },
    vehicles: [{ type: String }],
    wallet: {
      balance: { type: Number, default: 0 },
      transactions: [
        {
          transactionId: { type: String, required: true },
          type: { type: String, enum: ["DEPOSIT", "WITHDRAWAL", "SUBSCRIPTION"], required: true },
          amount: { type: Number, required: true },
          status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED"], default: "PENDING" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
    },
  },
  { timestamps: true }
);

export default model<IUser>("User", UserSchema);