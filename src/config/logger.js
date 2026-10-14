import pino from "pino";

import { env } from "./env.js";

// Used outside of request handlers (webhook processing, workers).
// Inside a request, prefer req.log.
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info"
});

export default logger;