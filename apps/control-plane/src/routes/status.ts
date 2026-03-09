import { Request, Response } from "express";
import { getReceipt } from "../audit.js";

export async function statusHandler(req: Request, res: Response): Promise<void> {
  const receipt = getReceipt(req.params.action_id);
  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }
  res.json(receipt);
}
