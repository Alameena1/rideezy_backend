import { Schema, model } from "mongoose";

export interface IAdmin {
  _id: string;
  email: string;
  password: string;
  role: string;
}

const adminSchema = new Schema<IAdmin>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "admin" }
});

export default model<IAdmin>("Admin", adminSchema, "Admin");