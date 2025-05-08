import "reflect-metadata";
import express from "express";
import connectDB from "./config/dbconfig";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import rideRoutes from "./routes/ride.routes";
import routeRoutes from "./routes/route.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import { errorMiddleware } from "./middlewares/errorMiddleware";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

// Apply CORS middleware first
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Other middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/rides", rideRoutes);
app.use("/admin", adminRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

// Error handling middleware
app.use(errorMiddleware);

const PORT = 3001;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});