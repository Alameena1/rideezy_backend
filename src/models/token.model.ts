import { Schema, model } from "mongoose";

const TokenSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  refreshToken: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const TokenModel = model("Token", TokenSchema);
export default TokenModel;