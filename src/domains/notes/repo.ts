import * as Schemas from "./schemas";
import { Kysely, sql } from "kysely";
import type { DB } from "../../connections/db.d";

export interface CreateNoteReq {
  db: Kysely<DB>;
  note: Schemas.CreateNote;
}

export const createNote = async ({ db, note }: CreateNoteReq) => {
  const record = await Schemas.CreateNoteSchema.parseAsync(note);

  return db
    .insertInto("notes")
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow();
};

export interface UpdateNoteReq {
  db: Kysely<DB>;
  note: Schemas.UpdateNote;
}

export const upsertNote = async ({ db, note }: UpdateNoteReq) => {
  const record = await Schemas.UpdateNoteSchema.parseAsync(note);

  return db
    .insertInto("notes")
    .values(record)
    .onConflict((oc) => oc.column("id").doUpdateSet(record))
    .returningAll()
    .executeTakeFirstOrThrow();
};

export interface DeleteNoteReq {
  db: Kysely<DB>;
  id: string;
}

export const deleteNote = async ({ db, id }: DeleteNoteReq) => {
  await db.deleteFrom("notes").where("id", "=", id).execute();
};

export interface GetNoteByIdReq {
  db: Kysely<DB>;
  id: string;
}

export const getNoteById = async ({ db, id }: GetNoteByIdReq) => {
  return db
    .selectFrom("notes")
    .where("id", "=", id)
    .selectAll()
    .executeTakeFirstOrThrow();
};

export interface ListNotesReq {
  db: Kysely<DB>;
}

export const listNotes = async ({ db }: ListNotesReq) => {
  return db.selectFrom("notes").selectAll().execute();
};

export interface AttachReferencesToNotesReq {
  db: Kysely<DB>;
  id: string;
  refs: string[];
}

export interface GetNotesWithReferencesReq {
  db: Kysely<DB>;
  ids: string[];
}
