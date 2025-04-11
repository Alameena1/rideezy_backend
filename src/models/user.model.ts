import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
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
  },
  { timestamps: true }
);

const UserModel = model<IUser>("User", UserSchema);
export default UserModel;