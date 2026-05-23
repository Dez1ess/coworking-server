import express, { Response } from "express";
import { pool } from "../../db";
import { AuthRequest } from "../../middleware/authMiddleware";

const router = express.Router();

/*
GET ALL TARIFFS
*/
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM tariffs ORDER BY tariff_id");

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching tariffs" });
  }
});

/*
UPDATE TARIFF PRICE
*/
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    if (price === undefined || price === null) {
      return res.status(400).json({
        message: "Price is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE tariffs
      SET price = $1
      WHERE tariff_id = $2
      RETURNING *
      `,
      [price, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Tariff not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error updating tariff",
    });
  }
});

export default router;
