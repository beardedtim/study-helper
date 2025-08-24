import Log from "./shared/log";
import { traceFn } from "./shared/trace";
import * as HTTPPort from "./ports/http";
import { attachRoutes } from "./ports/http/routes";

const shutdown = traceFn(async (err?: Error) => {
  Log.info({ err }, "Requested Shutdown");

  await HTTPPort.close();

  if (err) {
    Log.fatal({ err }, "Shutting down due to error");
    process.exit(1);
  } else {
    Log.trace("Goodbye!");
    process.exit(0);
  }
}, "shutdown");

const init = traceFn(async () => {
  attachRoutes();
}, "init");

const main = traceFn(async () => {
  Log.info("Opening HTTP");

  await HTTPPort.open();

  Log.info("HTTP Open");
}, "main");

Log.trace("Starting System");

init()
  .then(main)
  .catch((err) => {
    Log.warn({ err }, "There was an issue starting the system");

    return shutdown(err);
  });
