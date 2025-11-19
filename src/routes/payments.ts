import { Router } from "express";
import { pool } from "../db";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

/* ============================
   GET ALL PAYMENTS (USER-BOUND)
============================ */
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const user_id = req.user?.id;

    const result = await pool.query(
      `SELECT p.payment_id, p.booking_id, p.payment_date, p.amount, p.payment_method
       FROM payments p
       INNER JOIN bookings b ON p.booking_id = b.booking_id
       WHERE b.user_id = $1
       ORDER BY p.payment_date DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;