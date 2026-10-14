// import path from "path";
// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import pinoHttp from "pino-http";

// import { env } from "./config/env.js";
// import { getDatabaseStatus } from "./config/database.js";
// import routes from "./routes/index.js";

// const app = express();

// app.use(helmet());

// const allowedOrigins = [
//   "http://localhost:3000",
//   "http://127.0.0.1:3000",
//   "http://192.168.1.31:3000",
// ];

// app.use(
//   cors({
//     origin: env.FRONTEND_URL,
//     credentials: true
//   })
// );

// // Keep the exact bytes Meta sent: the webhook signature (X-Hub-Signature-256)
// // is calculated over the raw body, not over the parsed JSON.
// app.use(
//   express.json({
//     limit: "1mb",
//     verify: (req, res, buf) => {
//       req.rawBody = buf;
//     }
//   })
// );
// app.use(express.urlencoded({ extended: true }));
// app.use(pinoHttp());

// // Uploaded template header images/videos.
// // helmet sends "same-origin" by default, which would stop the frontend
// // (another port) from showing these files, so allow cross-origin for them.
// app.use(
//   "/uploads",
//   (req, res, next) => {
//     res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
//     next();
//   },
//   express.static(path.resolve(process.cwd(), "uploads"))
// );

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

// 1. Logging first so req.log exists for everything below
app.use(pinoHttp());

// 2. Security headers
app.use(
  helmet({
    // Let the frontend (different origin) embed files served from /uploads
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// 3. CORS — actually use the allowed list
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://192.168.1.31:3000"
];

if (env.FRONTEND_URL && !allowedOrigins.includes(env.FRONTEND_URL)) {
  allowedOrigins.push(env.FRONTEND_URL);
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server requests (no Origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true
  })
);

// 4. Body parsers — keep raw bytes for Meta signature verification.
//    Apply to BOTH json and urlencoded so rawBody is always available.
const captureRawBody = (req, res, buf) => {
  if (buf && buf.length) req.rawBody = buf;
};

app.use(
  express.json({
    limit: "1mb",
    verify: captureRawBody
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    verify: captureRawBody
  })
);

// 5. Static uploads
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"), {
    index: false,
    dotfiles: "deny",
    fallthrough: true
  })
);

// 6. Health check
app.get("/api/health", (req, res) => {
  const database = getDatabaseStatus();
  res.status(database.connected ? 200 : 503).json({
    success: database.connected,
    message: "WhatsApp Workspace API is running",
    database
  });
});

// 7. API routes
app.use("/api/v1", routes);

// 8. 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// 9. Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  req.log?.error(err);

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

  // CORS rejection
  if (err.message?.startsWith("Origin not allowed by CORS")) {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed"
    });
  }

  const status = err.status || err.statusCode || 500;
  const isProd = (env.NODE_ENV || "production") === "production";

  res.status(status).json({
    success: false,
    message: isProd ? "Internal server error" : err.message || "Internal server error"
  });
});

export default app;