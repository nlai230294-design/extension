import { z } from "zod";

import { POST_MAX_LENGTH, MAX_BATCH_SIZE } from "../utils/constants.js";

export const postItemSchema = z.object({
  client_post_id: z.string().min(1),
  display_name: z.string().optional(),
  profile_url: z.string().optional(),
  content: z.string().min(1).max(POST_MAX_LENGTH),
  post_url: z.string().optional(),
  source_url: z.string().optional(),
  post_hash: z.string().optional(),
});

export const batchSchema = z.object({
  session_id: z.string().min(1),
  items: z.array(postItemSchema).min(1).max(MAX_BATCH_SIZE),
});

export const createSessionSchema = z.object({
  source_url: z.string().optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
