import { readFileSync } from "fs";
import { parse } from "yaml";
import { resolve } from "path";

interface TierDef {
  name: string;
  approval: string;
  required_right: string;
}

interface CooldownRule {
  min_interval_seconds: number;
  max_per_hour: number;
  scope: string;
}

interface PolicyResult {
  allowed: boolean;
  reason?: string;
  requires_approval?: string;
}

// Load policies
let tierDefs: Record<number, TierDef> = {};
let cooldownRules: Record<string, CooldownRule> = {};

try {
  const tierPath = resolve("policies/tier-definitions.yml");
  tierDefs = parse(readFileSync(tierPath, "utf-8")).tiers;
} catch { /* policies not yet deployed */ }

try {
  const cooldownPath = resolve("policies/cooldown-rules.yml");
  cooldownRules = parse(readFileSync(cooldownPath, "utf-8")).cooldowns;
} catch { /* policies not yet deployed */ }

// In-memory cooldown tracker
const cooldownTracker = new Map<string, number[]>();

let emergencyStop = false;

export function setEmergencyStop(value: boolean): void {
  emergencyStop = value;
}

export function isEmergencyStop(): boolean {
  return emergencyStop;
}

export function validateAction(action: {
  action_id: string;
  tier: number;
  target: { id: string };
  requestor: { interface: string };
  ttl_seconds: number;
}): PolicyResult {
  if (emergencyStop && action.tier > 0) {
    return { allowed: false, reason: "Emergency stop active — analysis only" };
  }

  const tierDef = tierDefs[action.tier];
  if (!tierDef) {
    return { allowed: false, reason: `Unknown tier: ${action.tier}` };
  }

  if (action.requestor.interface !== "central") {
    return { allowed: false, reason: "Central interface required" };
  }

  if (!action.target.id || action.target.id.trim() === "") {
    return { allowed: false, reason: "Immutable target ID required" };
  }

  // Cooldown check
  const rule = cooldownRules[action.action_id];
  if (rule) {
    const key = `${action.action_id}:${action.target.id}`;
    const history = cooldownTracker.get(key) || [];
    const now = Date.now() / 1000;

    const lastExec = history[history.length - 1];
    if (lastExec && (now - lastExec) < rule.min_interval_seconds) {
      const wait = Math.ceil(rule.min_interval_seconds - (now - lastExec));
      return { allowed: false, reason: `Cooldown: wait ${wait}s` };
    }

    const lastHour = history.filter(t => (now - t) < 3600);
    if (lastHour.length >= rule.max_per_hour) {
      return { allowed: false, reason: `Rate limit: max ${rule.max_per_hour}/hour` };
    }
  }

  if (action.ttl_seconds <= 0) {
    return { allowed: false, reason: "Action proposal expired" };
  }

  return {
    allowed: true,
    requires_approval: tierDef.approval === "none" ? undefined : tierDef.approval,
  };
}

export function recordExecution(actionId: string, targetId: string): void {
  const key = `${actionId}:${targetId}`;
  const history = cooldownTracker.get(key) || [];
  history.push(Date.now() / 1000);
  cooldownTracker.set(key, history.slice(-100));
}
