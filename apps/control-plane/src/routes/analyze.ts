import { Request, Response } from "express";
import { assembleContext } from "../context-assembler.js";

export async function analyzeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { ticket_id, mode, user_id, profile, entity } = req.body;

    if (!ticket_id) {
      res.status(400).json({ error: "ticket_id required" });
      return;
    }

    const context = await assembleContext(ticket_id);

    // TODO: Call Claude Agent SDK here
    // For now, return a placeholder that shows the architecture works
    const result: Record<string, unknown> = {
      analysis: `Ticket #${ticket_id} analyzed. Context assembled (${context.length} chars).`,
      mode,
      technician: { user_id, profile, entity },
    };

    if (mode === "draft") {
      result.draft_private = `[Draft prive] Analyse du ticket #${ticket_id} — diagnostic en cours.`;
      result.draft_public = `Bonjour, nous avons bien recu votre demande et l'equipe IT est en cours d'analyse.`;
      result.citations = ["KB-001: Procedure standard"];
    }

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
