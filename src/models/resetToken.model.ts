import { Schema, model } from "mongoose";

const ResetTokenSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, 
});

const ResetTokenModel = model("ResetToken", ResetTokenSchema);
export default ResetTokenModel;