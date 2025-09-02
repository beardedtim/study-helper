import { Connection } from "rabbitmq-client";
import getenv from "getenv";

const rabbit = new Connection(
  `amqp://${getenv.string("INGEST_USER")}:${getenv.string(
    "INGEST_PASS"
  )}@${getenv.string("INGEST_HOST")}:${getenv.int("INGEST_PORT")}`
);

export const publisher = rabbit.createPublisher({
  // Enable publish confirmations, similar to consumer acknowledgements
  confirm: true,
  // Enable retries
  maxAttempts: 3,
});
