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

export interface AttachReferencesToNotesReq {
  db: Kysely<DB>;
  id: string;
  refs: string[];
}

export const attachReferencesToNote = async ({
  db,
  id,
  refs,
}: AttachReferencesToNotesReq) => {
  await db
    .insertInto("note_references")
    .values(
      refs.map((ref) => ({
        note_id: id,
        ref,
      }))
    )
    .execute();
};

export interface GetNotesWithReferencesReq {
  db: Kysely<DB>;
  ids: string[];
}

export const getNoteswithReferences = async ({
  db,
  ids,
}: GetNotesWithReferencesReq) => {
  return db
    .selectFrom("notes")
    .leftJoin("note_references", "notes.id", "note_references.note_id")
    .selectAll("notes")
    .select(
      sql<
        string[]
      >`ARRAY_AGG(note_references.ref) FILTER (WHERE note_references.ref IS NOT NULL)`.as(
        "refs"
      )
    )
    .where("notes.id", "in", ids)
    .groupBy("notes.id")
    .execute();
};
