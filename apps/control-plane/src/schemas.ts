import { z } from "zod";

export const AnalyzeRequest = z.object({
  ticket_id: z.number().int().positive(),
  mode: z.enum(["analyze", "draft"]).default("analyze"),
  user_id: z.number().int().positive(),
  profile: z.string().min(1),
  entity: z.string().min(1),
  interface: z.literal("central"),
  timestamp: z.number().int().positive(),
});

export const ProposeRequest = z.object({
  ticket_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  profile: z.string().min(1),
  entity: z.string().min(1),
  interface: z.literal("central"),
  timestamp: z.number().int().positive(),
});

export const ExecuteRequest = z.object({
  action: z.object({
    action_id: z.string().min(1),
    tier: z.number().int().min(0).max(3),
    target: z.object({
      type: z.string().min(1),
      id: z.string().min(1),
      display_name: z.string(),
    }),
    requestor: z.object({
      glpi_user_id: z.number().int().positive(),
      profile: z.string().min(1),
      entity: z.string().min(1),
      interface: z.literal("central"),
      right: z.string().optional(),
    }),
    idempotency_key: z.string().uuid(),
    ttl_seconds: z.number().int().positive(),
    issued_at: z.number().int().positive(),
    justification: z.string().min(1),
  }),
  timestamp: z.number().int().positive(),
});
