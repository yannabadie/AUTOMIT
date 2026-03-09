import { z } from "zod";

export const FollowupSchema = z.object({
  id: z.number().int(),
  content: z.string(),
  is_private: z.boolean(),
  author: z.string(),
  date: z.string(),
});

export const LinkedAssetSchema = z.object({
  type: z.string(),
  id: z.number().int(),
  name: z.string(),
});

export const TicketContextSchema = z.object({
  ticket_id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  status: z.number().int(),
  category: z.string().optional(),
  urgency: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(5),
  requester: z.object({
    id: z.number().int(),
    name: z.string(),
  }),
  assigned_technician: z.object({
    id: z.number().int(),
    name: z.string(),
  }).optional(),
  followups: z.array(FollowupSchema),
  linked_assets: z.array(LinkedAssetSchema),
  ticket_hash: z.string(),
});

export type TicketContext = z.infer<typeof TicketContextSchema>;
export type Followup = z.infer<typeof FollowupSchema>;
export type LinkedAsset = z.infer<typeof LinkedAssetSchema>;
