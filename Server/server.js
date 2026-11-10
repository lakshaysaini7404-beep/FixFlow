
const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const dns = require("dns");
const { Server } = require("socket.io");

dotenv.config();

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

const connectDB = require("./config/db");
const passport = require("./config/passport");
const { errorMiddleware } = require("./middleware/errorMiddleware");
const Ticket = require("./models/ticket");

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Express middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/tickets", require("./routes/ticketRoutes"));
app.use("/api/workers", require("./routes/workerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FixFlow Express server is running",
  });
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Socket authentication
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    if (!process.env.JWT_SECRET) {
      return next(new Error("JWT_SECRET is missing"));
    }

    socket.user = jwt.verify(token, process.env.JWT_SECRET);

    next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    next(new Error("Invalid or expired token"));
  }
});

// Socket connection
io.on("connection", (socket) => {
  const userId = String(socket.user?.userId || "");
  const role = socket.user?.role;

  console.log("SOCKET CONNECTED:", {
    socketId: socket.id,
    userId,
    role,
  });

  // Personal user room
  if (userId) {
    socket.join(`user:${userId}`);
  }

  // Role-based rooms
  if (role === "worker") {
    socket.join("workers");
  }

  if (role === "admin") {
    socket.join("admins");
  }

  // Join authorized ticket tracking room
  socket.on("tracking:join", async (data, callback) => {
    const reply =
      typeof callback === "function" ? callback : () => {};

    try {
      const ticketId = String(data?.ticketId || "");

      console.log("TRACKING JOIN REQUEST:", {
        ticketId,
        userId,
        role,
      });

      // Validate ticket ID
      if (!mongoose.isValidObjectId(ticketId)) {
        return reply({
          ok: false,
          message: "Invalid ticket ID.",
        });
      }

      // Find ticket
      const ticket = await Ticket.findById(ticketId).select(
        "createdBy assignedWorker status workerLocation"
      );

      if (!ticket) {
        return reply({
          ok: false,
          message: "Ticket not found.",
        });
      }

      // Ticket owner
      const ownerId = String(
        ticket.createdBy?._id ||
          ticket.createdBy ||
          ""
      );

      // Assigned worker
      const workerId = String(
        ticket.assignedWorker?._id ||
          ticket.assignedWorker ||
          ""
      );

      // Authorization
      const authorized =
        (role === "user" && ownerId === userId) ||
        (role === "worker" && workerId === userId) ||
        role === "admin";

      if (!authorized) {
        console.log("TRACKING ACCESS DENIED:", {
          ticketId,
          userId,
          role,
          ownerId,
          workerId,
        });

        return reply({
          ok: false,
          message: "You are not authorized to track this ticket.",
        });
      }

      // Tracking only after job starts
      if (ticket.status !== "In Progress") {
        return reply({
          ok: false,
          message: "Tracking is available after the job starts.",
        });
      }

      // Join ticket-specific room
      await socket.join(`ticket:${ticketId}`);

      console.log(
        "TRACKING ROOM JOINED:",
        `ticket:${ticketId}`
      );

      // Send saved worker location immediately
      const latitude = Number(
        ticket.workerLocation?.latitude
      );

      const longitude = Number(
        ticket.workerLocation?.longitude
      );

      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180 &&
        (latitude !== 0 || longitude !== 0)
      ) {
        socket.emit("worker:location", {
          ticketId,
          latitude,
          longitude,
          updatedAt: ticket.workerLocation.updatedAt,
        });

        console.log("INITIAL WORKER LOCATION SENT:", {
          ticketId,
          latitude,
          longitude,
        });
      }

      return reply({
        ok: true,
        message: "Successfully joined tracking room.",
      });
    } catch (error) {
      console.error("Tracking join error:", error);

      return reply({
        ok: false,
        message: "Unable to join tracking room.",
      });
    }
  });

  // Disconnect
  socket.on("disconnect", (reason) => {
    console.log("SOCKET DISCONNECTED:", {
      socketId: socket.id,
      userId,
      reason,
    });
  });
});

// Make Socket.IO available to controllers
app.set("io", io);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error middleware
app.use(errorMiddleware);

// Start server after successful MongoDB connection
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log("Connecting to MongoDB Atlas...");

    await connectDB();

    console.log("MongoDB connection established.");

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`FixFlow Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("FixFlow startup failed:", error);
    process.exit(1);
  }
}

startServer();
