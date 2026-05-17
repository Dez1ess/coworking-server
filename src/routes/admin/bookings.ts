import { Router } from "express";
import { pool } from "../../db";
import { authMiddleware } from "../../middleware/authMiddleware";
import { adminMiddleware } from "../../middleware/adminMiddleware";

const router = Router();

/* =========================
   GET ALL BOOKINGS (ADMIN)
========================= */
router.get("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        b.booking_id,
        b.user_id,
        u.first_name,
        u.email,
        b.workspace_id,
        b.workspace_number,
        b.start_time,
        b.end_time,
        b.price,
        b.cancelled
      FROM bookings b
      JOIN users u ON u.user_id = b.user_id
      ORDER BY b.start_time DESC
      `,
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET ADMIN BOOKINGS ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   GET SINGLE BOOKING
========================= */
router.get("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const booking_id = req.params.id;

    const result = await pool.query(
      `
        SELECT 
          b.*,
          u.first_name,
          u.email
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        WHERE b.booking_id = $1
        `,
      [booking_id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   UPDATE BOOKING (ADMIN)
========================= */
router.patch("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const booking_id = req.params.id;
    const { start_time, end_time, price, cancelled } = req.body;

    const result = await pool.query(
      `
        UPDATE bookings
        SET 
          start_time = COALESCE($1, start_time),
          end_time = COALESCE($2, end_time),
          price = COALESCE($3, price),
          cancelled = COALESCE($4, cancelled)
        WHERE booking_id = $5
        RETURNING *
        `,
      [start_time, end_time, price, cancelled, booking_id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   DELETE BOOKING (ADMIN)
========================= */
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const booking_id = req.params.id;

    await client.query("BEGIN");

    // delete payment first
    await client.query(`DELETE FROM payments WHERE booking_id = $1`, [
      booking_id,
    ]);

    // delete booking
    const result = await client.query(
      `DELETE FROM bookings WHERE booking_id = $1 RETURNING *`,
      [booking_id],
    );

    await client.query("COMMIT");

    if (!result.rows.length) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

export default router;
