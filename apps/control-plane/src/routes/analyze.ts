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

    // STUB: Claude Agent SDK integration pending (Phase 5)
    // When implemented: agent.query() with context, permissionMode: "dontAsk"
    const result: Record<string, unknown> = {
      ticket_id,
      context_length: context.length,
      mode: mode || "analyze",
      stub: true,
      message: "Agent SDK not yet integrated — context assembly verified",
    };

    if (mode === "draft") {
      result.stub_notice = "Draft generation requires Claude Agent SDK (not yet wired)";
    }

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
