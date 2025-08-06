import { Server } from "socket.io";
import { createServer } from "http";
import {app} from "../app"; 
import { Notification } from "../models/notification.model"; 
import { emitNotification } from "./emit";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",  
    methods: ["GET", "POST", "PUT"],
  },
});

io.on("connection", (socket) => {
  console.log("New WebSocket connection:", socket.id);

  socket.on("join", (userId: string, callback: (error?: string) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log("No token provided for user:", userId);
      callback("No token provided");
      socket.disconnect();
      return;
    }
    import("jsonwebtoken").then((jwt) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        socket.join(userId);
        console.log(`User ${userId} joined room`);
        callback();
      } catch (error) {
        console.log("Verification Error:", (error as Error).message);
        callback("Invalid token");
        socket.disconnect();
      }
    }).catch((err) => {
      console.log("JWT import error:", err);
      callback("Server error");
      socket.disconnect();
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

export { io, httpServer };