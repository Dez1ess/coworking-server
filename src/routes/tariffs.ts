import { Router } from "express";
import { pool } from "../db";

const router = Router();

/*
  GET /api/tariffs
  Отримати всі тарифи
*/
router.get("/", async (_, res) => {
  try {
    const result = await pool.query("SELECT * FROM tariffs ORDER BY tariff_id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching tariffs" });
  }
});

/*
  GET /api/tariffs/:id
  Отримати тариф по ID
*/
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM tariffs WHERE tariff_id = $1",
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Tariff not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching tariff" });
  }
});

/*
  POST /api/tariffs
  Створити тариф
*/
router.post("/", async (req, res) => {
  try {
    const { plan_type, plan_name, price, icon, description } = req.body;

    if (!plan_type || !plan_name || !price)
      return res.status(400).json({ message: "Missing required fields" });

    const result = await pool.query(
      `INSERT INTO tariffs (plan_type, plan_name, price, icon, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [plan_type, plan_name, price, icon || null, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);

    if (err.code === "23505") {
      return res.status(400).json({ message: "plan_type must be unique" });
    }

    res.status(500).json({ error: "Error creating tariff" });
  }
});

/*
  PUT /api/tariffs/:id
  Оновити тариф
*/
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_type, plan_name, price, icon, description } = req.body;

    const result = await pool.query(
      `UPDATE tariffs
       SET plan_type = $1,
           plan_name = $2,
           price = $3,
           icon = $4,
           description = $5
       WHERE tariff_id = $6
       RETURNING *`,
      [plan_type, plan_name, price, icon || null, description || null, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Tariff not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating tariff" });
  }
});

/*
  DELETE /api/tariffs/:id
  Видалити тариф
*/
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM tariffs WHERE tariff_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Tariff not found" });

    res.json({ message: "Tariff deleted", tariff: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting tariff" });
  }
});

export default router;
