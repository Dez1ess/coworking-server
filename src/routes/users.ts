import { Router } from "express";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

/* ============================
   GET CURRENT USER INFO
============================ */
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user_id = req.user?.id;

    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, role
       FROM users
       WHERE user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   GET ALL USERS (ADMIN ONLY)
============================ */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user_id = req.user?.id;

    const roleCheck = await pool.query(
      `SELECT role FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (roleCheck.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, role
       FROM users
       ORDER BY user_id ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   UPDATE CURRENT USER INFO
============================ */
router.patch("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user_id = req.user?.id;
    const { first_name, last_name, email } = req.body;

    if (!first_name && !last_name && !email) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (first_name !== undefined) {
      fields.push(`first_name = $${idx++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      fields.push(`last_name = $${idx++}`);
      values.push(last_name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(email);
    }

    values.push(user_id);

    const result = await pool.query(
      `UPDATE users
       SET ${fields.join(", ")}
       WHERE user_id = $${idx}
       RETURNING user_id, first_name, last_name, email, role`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   UPDATE ANY USER (ADMIN ONLY)
============================ */
router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user_id = req.user?.id;
    const target_id = parseInt(req.params["id"] as string, 10);

    const roleCheck = await pool.query(
      `SELECT role FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (roleCheck.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { first_name, last_name, email, role } = req.body;

    if (!first_name && !last_name && !email && !role) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (first_name !== undefined) {
      fields.push(`first_name = $${idx++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      fields.push(`last_name = $${idx++}`);
      values.push(last_name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(email);
    }
    if (role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(role);
    }

    values.push(target_id);

    const result = await pool.query(
      `UPDATE users
       SET ${fields.join(", ")}
       WHERE user_id = $${idx}
       RETURNING user_id, first_name, last_name, email, role`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;