  import mongoose from "mongoose";

  const TempUserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true },
    otp: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },  
  });

  TempUserSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 300 }); 

  const TempUserModel = mongoose.model("TempUser", TempUserSchema);
  export default TempUserModel;
