import { Request, Response } from "express";
import { getReceiptByActionId } from "../audit.js";

export async function statusHandler(req: Request, res: Response): Promise<void> {
  const actionId = req.params.action_id;
  const receipt = getReceiptByActionId(actionId);
  if (!receipt) {
    res.status(404).json({ error: "No receipt found for action_id" });
    return;
  }
  res.json(receipt);
}
