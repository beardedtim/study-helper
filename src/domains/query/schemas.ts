import { z } from "zod";

export const QuerySchema = z.object({
  query: z.string(),
  why: z.string().optional(),
});

/**
 * A Query is our way to ask a question of our
 * system. It is separate from any Commands or
 * CRUD-like interfaces and instead is expecting
 * that the system _think_ and _produce_ something
 */
export type Query = z.infer<typeof QuerySchema>;
