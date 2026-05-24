import { Router } from "express";
import { pool } from "../../db";
import { authMiddleware } from "../../middleware/authMiddleware";
import { adminMiddleware } from "../../middleware/adminMiddleware";

const router = Router();

router.get("/", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [
      usersResult,
      bookingsCountResult,
      reviewsResult,
      revenueResult,
      latestBookingsResult,
      latestReviewsResult,
      bookingsChartResult,
      revenueChartResult,
    ] = await Promise.all([
      // USERS COUNT
      pool.query(`SELECT COUNT(*) FROM users`),

      // BOOKINGS COUNT
      pool.query(`SELECT COUNT(*) FROM bookings`),

      // REVIEWS COUNT
      pool.query(`SELECT COUNT(*) FROM reviews`),

      // TOTAL REVENUE
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS revenue
        FROM payments
      `),

      // LATEST BOOKINGS
      pool.query(`
        SELECT
          b.booking_id,
          u.first_name,
          b.workspace_number,
          b.start_time,
          b.price
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        ORDER BY b.start_time DESC
        LIMIT 5
      `),

      // LATEST REVIEWS
      pool.query(`
        SELECT
          r.review_id,
          r.review_text,
          r.rating,
          u.first_name AS username
        FROM reviews r
        JOIN users u ON u.user_id = r.user_id
        ORDER BY r.review_date DESC
        LIMIT 5
      `),

      // BOOKINGS CHART (ALL TIME)
      pool.query(`
        SELECT
          TO_CHAR(start_time, 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM bookings
        GROUP BY day
        ORDER BY day ASC
      `),

      // REVENUE CHART (ALL TIME)
      pool.query(`
        SELECT
          TO_CHAR(payment_date, 'YYYY-MM-DD') AS day,
          COALESCE(SUM(amount), 0)::float AS revenue
        FROM payments
        GROUP BY day
        ORDER BY day ASC
      `),
    ]);

    res.json({
      stats: {
        users: Number(usersResult.rows[0].count),
        bookings: Number(bookingsCountResult.rows[0].count),
        reviews: Number(reviewsResult.rows[0].count),
        revenue: Number(revenueResult.rows[0].revenue),
      },

      latestBookings: latestBookingsResult.rows,
      latestReviews: latestReviewsResult.rows,

      // FOR RECHARTS
      allTimeBookings: bookingsChartResult.rows,
      allTimeRevenue: revenueChartResult.rows,
    });
  } catch (err) {
    console.error("Dashboard error:", err);

    res.status(500).json({
      error: "Dashboard error",
    });
  }
});

export default router;
