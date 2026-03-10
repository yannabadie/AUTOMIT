import { Request, Response } from "express";
import { getReceiptByActionId } from "../audit.js";

export async function statusHandler(req: Request, res: Response): Promise<void> {
  const actionId = req.params.action_id;
  if (Array.isArray(actionId)) {
    res.status(400).json({ error: "Invalid action_id parameter" });
    return;
  }
  const receipt = getReceiptByActionId(actionId);
  if (!receipt) {
    res.status(404).json({ error: "No receipt found for action_id" });
    return;
  }
  res.json(receipt);
}
