import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { hmacFetch } from "./hmac-fetch.js";

const TOOL_GATEWAY_URL = process.env.TOOL_GATEWAY_URL || "http://localhost:3002";

// Define MCP tools that proxy to the tool gateway
const automitTools = createSdkMcpServer({
  name: "automit-tools",
  version: "1.0.0",
  tools: [
    tool(
      "get_ticket",
      "Get GLPI ticket context with followups and linked assets",
      { ticket_id: z.number().describe("GLPI ticket ID") },
      async (args) => {
        const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/glpi/ticket/${args.ticket_id}`);
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    ),
    tool(
      "add_followup",
      "Add a followup to a GLPI ticket",
      {
        ticket_id: z.number().describe("GLPI ticket ID"),
        content: z.string().describe("Followup content"),
        is_private: z.boolean().default(true).describe("Private followup"),
      },
      async (args) => {
        const body = JSON.stringify({ content: args.content, is_private: args.is_private });
        const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/glpi/ticket/${args.ticket_id}/followup`, {
          method: "POST",
          body,
        });
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
      }
    ),
    tool(
      "list_erp_jobs",
      "List allowlisted ERP jobs with tier and cooldown info",
      {},
      async () => {
        const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/erp/jobs`);
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    ),
    tool(
      "get_job_status",
      "Get status of a specific ERP job",
      { job_name: z.string().describe("ERP job name from the allowlist") },
      async (args) => {
        const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/erp/job/${encodeURIComponent(args.job_name)}/status`);
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
      }
    ),
    tool(
      "list_m365_users",
      "List Microsoft 365 users",
      {},
      async () => {
        const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/m365/users`);
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    ),
    tool(
      "get_risky_signins",
      "Get risky sign-ins from Microsoft 365 Identity Protection",
      {},
      async () => {
        const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/m365/risky-signins`);
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    ),
  ],
});

// Tier 0-1 tools only (read + reversible ticket ops)
const TIER01_TOOLS = [
  "mcp__automit-tools__get_ticket",
  "mcp__automit-tools__add_followup",
  "mcp__automit-tools__list_erp_jobs",
  "mcp__automit-tools__get_job_status",
  "mcp__automit-tools__list_m365_users",
  "mcp__automit-tools__get_risky_signins",
];

const SYSTEM_PROMPT = `Tu es l'assistant IT AutomIT de Motherson Aerospace.
Tu analyses les tickets GLPI et proposes des actions de remediation.

Regles strictes:
- Reponds TOUJOURS en francais
- Cite tes sources (numeros de ticket, noms de jobs, IDs utilisateur)
- Ne fabrique JAMAIS de donnees — utilise uniquement les outils disponibles
- Pour les actions Tier 2+ (restart ERP, desactivation AD), PROPOSE sans executer
- Redige des followups prives techniques et des reponses publiques claires
- Respecte la confidentialite: ne mentionne pas les details internes dans les reponses publiques`;

export interface AgentResult {
  response: string;
  tools_used: string[];
  turn_count: number;
}

export async function runAgent(prompt: string, mode: "analyze" | "draft" | "propose"): Promise<AgentResult> {
  const tools_used: string[] = [];
  let response = "";
  let turn_count = 0;

  const fullPrompt = mode === "draft"
    ? `${prompt}\n\nGenere deux reponses:\n1. Un followup PRIVE technique (diagnostic, actions prises/proposees)\n2. Un followup PUBLIC pour l'utilisateur (clair, professionnel)\n\nFormate clairement les deux sections.`
    : mode === "propose"
    ? `${prompt}\n\nAnalyse la situation et propose des actions concretes de remediation. Pour chaque action, indique:\n- Description de l'action\n- Tier (0=lecture, 1=ticket, 2=externe borne, 3=destructif)\n- Justification\n- Preconditions et postconditions`
    : prompt;

  for await (const message of query({
    prompt: fullPrompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: { "automit-tools": automitTools },
      allowedTools: TIER01_TOOLS,
      permissionMode: "dontAsk" as const,
      maxTurns: 10,
    },
  })) {
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if ("text" in block && block.text) {
          response += block.text;
        } else if ("name" in block && block.name) {
          tools_used.push(block.name);
        }
      }
      turn_count++;
    }
  }

  return { response, tools_used: [...new Set(tools_used)], turn_count };
}
