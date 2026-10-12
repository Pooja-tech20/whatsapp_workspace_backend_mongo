
// import "dotenv/config";

// import app from "./app.js";
// import connectDatabase from "./config/database.js";

// const PORT = process.env.PORT || 5000;

// async function startServer() {
//   await connectDatabase();

//   app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//   });
// }

// startServer();

import { env } from "./config/env.js";
import app from "./app.js";
import {
  connectDatabase,
  disconnectDatabase
} from "./config/database.js";

let server;

async function startServer() {
  try {
    await connectDatabase();
  } catch {
    process.exit(1);
  }

  server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

startServer();