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
//   // Sliding session: every refresh pushes the expiry forward by this many days
//   REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().min(1).max(3650).default(90),

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

// Empty strings in .env (KEY=) are treated as "not set"
const emptyToUndefined = (value) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

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

  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  // Extra allowed browser origins, comma separated (e.g. http://localhost:3000,http://192.168.1.31:3000)
  CORS_EXTRA_ORIGINS: optionalString,

  // Public URL of this API (ngrok / domain). Used for the webhook URL hint and
  // for sending template header images that were uploaded to this server.
  PUBLIC_BASE_URL: optionalUrl,

  /* ---------------- WhatsApp Cloud API ---------------- */
  // NOTE: these MUST be listed here. zod drops unknown keys, so anything that
  // is not in this schema is undefined on `env` (this is why Meta looked
  // "not connected" even with the values in .env).
  WHATSAPP_ACCESS_TOKEN: optionalString,
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_APP_ID: optionalString,
  WHATSAPP_APP_SECRET: optionalString,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString,
  WHATSAPP_GRAPH_VERSION: z.string().default("v23.0"),
  // Organization that receives webhook events when no organization has the
  // phone number id saved yet (fine while you run a single WhatsApp number)
  WHATSAPP_DEFAULT_ORGANIZATION_ID: optionalString
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