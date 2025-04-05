
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
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
  status: { type: String, enum: ["Active", "Blocked"], default: "Active" } 
}, { timestamps: true });

const UserModel = mongoose.model("User", UserSchema);
export default UserModel;