import { Router } from "express";
import { pool } from "../db";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

/* ============================
   CREATE BOOKING (USER-BOUND)
============================ */
router.post("/", authMiddleware, async (req: any, res) => {
  const client = await pool.connect();

  try {
    const user_id = req.user?.id;
    let {
      workspace_id,
      workspace_number,
      tariff_id,
      start_time,
      end_time,
      price,
      payment_method,
    } = req.body;

    // Валідація payment_method
    if (!["card", "cash", "transfer"].includes(payment_method)) {
      payment_method = "card";
    }

    if (
      !workspace_id ||
      !workspace_number ||
      !start_time ||
      !end_time ||
      price == null
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const bookedCheck = await client.query(
      `SELECT 1 FROM bookings 
       WHERE workspace_id = $1 
       AND cancelled = FALSE
       AND start_time < $3
       AND end_time > $2`,
      [workspace_id, start_time, end_time]
    );

    if (bookedCheck.rows.length) {
      client.release();
      return res
        .status(409)
        .json({ message: "Workspace is not available for selected dates" });
    }

    // Починаємо транзакцію
    await client.query("BEGIN");

    // 1. Створюємо бронювання
    const bookingResult = await client.query(
      `INSERT INTO bookings
       (user_id, workspace_id, workspace_number, tariff_id, start_time, end_time, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        user_id,
        workspace_id,
        workspace_number,
        tariff_id || null,
        start_time,
        end_time,
        price,
      ]
    );

    const booking_id = bookingResult.rows[0].booking_id;

    // 2. Автоматично створюємо платіж
    await client.query(
      `INSERT INTO payments (booking_id, amount, payment_method)
       VALUES ($1, $2, $3)`,
      [booking_id, price, payment_method]
    );

    // Завершуємо транзакцію
    await client.query("COMMIT");

    res.json(bookingResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

/* ============================
   LIST USER BOOKINGS
============================ */
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const user_id = req.user?.id;

    const result = await pool.query(
      `SELECT booking_id, workspace_id, workspace_number, start_time, end_time, price, cancelled
    FROM bookings
    WHERE user_id = $1
    ORDER BY start_time DESC`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   LIST RECENT BOOKINGS
============================ */

router.get("/recent", authMiddleware, async (req: any, res) => {
  try {
    const user_id = req.user?.id;

    const result = await pool.query(
      `SELECT booking_id, workspace_id, workspace_number, start_time, end_time, price, cancelled
       FROM bookings
       WHERE user_id = $1
       ORDER BY start_time DESC
       LIMIT 3`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   CANCEL BOOKING
============================ */
router.patch("/cancel/:id", authMiddleware, async (req: any, res) => {
  const client = await pool.connect();

  try {
    const user_id = req.user?.id;
    const booking_id = req.params.id;

    // Отримуємо інформацію про бронювання
    const bookingQuery = await client.query(
      `SELECT workspace_id FROM bookings 
       WHERE booking_id = $1 AND user_id = $2`,
      [booking_id, user_id]
    );

    if (!bookingQuery.rows.length) {
      client.release();
      return res.status(404).json({ message: "Booking not found" });
    }

    const workspace_id = bookingQuery.rows[0].workspace_id;

    await client.query("BEGIN");

    // Скасовуємо бронювання
    const result = await client.query(
      `UPDATE bookings 
       SET cancelled = TRUE
       WHERE booking_id = $1 AND user_id = $2
       RETURNING *`,
      [booking_id, user_id]
    );

    // Повертаємо статус workspace на "available"
    await client.query(
      "UPDATE workspaces SET status = $1 WHERE workspace_id = $2",
      ["available", workspace_id]
    );

    await client.query("COMMIT");

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
