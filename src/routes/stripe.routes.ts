import express from "express";
import Stripe from "stripe";
import { pool } from "../db";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/* =========================
   CREATE CHECKOUT SESSION
========================= */
router.post("/create-checkout-session", authMiddleware, async (req, res) => {
  try {
    const {
      workspace_id,
      workspace_number,
      tariff_id,
      start_time,
      end_time,
      price,
    } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Workspace ${workspace_number}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],

      success_url: `${process.env.FRONTEND_URL}/booking-success`,
      cancel_url: `${process.env.FRONTEND_URL}/booking-cancel`,

      metadata: {
        user_id: String((req as any).user?.id),
        workspace_id,
        workspace_number,
        tariff_id,
        start_time,
        end_time,
        price,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).json({ message: "Stripe error" });
  }
});

/* =========================
   WEBHOOK
========================= */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );

      console.log("🔥 WEBHOOK HIT:", event.type);
    } catch (err) {
      console.error("Webhook signature error:", err);
      return res.status(400).send("Webhook Error");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const m = session.metadata;

      if (!m) {
        console.log("No metadata");
        return res.json({ received: true });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // 🔒 защита от дубля
        const existing = await client.query(
          `SELECT * FROM bookings WHERE workspace_id = $1 AND start_time = $2`,
          [m.workspace_id, m.start_time],
        );

        if (existing.rows.length > 0) {
          console.log("Booking already exists");
          await client.query("ROLLBACK");
          return res.json({ received: true });
        }

        // 1. CREATE BOOKING
        const bookingRes = await client.query(
          `INSERT INTO bookings (
            workspace_id,
            workspace_number,
            tariff_id,
            start_time,
            end_time,
            price,
            user_id,
            payment_status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'paid')
          RETURNING booking_id`,
          [
            m.workspace_id,
            m.workspace_number,
            m.tariff_id,
            m.start_time,
            m.end_time,
            m.price,
            m.user_id || null,
          ],
        );

        const booking_id = bookingRes.rows[0].booking_id;

        // 2. CREATE PAYMENT
        await client.query(
          `INSERT INTO payments (
            booking_id,
            amount,
            payment_method,
            payment_date
          ) VALUES ($1,$2,$3,NOW())`,
          [booking_id, m.price, "card"],
        );

        await client.query("COMMIT");

        console.log("✅ BOOKING + PAYMENT CREATED");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Webhook DB error:", err);
      } finally {
        client.release();
      }
    }

    res.json({ received: true });
  },
);

export default router;
