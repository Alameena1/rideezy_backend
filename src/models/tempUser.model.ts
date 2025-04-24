import mongoose, { Schema, Model, Document } from "mongoose";

export interface ITempUser extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  otp: string;
  otpExpiresAt: Date;
}

const TempUserSchema = new Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String },
  password: { type: String, required: true, select: false }, 
  otp: { type: String, required: true },
  otpExpiresAt: { type: Date, required: true },
});

TempUserSchema.pre("findOne", function (next) {
  console.log("Pre-findOne query:", this.getQuery());
  next();
});

TempUserSchema.pre("findOneAndUpdate", function (next) {
  console.log("Pre-update middleware triggered:", this.getUpdate());
  next();
});

TempUserSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 300 });

const TempUserModel: Model<ITempUser> = mongoose.model<ITempUser>("TempUser", TempUserSchema);
export default TempUserModel;