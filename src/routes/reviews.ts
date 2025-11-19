import express, { Request, Response } from "express";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";

const router = express.Router();

// Get all reviews for the current user
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.user!.id;

    const result = await pool.query(
      `SELECT r.review_id, r.review_date, r.review_text, r.rating, r.user_id, 
              u.first_name as username
       FROM reviews r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.user_id = $1
       ORDER BY r.review_date DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Create a new review
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { review_text, rating } = req.body;
    const user_id = req.user!.id;

    if (!rating) {
      return res.status(400).json({ error: "Rating is required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const result = await pool.query(
      `INSERT INTO reviews (user_id, review_text, rating)
       VALUES ($1, $2, $3)
       RETURNING review_id, review_date, review_text, rating, user_id`,
      [user_id, review_text || null, rating]
    );

    // Get user name from users table
    const userResult = await pool.query(
      "SELECT first_name, last_name FROM users WHERE user_id = $1",
      [user_id]
    );

    const username = userResult.rows[0]
      ? userResult.rows[0].first_name
      : "Unknown";

    res.status(201).json({ ...result.rows[0], username });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// Update a review
router.put(
  "/:reviewId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { reviewId } = req.params;
      const { review_text, rating } = req.body;
      const user_id = req.user!.id;

      if (rating && (rating < 1 || rating > 5)) {
        return res
          .status(400)
          .json({ error: "Rating must be between 1 and 5" });
      }

      const reviewCheck = await pool.query(
        "SELECT user_id FROM reviews WHERE review_id = $1",
        [reviewId]
      );

      if (reviewCheck.rows.length === 0) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (reviewCheck.rows[0].user_id !== user_id) {
        return res
          .status(403)
          .json({ error: "You can only edit your own reviews" });
      }

      const result = await pool.query(
        `UPDATE reviews
       SET review_text = COALESCE($1, review_text),
           rating = COALESCE($2, rating)
       WHERE review_id = $3
       RETURNING review_id, review_date, review_text, rating, user_id`,
        [review_text || null, rating || null, reviewId]
      );

      // Get user name from users table
      const userResult = await pool.query(
        "SELECT first_name, last_name FROM users WHERE user_id = $1",
        [user_id]
      );

      const username = userResult.rows[0]
        ? userResult.rows[0].first_name
        : "Unknown";

      res.json({ ...result.rows[0], username });
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  }
);

// Delete a review
router.delete(
  "/:reviewId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { reviewId } = req.params;
      const user_id = req.user!.id;

      const reviewCheck = await pool.query(
        "SELECT user_id FROM reviews WHERE review_id = $1",
        [reviewId]
      );

      if (reviewCheck.rows.length === 0) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (reviewCheck.rows[0].user_id !== user_id) {
        return res
          .status(403)
          .json({ error: "You can only delete your own reviews" });
      }

      await pool.query("DELETE FROM reviews WHERE review_id = $1", [reviewId]);
      res.json({ message: "Review deleted successfully" });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  }
);

export default router;
