import { z } from "zod";

export const TargetSchema = z.object({
  type: z.enum(["erp_job", "ad_user", "glpi_ticket", "m365_user", "mail"]),
  id: z.string().min(1, "Immutable target ID required"),
  display_name: z.string(),
});

export const RequestorSchema = z.object({
  glpi_user_id: z.number().int().positive(),
  profile: z.string(),
  entity: z.string(),
  interface: z.literal("central"),
});

export const ApprovalSchema = z.object({
  type: z.enum(["single", "dual", "breakglass"]),
  approver_ids: z.array(z.number().int().positive()),
  glpi_validation_id: z.number().int().optional(),
});

export const AuditReceiptSchema = z.object({
  timestamp: z.string().datetime(),
  result: z.enum(["success", "failure", "partial"]),
  details: z.record(z.unknown()),
  rollback_executed: z.boolean(),
});

export const ActionContractSchema = z.object({
  action_id: z.string(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  target: TargetSchema,
  idempotency_key: z.string().uuid(),
  ttl_seconds: z.number().int().positive(),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  rollback_notes: z.string(),
  justification: z.string(),
  evidence: z.array(z.string()),
  policy_basis: z.string(),
  requestor: RequestorSchema,
  approval: ApprovalSchema.optional(),
  audit_receipt: AuditReceiptSchema.optional(),
});

export type ActionContract = z.infer<typeof ActionContractSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type Requestor = z.infer<typeof RequestorSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type AuditReceipt = z.infer<typeof AuditReceiptSchema>;
