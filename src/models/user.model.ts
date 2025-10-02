// user.model.ts
import { Schema, model, Document, Types } from "mongoose";
import { Country, State } from "country-state-city";

export interface IWallet {
  balance: number;
  transactions: {
    transactionId: string;
    type: "DEPOSIT" | "WITHDRAWAL" | "SUBSCRIPTION" | "REFUND";
    amount: number;
    status: "PENDING" | "COMPLETED" | "FAILED";
    createdAt: Date;
    description?: string;
  }[];
}

export interface IUser extends Document {
  walletBalance: number;
  wallet: IWallet;
  fullName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  provider?: string;
  image?: string;
  number?: string;
  state?: string;
  country?: string;
  gender?: string;
  status?: "Active" | "Blocked";
  govId?: {
    idNumber: string;
    verificationStatus: "Pending" | "Verified" | "Rejected";
    documentUrl?: string;
    reason: string;
  };
  subscription?: {
    planId: Types.ObjectId;
    planName: string;
    planDescription: string;
    durationMonths: number;
    maxStartingRides: number;
    maxJoiningRides: number;
    originalPrice: number;
    startDate: Date;
    endDate: Date;
    remainingStartRides: number;
    remainingJoinRides: number;
  };
  monthlyRideCount: number;
  lastRideReset: Date;
  vehicles: Array<{
    vehicleId: Types.ObjectId;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
  role: "user" | "admin";
  _id: any;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => v.split(/\s+/g).length < 10,
        message: "Full name must have less than 10 words",
      },
    },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String },
    password: { type: String },
    provider: { type: String, default: "local" },
    image: { type: String },
    number: { type: String },
    state: {
      type: String,
      validate: {
        validator: function (v: string) {
          if (!this.country || !v) return true; // Allow empty state if no country
          const country = Country.getAllCountries().find((c) => c.name === this.country);
          if (!country) return false;
          const states = State.getStatesOfCountry(country.isoCode);
          return states.some((s) => s.name === v);
        },
        message: "Invalid state for the selected country",
      },
    },
    country: {
      type: String,
      validate: {
        validator: (v: string) => !v || Country.getAllCountries().some((c) => c.name === v), // Allow empty string
        message: "Invalid country",
      },
    },
    gender: {
      type: String,
      enum: {
        values: ["Male", "Female", "Others"],
        message: "Invalid gender (must be Male, Female, or Others)",
      },
    },
    status: { type: String, enum: ["Active", "Blocked"], default: "Active" },
    govId: {
      idNumber: {
        type: String,
        maxlength: [15, "ID number must be less than 15 characters"],
      },
      verificationStatus: {
        type: String,
        enum: ["Pending", "Verified", "Rejected"],
        default: "Rejected",
      },
      documentUrl: { type: String },
      reason: { type: String, required: false },
    },
    subscription: {
      planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      planName: { type: String },
      planDescription: { type: String },
      durationMonths: { type: Number },
      maxStartingRides: { type: Number },
      maxJoiningRides: { type: Number },
      originalPrice: { type: Number },
      startDate: { type: Date },
      endDate: { type: Date },
      remainingStartRides: { type: Number },
      remainingJoinRides: { type: Number },
    },
    monthlyRideCount: { type: Number, default: 0 },
    lastRideReset: { type: Date, default: Date.now },
    vehicles: [
      {
        vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
      },
    ],
    wallet: {
      balance: { type: Number, default: 0 },
      transactions: [
        {
          transactionId: { type: String, required: true },
          type: { type: String, enum: ["DEPOSIT", "WITHDRAWAL", "SUBSCRIPTION", "REFUND"], required: true },
          amount: { type: Number, required: true },
          status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED"], default: "PENDING" },
          createdAt: { type: Date, default: Date.now },
          description: { type: String, required: false },
        },
      ],
    },
    role: { type: String, enum: ["user", "admin"], required: true, default: "user" },
  },
  { timestamps: true }
);

// Export both the model and interface
export const User = model<IUser>("User", UserSchema);
export default User;