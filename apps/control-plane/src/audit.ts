import { randomUUID } from "crypto";

export interface AuditReceipt {
  receipt_id: string;
  action_id: string;
  target: { type: string; id: string; display_name: string };
  requestor: { glpi_user_id: number; profile: string; entity: string };
  tier: number;
  result: "success" | "failure" | "partial";
  timestamp: string;
  details: Record<string, unknown>;
}

const auditLog: AuditReceipt[] = [];

export function createReceipt(
  actionId: string,
  target: { type: string; id: string; display_name: string },
  requestor: { glpi_user_id: number; profile: string; entity: string },
  tier: number,
  result: "success" | "failure" | "partial",
  details: Record<string, unknown>,
): AuditReceipt {
  const receipt: AuditReceipt = {
    receipt_id: randomUUID(),
    action_id: actionId,
    target,
    requestor,
    tier,
    result,
    timestamp: new Date().toISOString(),
    details,
  };
  auditLog.push(receipt);
  console.log(`[AUDIT] ${receipt.receipt_id}: ${actionId} on ${target.type}:${target.id} = ${result}`);
  return receipt;
}

export function getReceipt(receiptId: string): AuditReceipt | undefined {
  return auditLog.find(r => r.receipt_id === receiptId);
}

export function getReceiptByActionId(actionId: string): AuditReceipt | undefined {
  return auditLog.find(r => r.action_id === actionId);
}

export function getAuditLog(): AuditReceipt[] {
  return [...auditLog];
}
