import * as Schemas from "./schemas";
import { Kysely, sql } from "kysely";
import type { DB } from "../../connections/db.d";

export interface CreateSourceRequest {
  db: Kysely<DB>;
  source: Schemas.CreateSource;
}

export const createSource = async ({ db, source }: CreateSourceRequest) => {
  const record = await Schemas.CreateSourceSchema.parseAsync(source);

  return db
    .insertInto("sources")
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow();
};
