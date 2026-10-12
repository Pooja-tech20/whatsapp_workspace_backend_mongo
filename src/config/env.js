// import "dotenv/config";
// import { z } from "zod";

// const envSchema = z.object({
//   NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
//   PORT: z.coerce.number().int().positive().default(5000),

//   MONGODB_URI: z
//     .string()
//     .min(1, "MONGODB_URI is required")
//     .refine(
//       (value) => /^mongodb(\+srv)?:\/\//.test(value),
//       "MONGODB_URI must start with mongodb:// or mongodb+srv://"
//     ),
//   MONGODB_DB_NAME: z.string().trim().optional(),

//   JWT_ACCESS_SECRET: z
//     .string()
//     .min(32, "JWT_ACCESS_SECRET must be at least 32 characters")
//     .refine(
//       (value) => !value.startsWith("replace_with"),
//       "JWT_ACCESS_SECRET is still the placeholder - generate a real secret"
//     ),
//   JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

//   FRONTEND_URL: z.string().url().default("http://localhost:5173")
// });

// const parsed = envSchema.safeParse(process.env);

// if (!parsed.success) {
//   console.error("Invalid environment configuration:");
//   for (const issue of parsed.error.issues) {
//     console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
//   }
//   console.error("Fix your .env file (see .env.example) and restart.");
//   process.exit(1);
// }

// export const env = parsed.data;
// export default env;

import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .refine(
      (value) => /^mongodb(\+srv)?:\/\//.test(value),
      "MONGODB_URI must start with mongodb:// or mongodb+srv://"
    ),
  MONGODB_DB_NAME: z.string().trim().optional(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters")
    .refine(
      (value) => !value.startsWith("replace_with"),
      "JWT_ACCESS_SECRET is still the placeholder - generate a real secret"
    ),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  // Sliding session: every refresh pushes the expiry forward by this many days
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().min(1).max(3650).default(90),

  FRONTEND_URL: z.string().url().default("http://localhost:5173")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("Fix your .env file (see .env.example) and restart.");
  process.exit(1);
}

export const env = parsed.data;
export default env;