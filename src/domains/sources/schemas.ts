import { z } from "zod";

export const SourceSchema = z.object({
  id: z.uuid(),
  source: z.url(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z.iso.datetime(),
});

export type Source = z.infer<typeof SourceSchema>;

export const ChunkSchema = z.object({
  id: z.uuid(),
  source_id: z.uuid(),
  content: z.string(),
  embedding: z.array(z.number()),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  model: z.string(),
});

export type Chunk = z.infer<typeof ChunkSchema>;

export const CreateSourceSchema = z.object({
  source: z.url(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreateSource = z.infer<typeof CreateSourceSchema>;
