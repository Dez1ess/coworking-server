import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { start_time, end_time } = req.query;

    const allResult = await pool.query(
      "SELECT workspace_id, workspace_number, type FROM workspaces ORDER BY type, workspace_number"
    );
    const allSpaces = allResult.rows;

    if (!start_time || !end_time) {
      const spacesWithStatus = allSpaces.map((s) => ({
        ...s,
        status: "available",
      }));
      return res.json(spacesWithStatus);
    }

    const bookedResult = await pool.query(
      `SELECT workspace_id FROM bookings
       WHERE cancelled = FALSE
       AND start_time < $2
       AND end_time > $1`,
      [start_time, end_time]
    );
    const bookedIds = new Set(bookedResult.rows.map((b) => b.workspace_id));

    const spacesWithStatus = allSpaces.map((s) => ({
      ...s,
      status: bookedIds.has(s.workspace_id) ? "booked" : "available",
    }));

    res.json(spacesWithStatus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
