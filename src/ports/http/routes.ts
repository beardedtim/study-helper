import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { sql, NoResultError } from "kysely";
import { app } from "./server";
import * as NotesDomain from "../../domains/notes";
import * as SourcesDomain from "../../domains/sources";
import Log from "../../shared/log";
import DB from "../../connections/db";
import * as MQ from "../../connections/mq";
import { streamSSE } from "hono/streaming";
import handleAsk from "../../use-cases/handle-ask";
import log from "../../shared/log";

const healthCheckSchema = createRoute({
  method: "get",
  path: "/.well-known/healthcheck",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            healthy: z.boolean(),
          }),
        },
      },
      description: "The service is healthy",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            healthy: z.boolean(),
          }),
        },
      },
      description: "The service is not healthy",
    },
  },
});

const createNoteSchema = createRoute({
  method: "post",
  path: "/notes",
  request: {
    body: {
      content: {
        "application/json": {
          schema: NotesDomain.Schemas.CreateNoteSchema.extend({
            refs: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({
            data: NotesDomain.Schemas.NoteSchema,
          }),
        },
      },
      description: "The newly created note",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              message: z.string(),
            }),
          }),
        },
      },
      description: "There was an issue perfofrming the request",
    },
  },
});

const getNoteByIdSchema = createRoute({
  method: "get",
  path: "/notes/:id",
  request: {
    params: z.object({
      id: z.uuid(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: NotesDomain.Schemas.NoteSchema.extend({
              refs: z.array(z.string()),
            }),
          }),
        },
      },
      description: "The Note at that ID",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              message: z.string(),
            }),
          }),
        },
      },
      description: "There was an issue perfofrming the request",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              message: z.string(),
            }),
          }),
        },
      },
      description: "There was no Note at that ID",
    },
  },
});

const deleteNoteByIdSchema = createRoute({
  method: "delete",
  path: "/notes/:id",
  request: {
    params: z.object({
      id: z.uuid(),
    }),
  },
  responses: {
    204: {
      content: {},
      description: "Successfully deleted",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              message: z.string(),
            }),
          }),
        },
      },
      description: "There was an issue perfofrming the request",
    },
  },
});

const askSchema = createRoute({
  method: "post",
  path: "/ask",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.any(),
        },
        "text/event-stream": {
          schema: z.any(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
      description: "An answer to our query",
    },
  },
});

const ingestSchema = createRoute({
  method: "post",
  path: "/ingest",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            url: z.url(),
          }),
        },
      },
    },
  },
  responses: {
    202: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
          }),
        },
      },
      description: "If we have successfully started ingesting",
    },
  },
});

export const attachRoutes = () => {
  app
    .openapi(healthCheckSchema, async (c) => {
      try {
        // If the DB does not throw, we are healthy
        await sql`SELECT NOW()`.execute(DB);

        return c.json({ healthy: true }, 200);
      } catch (err) {
        Log.warn({ err }, "Service not healthy");

        return c.json({ healthy: false }, 500);
      }
    })
    .openapi(createNoteSchema, async (c) => {
      const body = await c.req.json();

      const result = await NotesDomain.Repo.createNote({
        db: DB,
        note: body,
      });

      if (body.refs) {
        await NotesDomain.Repo.attachReferencesToNote({
          db: DB,
          id: result.id,
          refs: body.refs,
        });
      }

      return c.json({ data: result }, 201);
    })
    .openapi(getNoteByIdSchema, async (c) => {
      const id = await c.req.param("id");
      try {
        const result = await NotesDomain.Repo.getNoteswithReferences({
          db: DB,
          ids: [id],
        });

        if (!result.length) {
          return c.json({ error: { message: `No Note:${id} found` } }, 404);
        }

        return c.json(
          {
            data: {
              ...result[0],
              refs: result[0].refs ?? [],
            },
          },
          200
        );
      } catch (err) {
        if (err instanceof NoResultError) {
          return c.json({ error: { message: `No Note:${id} found` } }, 404);
        }

        throw err;
      }
    })
    .openapi(deleteNoteByIdSchema, async (c) => {
      const id = await c.req.param("id");

      await NotesDomain.Repo.deleteNote({
        db: DB,
        id,
      });

      return c.body(null, 204) as any;
    })
    .openapi(askSchema, async (c) => {
      const body = await c.req.json();
      return streamSSE(c, async (stream) => {
        await handleAsk({
          query: body.query,
          why: body.why,
          stream,
        });
      }) as any;
    })
    .openapi(ingestSchema, async (c) => {
      log.info("Ingest Requested");
      const body = await c.req.json();

      const source = await SourcesDomain.Repo.createSource({
        db: DB,
        source: {
          source: body.url,
          metadata: { ingestedAt: new Date().toISOString() },
        },
      });

      log.info({ source }, "Created source");

      const req = {
        id: source.id,
        data: {
          url: body.url,
          source_id: source.id,
        },
      };

      await MQ.publisher.send("ingest", req);

      return c.json(
        {
          id: source.id,
        },
        202
      );
    });
};
