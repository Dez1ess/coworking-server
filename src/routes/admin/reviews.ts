import express, { Response } from "express";
import { pool } from "../../db";
import { AuthRequest } from "../../middleware/authMiddleware";

const router = express.Router();

/*
GET REVIEWS
*/
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const search = (req.query.search as string) || "";
    const rating = req.query.rating as string;
    const sort = (req.query.sort as string) || "newest";

    const offset = (page - 1) * limit;

    let orderBy = "r.review_date DESC";

    if (sort === "oldest") {
      orderBy = "r.review_date ASC";
    }

    if (sort === "highest") {
      orderBy = "r.rating DESC";
    }

    if (sort === "lowest") {
      orderBy = "r.rating ASC";
    }

    let query = `
      SELECT 
        r.review_id,
        r.review_text,
        r.rating,
        r.review_date,
        r.user_id,
        u.first_name AS username,

        COALESCE(
          json_agg(
            CASE 
              WHEN rc.comment_id IS NOT NULL THEN
                json_build_object(
                  'comment_id', rc.comment_id,
                  'comment_text', rc.comment_text,
                  'created_at', rc.created_at,
                  'admin_name', admin.first_name
                )
            END
          ) FILTER (WHERE rc.comment_id IS NOT NULL),
          '[]'
        ) AS comments

      FROM reviews r

      JOIN users u 
        ON r.user_id = u.user_id

      LEFT JOIN review_comments rc
        ON r.review_id = rc.review_id

      LEFT JOIN users admin
        ON rc.admin_id = admin.user_id

      WHERE (
        LOWER(r.review_text) LIKE LOWER($1)
        OR LOWER(u.first_name) LIKE LOWER($1)
      )
    `;

    const values: any[] = [`%${search}%`];

    if (rating) {
      values.push(rating);
      query += ` AND r.rating = $${values.length}`;
    }

    query += `
      GROUP BY r.review_id, u.first_name
      ORDER BY ${orderBy}
    `;

    values.push(limit);
    values.push(offset);

    query += `
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch reviews",
    });
  }
});

/*
CREATE COMMENT
*/
router.post("/:reviewId/comments", async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { comment_text } = req.body;

    if (!comment_text?.trim()) {
      return res.status(400).json({
        error: "Comment is required",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO review_comments
        (review_id, admin_id, comment_text)

        VALUES ($1, $2, $3)

        RETURNING *
      `,
      [reviewId, req.user!.id, comment_text],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to create comment",
    });
  }
});

/*
UPDATE COMMENT
*/
router.put("/comments/:commentId", async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { comment_text } = req.body;

    const result = await pool.query(
      `
        UPDATE review_comments
        SET comment_text = $1
        WHERE comment_id = $2

        RETURNING *
      `,
      [comment_text, commentId],
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update comment",
    });
  }
});

/*
DELETE COMMENT
*/
router.delete(
  "/comments/:commentId",
  async (req: AuthRequest, res: Response) => {
    try {
      const { commentId } = req.params;

      await pool.query(
        `
        DELETE FROM review_comments
        WHERE comment_id = $1
      `,
        [commentId],
      );

      res.json({
        message: "Comment deleted",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Failed to delete comment",
      });
    }
  },
);

/*
DELETE REVIEW
*/
router.delete("/:reviewId", async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    await pool.query(
      `
        DELETE FROM reviews
        WHERE review_id = $1
      `,
      [reviewId],
    );

    res.json({
      message: "Review deleted",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to delete review",
    });
  }
});

export default router;
