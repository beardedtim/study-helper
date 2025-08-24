import { z } from "zod";

export const NoteSchema = z.object({
  id: z.uuid(),
  note: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export type Note = z.infer<typeof NoteSchema>;

export const CreateNoteSchema = NoteSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateNote = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = NoteSchema.omit({
  created_at: true,
  updated_at: true,
});

export type UpdateNote = z.infer<typeof UpdateNoteSchema>;
