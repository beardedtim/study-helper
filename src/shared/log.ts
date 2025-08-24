import Pino from "pino";
import getenv from "getenv";

export default Pino({
  name: getenv.string("NAME"),
  level: getenv.string("LOG_LEVEL", "trace"),
  serializers: Pino.stdSerializers,
  timestamp: Pino.stdTimeFunctions.isoTime,
});
