import { Request, Response } from "express";
import { isEmergencyStop } from "../policy-engine.js";
import { assembleContext } from "../context-assembler.js";
import { runAgent } from "../agent.js";
import { ProposeRequest } from "../schemas.js";

export async function proposeHandler(req: Request, res: Response): Promise<void> {
  try {
    if (isEmergencyStop()) {
      res.json({ actions: [], message: "Emergency stop active — no actions available" });
      return;
    }

    const parsed = ProposeRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { ticket_id } = parsed.data;

    const context = await assembleContext(ticket_id);
    const prompt = `Analyse le ticket GLPI #${ticket_id} et propose des actions de remediation.\n\nContexte:\n${context}`;

    const result = await runAgent(prompt, "propose");

    res.json({
      ticket_id,
      proposals: result.response,
      tools_used: result.tools_used,
      turn_count: result.turn_count,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
