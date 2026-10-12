import { z } from "zod";

const VARIABLE_TOKEN = /\{\{\s*([^}]*?)\s*\}\}/g;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// "{{1}} ... {{2}}" -> { numbers: [1, 2], invalid: ["{{name}}"] }
export function extractVariables(text) {
  const numbers = [];
  const invalid = [];

  for (const match of text.matchAll(VARIABLE_TOKEN)) {
    if (/^\d+$/.test(match[1])) numbers.push(Number(match[1]));
    else invalid.push(match[0]);
  }

  return {
    numbers: [...new Set(numbers)].sort((a, b) => a - b),
    invalid
  };
}

/* ---------- small helpers so form-data and JSON both work ---------- */

const blankToUndefined = (value) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// Accepts an array, a JSON string '["a","b"]', or (when allowed) a plain string
function toList(value, { splitOnComma }) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* fall through to plain-string handling */
      }
    }

    return splitOnComma ? trimmed.split(",") : [trimmed];
  }

  return [value];
}

const cleanTexts = (items) =>
  items
    .map((item) => (typeof item === "object" && item !== null ? item.text : item))
    .map((item) => (item === undefined || item === null ? "" : String(item).trim()))
    .filter(Boolean);

const TYPE_ALIASES = { TEXT: "TEXT", "TEXT-ONLY": "TEXT", IMAGE: "IMAGE", VIDEO: "VIDEO" };

const typeField = z.preprocess((value) => {
  if (typeof value !== "string" || !value.trim()) return "TEXT";
  const key = value.trim().toUpperCase().replace(/[\s_]+/g, "-");
  return TYPE_ALIASES[key] ?? value;
}, z.enum(["TEXT", "IMAGE", "VIDEO"], { error: "Type must be Text-only, Image or Video" }));

const categoryField = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "UTILITY",
  z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"], {
    error: "Category must be Utility, Marketing or Authentication"
  })
);

const booleanField = z.preprocess(
  (value) =>
    value === true || ["true", "1", "on", "yes"].includes(String(value).toLowerCase()),
  z.boolean()
);

/* ---------- main schema (needs the uploaded file to check header rules) ---------- */

function buildCreateSchema(file) {
  return z
    .object({
      name: z
        .string({ error: "Template name is required" })
        .trim()
        .min(1, "Template name is required")
        .max(512)
        .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores only"),

      language: z.preprocess(
        blankToUndefined,
        z
          .string()
          .trim()
          .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Use a language code like en_US")
          .default("en_US")
      ),

      type: typeField,
      category: categoryField,

      body: z
        .string({ error: "Message body is required" })
        .trim()
        .min(1, "Message body is required")
        .max(1024, "Message body can be at most 1024 characters"),

      footer: z.preprocess(
        blankToUndefined,
        z.string().trim().max(60, "Footer can be at most 60 characters").default("")
      ),

      placeholderExamples: z.preprocess(
        (value) => cleanTexts(toList(value, { splitOnComma: true })),
        z.array(z.string().max(150)).default([])
      ),

      buttons: z.preprocess(
        (value) => cleanTexts(toList(value, { splitOnComma: false })),
        z
          .array(z.string().min(1).max(25, "Button text can be at most 25 characters"))
          .max(5, "You can add up to 5 quick reply buttons")
      ),

      submitForApproval: booleanField.default(false)
    })
    .superRefine((data, ctx) => {
      const issue = (path, message) =>
        ctx.addIssue({ code: "custom", path: [path], message });

      // Variables in the body
      const { numbers, invalid } = extractVariables(data.body);

      if (invalid.length > 0) {
        issue("body", `Use numbered placeholders like {{1}}, not ${invalid[0]}`);
      } else if (!numbers.every((value, index) => value === index + 1)) {
        issue("body", "Placeholders must be numbered in order: {{1}}, {{2}}, {{3}} ...");
      } else if (numbers.length > 0 && (/^\s*\{\{/.test(data.body) || /\}\}\s*$/.test(data.body))) {
        issue("body", "Message body cannot start or end with a placeholder");
      }

      if (numbers.length > 0 && data.placeholderExamples.length < numbers.length) {
        issue(
          "placeholderExamples",
          `Add ${numbers.length} example value(s), separated by commas`
        );
      }

      if (/\{\{/.test(data.footer)) {
        issue("footer", "Footer cannot contain placeholders");
      }

      const lowered = data.buttons.map((text) => text.toLowerCase());
      if (new Set(lowered).size !== lowered.length) {
        issue("buttons", "Button texts must be different from each other");
      }

      // Header media rules
      if (data.type === "TEXT" && file) {
        issue("headerMedia", "Header media is only used for Image or Video templates");
      }

      if (data.type !== "TEXT") {
        if (!file) {
          issue("headerMedia", `Header media is required for ${data.type} templates`);
        } else if (data.type === "IMAGE" && !file.mimetype.startsWith("image/")) {
          issue("headerMedia", "Image templates need a JPG or PNG file");
        } else if (data.type === "VIDEO" && !file.mimetype.startsWith("video/")) {
          issue("headerMedia", "Video templates need an MP4 or 3GP file");
        } else if (data.type === "IMAGE" && file.size > MAX_IMAGE_SIZE) {
          issue("headerMedia", "Header image can be at most 5 MB");
        }
      }
    })
    .transform((data) => {
      const { numbers } = extractVariables(data.body);

      return {
        ...data,
        variableCount: numbers.length,
        placeholderExamples: data.placeholderExamples.slice(0, numbers.length)
      };
    });
}

// Throws a ZodError (-> 400 with field errors) when the input is not valid
export function parseTemplateInput(body, file) {
  return buildCreateSchema(file).parse(body ?? {});
}

/* ---------- query for the list screen ---------- */

const upperOrUndefined = (value) =>
  typeof value === "string" && value.trim() ? value.trim().toUpperCase() : undefined;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.preprocess(
    upperOrUndefined,
    z.enum(["ALL", "DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED", "DISABLED"]).optional()
  ),
  category: z.preprocess(
    upperOrUndefined,
    z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]).optional()
  )
});