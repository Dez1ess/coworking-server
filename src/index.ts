import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authMiddleware } from "./middleware/authMiddleware";
import { adminMiddleware } from "./middleware/adminMiddleware";

import authRoutes from "./routes/auth";
import workspacesRoutes from "./routes/workspaces";
import tariffsRoutes from "./routes/tariffs";
import bookingsRoutes from "./routes/bookings";
import paymentsRoutes from "./routes/payments";
import reviewsRoutes from "./routes/reviews";
import usersRoutes from "./routes/users";

// Admin Routes
import adminWorkspacesRoutes from "./routes/admin/workspaces";
import adminBookingsRoutes from "./routes/admin/bookings";
import adminReviewsRoutes from "./routes/admin/reviews";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspacesRoutes);
app.use("/api/tariffs", tariffsRoutes);
app.use("/api/bookings", authMiddleware, bookingsRoutes);
app.use("/api/payments", authMiddleware, paymentsRoutes);
app.use("/api/reviews", authMiddleware, reviewsRoutes);

app.use("/api/users", authMiddleware, adminMiddleware, usersRoutes);
app.use(
  "/api/admin/workspaces",
  authMiddleware,
  adminMiddleware,
  adminWorkspacesRoutes,
);
app.use(
  "/api/admin/bookings",
  authMiddleware,
  adminMiddleware,
  adminBookingsRoutes,
);
app.use(
  "/api/admin/reviews",
  authMiddleware,
  adminMiddleware,
  adminReviewsRoutes,
);

app.listen(5000, () =>
  console.log(
    `Server running on ${process.env.DATABASE_URL || "http://localhost:5000"}`,
  ),
);
