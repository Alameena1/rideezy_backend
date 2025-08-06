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
import walletRoutes from "./routes/wallet.routes";
import trackingRoutes from "./routes/tracking.routes";
import notificationRoutes from "./routes/notification.routes";
import { errorMiddleware } from "./middlewares/errorMiddleware";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http"; 
import { Server } from "socket.io"; // Import Server for TypeScript

dotenv.config();

const app = express();

const corsOptions = {
  origin: "http://localhost:3000", // Update for production
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Driver-Id"], 
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/rides", rideRoutes);
app.use("/admin", adminRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorMiddleware);

const PORT = 3001;

connectDB();

// Create HTTP server with the Express app
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Match frontend URL
    methods: ["GET", "POST", "PUT"],
    credentials: true, // Ensure credentials are allowed
  },
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("New WebSocket connection:", socket.id);

  socket.on("join", (userId: string) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} with WebSocket`);
});

// Export app and io for other modules if needed
export { app, io };