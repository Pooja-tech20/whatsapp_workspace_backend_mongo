// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import pinoHttp from "pino-http";

// import { env } from "./config/env.js";
// import { getDatabaseStatus } from "./config/database.js";
// import routes from "./routes/index.js";

// const app = express();

// app.use(helmet());

// app.use(
//   cors({
//     origin: env.FRONTEND_URL,
//     credentials: true
//   })
// );

// app.use(express.json({ limit: "1mb" }));
// app.use(express.urlencoded({ extended: true }));
// app.use(pinoHttp());

// // Health check (includes MongoDB status)
// app.get("/api/health", (req, res) => {
//   const database = getDatabaseStatus();

//   res.status(database.connected ? 200 : 503).json({
//     success: database.connected,
//     message: "WhatsApp Workspace API is running",
//     database
//   });
// });

// // API routes
// app.use("/api/v1", routes);

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Route not found"
//   });
// });

// // Central error handler
// app.use((err, req, res, next) => {
//   req.log?.error(err);

//   // Zod validation errors -> 400 with readable details
//   if (err.name === "ZodError") {
//     return res.status(400).json({
//       success: false,
//       message: "Validation failed",
//       errors: err.issues.map((issue) => ({
//         field: issue.path.join("."),
//         message: issue.message
//       }))
//     });
//   }

//   res.status(err.status || err.statusCode || 500).json({
//     success: false,
//     message:
//       env.NODE_ENV === "production"
//         ? "Internal server error"
//         : err.message || "Internal server error"
//   });
// });

// export default app;

import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { getDatabaseStatus } from "./config/database.js";
import routes from "./routes/index.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp());

// Uploaded template header images/videos.
// helmet sends "same-origin" by default, which would stop the frontend
// (another port) from showing these files, so allow cross-origin for them.
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.resolve(process.cwd(), "uploads"))
);

// Health check (includes MongoDB status)
app.get("/api/health", (req, res) => {
  const database = getDatabaseStatus();

  res.status(database.connected ? 200 : 503).json({
    success: database.connected,
    message: "WhatsApp Workspace API is running",
    database
  });
});

// API routes
app.use("/api/v1", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// Central error handler
app.use((err, req, res, next) => {
  req.log?.error(err);

  // Zod validation errors -> 400 with readable details
  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  res.status(err.status || err.statusCode || 500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error"
  });
});

export default app;