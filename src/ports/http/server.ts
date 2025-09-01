import { serve, type ServerType } from "@hono/node-server";
import getenv from "getenv";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";

export const app = new OpenAPIHono();

app.use(cors());

let server: ServerType;

export const open = async () => {
  if (!server) {
    await new Promise((res) => {
      server = serve({ ...app, port: getenv.int("PORT") }, res);
    });
  }
};

export const close = async () => {
  if (server) {
    await new Promise((res, rej) => {
      return server.close((err) => {
        if (err) {
          rej(err);
        } else {
          res(void 0);
        }
      });
    });
  }
};
