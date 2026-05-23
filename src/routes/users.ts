import { Router } from "express";
import { pool } from "../db";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { adminMiddleware } from "../middleware/adminMiddleware";

const router = Router();

/* ============================
   GET CURRENT USER (ME)
============================ */
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, role
       FROM users
       WHERE user_id = $1`,
      [user_id],
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
   UPDATE CURRENT USER (ME)
============================ */
router.patch("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user_id = req.user.id;
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
      values,
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   ADMIN: GET ALL USERS
============================ */
router.get("/", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, role
       FROM users
       ORDER BY user_id ASC`,
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ============================
   ADMIN: UPDATE USER
============================ */
router.patch("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const target_id = Number(req.params.id);
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
      values,
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
   ADMIN: DELETE USER
============================ */
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const currentUserId = req.user.id;
      const targetId = Number(req.params.id);

      // 1. отримуємо цільового юзера
      const targetUser = await pool.query(
        `SELECT user_id, role FROM users WHERE user_id = $1`,
        [targetId],
      );

      if (targetUser.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const target = targetUser.rows[0];

      // 2. заборона видалення себе
      if (targetId === currentUserId) {
        return res.status(403).json({
          error: "You cannot delete yourself",
        });
      }

      // 3. заборона видалення іншого адміна
      if (target.role === "admin") {
        return res.status(403).json({
          error: "You cannot delete another admin",
        });
      }

      // 4. delete
      const result = await pool.query(
        `DELETE FROM users
         WHERE user_id = $1
         RETURNING user_id, email`,
        [targetId],
      );

      res.json({
        message: "User deleted",
        user: result.rows[0],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
