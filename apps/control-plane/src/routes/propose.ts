import { Request, Response } from "express";
import { isEmergencyStop } from "../policy-engine.js";

export async function proposeHandler(req: Request, res: Response): Promise<void> {
  try {
    if (isEmergencyStop()) {
      res.json({ actions: [], message: "Emergency stop active — no actions available" });
      return;
    }

    const { ticket_id } = req.body;

    // TODO: Call Claude Agent SDK to generate action proposals
    // For now, return a placeholder
    res.json({
      actions: [
        {
          action_id: "add_private_followup",
          tier: 1,
          target: { type: "glpi_ticket", id: String(ticket_id), display_name: `Ticket #${ticket_id}` },
          idempotency_key: crypto.randomUUID(),
          ttl_seconds: 300,
          preconditions: ["Ticket is open"],
          postconditions: ["Followup added"],
          rollback_notes: "Delete the followup from GLPI",
          justification: "Add diagnostic note based on analysis",
          evidence: ["Ticket description analysis"],
          policy_basis: "Tier 1: reversible ticket operation",
        },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
