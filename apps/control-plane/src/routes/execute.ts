import { Request, Response } from "express";
import { validateAction, recordExecution, isEmergencyStop } from "../policy-engine.js";
import { createReceipt } from "../audit.js";
import { hmacFetch } from "../hmac-fetch.js";
import { ExecuteRequest } from "../schemas.js";

const TOOL_GATEWAY_URL = process.env.TOOL_GATEWAY_URL || "http://localhost:3002";

export async function executeHandler(req: Request, res: Response): Promise<void> {
  try {
    if (isEmergencyStop()) {
      res.status(403).json({ error: "Emergency stop active" });
      return;
    }

    const parsed = ExecuteRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const action = parsed.data.action;

    // Policy validation
    const policy = validateAction(action);
    if (!policy.allowed) {
      res.status(403).json({ error: policy.reason });
      return;
    }

    if (policy.requires_approval === "dual") {
      res.status(403).json({ error: "Dual approval required — not yet implemented (Phase 5)" });
      return;
    }

    // Tier 2-3 blocked until Phase 5
    if (action.tier >= 2) {
      res.status(403).json({ error: `Tier ${action.tier} actions blocked — requires Phase 5 governance` });
      return;
    }

    // Execute via tool gateway
    let result: Record<string, unknown>;
    try {
      const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/glpi/ticket/${action.target.id}/followup`, {
        method: "POST",
        body: JSON.stringify({ content: action.justification, is_private: true }),
      });
      result = await resp.json();
    } catch (err) {
      const receipt = createReceipt(action.action_id, action.target, action.requestor, action.tier, "failure", { error: String(err) });
      res.status(500).json({ error: "Tool gateway error", receipt });
      return;
    }

    recordExecution(action.action_id, action.target.id);
    const receipt = createReceipt(action.action_id, action.target, action.requestor, action.tier, "success", result);

    res.json({ receipt, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
