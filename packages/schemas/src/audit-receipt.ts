import { z } from "zod";
import { AuditReceiptSchema, TargetSchema, RequestorSchema } from "./action-contract.js";

export const ApprovalRecordSchema = z.object({
  approver_glpi_id: z.number().int(),
  approved_at: z.string(),
  method: z.enum(["glpi_validation", "kestra_pause", "breakglass"]),
});

export const FullAuditReceiptSchema = z.object({
  receipt_id: z.string().uuid(),
  action_id: z.string(),
  target: TargetSchema,
  requestor: RequestorSchema,
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  approval_chain: z.array(ApprovalRecordSchema),
  execution: AuditReceiptSchema,
  glpi_followup_id: z.number().int().optional(),
});

export type FullAuditReceipt = z.infer<typeof FullAuditReceiptSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
