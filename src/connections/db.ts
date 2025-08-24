import { Pool } from "pg";
import getenv from "getenv";

import { Kysely, PostgresDialect } from "kysely";
import type { DB } from "./db.d";

const dialect = new PostgresDialect({
  pool: new Pool({
    user: getenv.string("DATABASE_USER"),
    password: getenv.string("DATABASE_PASSWORD"),
    host: getenv.string("DATABASE_HOST"),
    port: getenv.int("DATABASE_PORT"),
    database: getenv.string("DATABASE_NAME"),
  }),
});

const db = new Kysely<DB>({
  dialect,
});

export default db;
