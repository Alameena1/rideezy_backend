import { Schema, model, Document, Types } from "mongoose";

export interface IWallet {
  balance: number;
  transactions: {
    transactionId: string;
    type: "DEPOSIT" | "WITHDRAWAL" | "SUBSCRIPTION"  | "REFUND";
    amount: number;
    status: "PENDING" | "COMPLETED" | "FAILED";
    createdAt: Date;
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
  Country?: string;
  gender?: string;
  status?: "Active" | "Blocked";
  govId?: {
    idNumber: string;
    verificationStatus: "Pending" | "Verified" | "Rejected";
    documentUrl?: string;
  };
  subscription?: {
    planId: Types.ObjectId;
    startDate: Date;
    endDate: Date;
  };
  monthlyRideCount: number;
  lastRideReset: Date;
  vehicles: Array<{
    vehicleId: Types.ObjectId;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
  _id: any;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String },
    password: { type: String },
    provider: { type: String, default: "local" },
    image: { type: String },
    number: { type: String },
    state: { type: String },
    Country: { type: String },
    gender: { type: String },
    status: { type: String, enum: ["Active", "Blocked"], default: "Active" },
    govId: {
      idNumber: { type: String },
      verificationStatus: {
        type: String,
        enum: ["Pending", "Verified", "Rejected"],
        default: "Rejected",
      },
      documentUrl: { type: String },
    },
    subscription: {
      planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
      startDate: { type: Date },
      endDate: { type: Date },
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
        },
      ],
    },
  },
  { timestamps: true }
);

const UserModel = model<IUser>("User", UserSchema);
export default UserModel;