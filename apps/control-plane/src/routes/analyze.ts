import { Request, Response } from "express";
import { assembleContext } from "../context-assembler.js";
import { runAgent } from "../agent.js";
import { AnalyzeRequest } from "../schemas.js";
import { redactPublic } from "../redaction.js";

export async function analyzeHandler(req: Request, res: Response): Promise<void> {
  try {
    const parsed = AnalyzeRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { ticket_id, mode, user_id, profile, entity } = parsed.data;

    const agentMode = mode === "draft" ? "draft" : "analyze";
    const context = await assembleContext(ticket_id);
    const prompt = `Analyse le ticket GLPI #${ticket_id}.\n\nContexte:\n${context}`;

    const result = await runAgent(prompt, agentMode);

    // Apply redaction to public-facing output in draft mode
    const response = agentMode === "draft"
      ? redactPublic(result.response)
      : result.response;

    res.json({
      ticket_id,
      mode: agentMode,
      response,
      tools_used: result.tools_used,
      turn_count: result.turn_count,
      technician: { user_id, profile, entity },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
