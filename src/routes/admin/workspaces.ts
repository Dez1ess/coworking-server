import { Router } from "express";
import { pool } from "../../db";

const router = Router();

// =====================
// GET ALL WORKSPACES
// =====================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM workspaces
       ORDER BY workspace_id ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================
// CREATE WORKSPACE
// =====================
router.post("/", async (req, res) => {
  try {
    const { workspace_number, type, status } = req.body;

    if (!workspace_number || !type) {
      return res.status(400).json({
        message: "workspace_number and type are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO workspaces
       (workspace_number, type, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [workspace_number, type, status || "available"]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================
// UPDATE WORKSPACE
// =====================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { workspace_number, type, status } = req.body;

    const result = await pool.query(
      `UPDATE workspaces
       SET workspace_number = $1,
           type = $2,
           status = $3
       WHERE workspace_id = $4
       RETURNING *`,
      [workspace_number, type, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Workspace not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================
// DELETE WORKSPACE
// =====================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM workspaces
       WHERE workspace_id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Workspace not found",
      });
    }

    res.json({
      message: "Workspace deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;