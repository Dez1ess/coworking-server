import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authMiddleware } from "./middleware/authMiddleware";

import authRoutes from "./routes/auth";
import workspacesRoutes from "./routes/workspaces";
import tariffsRoutes from "./routes/tariffs";
import bookingsRoutes from "./routes/bookings";
import paymentsRoutes from "./routes/payments";
import reviewsRoutes from "./routes/reviews";

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

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
