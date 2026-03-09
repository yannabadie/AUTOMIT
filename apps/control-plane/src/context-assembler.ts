import { hmacFetch } from "./hmac-fetch.js";

const TOOL_GATEWAY_URL = process.env.TOOL_GATEWAY_URL || "http://localhost:3002";

export interface TicketContext {
  ticket_id: number;
  title: string;
  description: string;
  status: number;
  urgency: number;
  impact: number;
  followups: Array<{
    content: string;
    is_private: boolean;
    author: string;
    date: string;
  }>;
  linked_assets: Array<{ type: string; id: number; name: string }>;
}

export async function assembleContext(ticketId: number): Promise<string> {
  const resp = await hmacFetch(`${TOOL_GATEWAY_URL}/glpi/ticket/${ticketId}`, { method: "GET" });
  if (!resp.ok) throw new Error(`Failed to fetch ticket ${ticketId}: ${resp.status}`);
  const ticket: TicketContext = await resp.json();

  let context = `## Ticket #${ticket.ticket_id}: ${ticket.title}\n`;
  context += `Statut: ${ticket.status} | Urgence: ${ticket.urgency} | Impact: ${ticket.impact}\n`;
  context += `\n### Description\n${ticket.description}\n`;

  if (ticket.followups.length > 0) {
    context += `\n### Suivi (${ticket.followups.length} messages)\n`;
    for (const fu of ticket.followups.slice(-10)) {
      const vis = fu.is_private ? "[PRIVE]" : "[PUBLIC]";
      context += `- ${vis} ${fu.author} (${fu.date}): ${fu.content.slice(0, 500)}\n`;
    }
  }

  if (ticket.linked_assets.length > 0) {
    context += `\n### Assets lies\n`;
    for (const asset of ticket.linked_assets) {
      context += `- ${asset.type} #${asset.id}: ${asset.name}\n`;
    }
  }

  return context;
}
