// import fs from "fs/promises";

// import { env } from "../config/env.js";

// function httpError(message, statusCode) {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   return error;
// }

// /* ------------------------------ config ------------------------------ */

// export function isMetaConfigured() {
//   return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_BUSINESS_ACCOUNT_ID);
// }

// export function assertMetaConfigured() {
//   if (!isMetaConfigured()) {
//     throw httpError(
//       "WhatsApp is not connected. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID to .env and restart the server.",
//       409
//     );
//   }
// }

// /* ------------------------------ HTTP helper ------------------------------ */

// // Meta errors are returned as 502 on purpose: a 401 here would make the
// // frontend think the user's login expired and trigger a refresh loop.
// async function graph(path, { method = "GET", query, body, headers, raw = false } = {}) {
//   const url = new URL(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}${path}`);

//   for (const [key, value] of Object.entries(query || {})) {
//     if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
//   }

//   let response;

//   try {
//     response = await fetch(url, {
//       method,
//       headers: {
//         Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
//         ...(body && !raw ? { "Content-Type": "application/json" } : {}),
//         ...headers
//       },
//       body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
//       signal: AbortSignal.timeout(30000)
//     });
//   } catch (error) {
//     throw httpError(`Could not reach Meta: ${error.message}`, 502);
//   }

//   let data = null;
//   try {
//     data = await response.json();
//   } catch {
//     /* empty or non-JSON body */
//   }

//   if (!response.ok) {
//     const metaError = data?.error;
//     throw httpError(
//       metaError?.error_user_msg ||
//         metaError?.message ||
//         `Meta request failed (${response.status})`,
//       502
//     );
//   }

//   return data;
// }

// /* ------------------------------ payload builders (pure) ------------------------------ */

// export function buildMetaComponents(template, headerHandle) {
//   const components = [];

//   if (template.type === "IMAGE" || template.type === "VIDEO") {
//     components.push({
//       type: "HEADER",
//       format: template.type,
//       example: { header_handle: [headerHandle] }
//     });
//   }

//   const body = { type: "BODY", text: template.body };
//   if (template.variableCount > 0) {
//     body.example = {
//       body_text: [template.placeholderExamples.slice(0, template.variableCount)]
//     };
//   }
//   components.push(body);

//   if (template.footer) {
//     components.push({ type: "FOOTER", text: template.footer });
//   }

//   if (template.buttons?.length > 0) {
//     components.push({
//       type: "BUTTONS",
//       buttons: template.buttons.map((button) => ({
//         type: "QUICK_REPLY",
//         text: button.text
//       }))
//     });
//   }

//   return components;
// }

// // One template from Meta's list API -> fields for our Template model
// export function mapMetaTemplate(meta) {
//   const components = meta.components || [];
//   const find = (type) => components.find((c) => c.type === type);

//   const header = find("HEADER");
//   const body = find("BODY");
//   const footer = find("FOOTER");
//   const buttons = find("BUTTONS");

//   const bodyText = body?.text || "";
//   const variableCount = new Set(
//     [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => m[1])
//   ).size;

//   const headerFormat = header?.format;

//   return {
//     name: meta.name,
//     language: meta.language,
//     category: String(meta.category || "UTILITY").toUpperCase(),
//     status: String(meta.status || "PENDING").toUpperCase(),
//     type: headerFormat === "IMAGE" || headerFormat === "VIDEO" ? headerFormat : "TEXT",
//     body: bodyText,
//     footer: footer?.text || "",
//     placeholderExamples: (body?.example?.body_text?.[0] || []).map(String),
//     variableCount,
//     buttons: (buttons?.buttons || []).map((b) => ({
//       type: b.type || "QUICK_REPLY",
//       text: b.text
//     })),
//     rejectionReason:
//       meta.rejected_reason && meta.rejected_reason !== "NONE" ? meta.rejected_reason : "",
//     metaTemplateId: String(meta.id || "")
//   };
// }

// /* ------------------------------ Meta API calls ------------------------------ */

// // IMAGE/VIDEO templates need Meta to hold a sample of the header file
// export async function uploadHeaderSample({ filePath, mimeType, fileName }) {
//   if (!env.WHATSAPP_APP_ID) {
//     throw httpError(
//       "Image/Video templates need WHATSAPP_APP_ID in .env (your Meta App ID).",
//       409
//     );
//   }

//   const file = await fs.readFile(filePath);

//   const session = await graph(`/${env.WHATSAPP_APP_ID}/uploads`, {
//     method: "POST",
//     query: { file_length: file.length, file_type: mimeType, file_name: fileName }
//   });

//   const uploaded = await graph(`/${session.id}`, {
//     method: "POST",
//     headers: { Authorization: `OAuth ${env.WHATSAPP_ACCESS_TOKEN}`, file_offset: "0" },
//     body: file,
//     raw: true
//   });

//   return uploaded.h;
// }

// export async function createMetaTemplate(template, headerHandle) {
//   return graph(`/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
//     method: "POST",
//     body: {
//       name: template.name,
//       language: template.language,
//       category: template.category,
//       components: buildMetaComponents(template, headerHandle)
//     }
//   });
// }

// export async function listMetaTemplates() {
//   const all = [];
//   let after;

//   do {
//     const page = await graph(`/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
//       query: {
//         limit: 100,
//         fields: "id,name,language,status,category,rejected_reason,components",
//         after
//       }
//     });

//     all.push(...(page.data || []));
//     after = page.paging?.next ? page.paging?.cursors?.after : undefined;
//   } while (after);

//   return all;
// }

// export async function deleteMetaTemplate({ name, metaTemplateId }) {
//   return graph(`/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
//     method: "DELETE",
//     query: { name, hsm_id: metaTemplateId }
//   });
// }


import fs from "fs/promises";
import { env } from "../config/env.js";

function httpError(message, statusCode, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

export function isMetaConfigured() {
  return Boolean(
    env.WHATSAPP_ACCESS_TOKEN?.trim() &&
    env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() &&
    env.WHATSAPP_GRAPH_VERSION?.trim()
  );
}

export function assertMetaConfigured() {
  if (!isMetaConfigured()) {
    throw httpError(
      "WhatsApp is not connected. Configure WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_GRAPH_VERSION in .env, then restart the server.",
      503
    );
  }
}

async function graph(
  path,
  { method = "GET", query, body, headers, raw = false } = {}
) {
  assertMetaConfigured();

  const url = new URL(
    `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}${path}`
  );

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN.trim()}`,
        ...(body !== undefined && !raw
          ? { "Content-Type": "application/json" }
          : {}),
        ...headers
      },
      body:
        body === undefined
          ? undefined
          : raw
            ? body
            : JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    console.error("Meta network request failed:", {
      path,
      message: error.message
    });

    throw httpError(
      `Could not reach Meta: ${error.message}`,
      502
    );
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    // Meta may return an empty or non-JSON response.
  }

  if (!response.ok) {
    const metaError = data?.error;

    const details = {
      status: response.status,
      code: metaError?.code,
      subcode: metaError?.error_subcode,
      type: metaError?.type,
      message: metaError?.message,
      path
    };

    // Never log Authorization headers or access tokens.
    console.error("Meta Graph API error:", details);

    throw httpError(
      metaError?.error_user_msg ||
        metaError?.message ||
        `Meta request failed (${response.status})`,
      502,
      details
    );
  }

  return data;
}

/* ---------------- Payload builders ---------------- */

export function buildMetaComponents(template, headerHandle) {
  const components = [];

  if (template.type === "IMAGE" || template.type === "VIDEO") {
    if (!headerHandle) {
      throw httpError(
        "Meta header media handle is missing for this template.",
        400
      );
    }

    components.push({
      type: "HEADER",
      format: template.type,
      example: {
        header_handle: [headerHandle]
      }
    });
  }

  const body = {
    type: "BODY",
    text: template.body
  };

  if (template.variableCount > 0) {
    body.example = {
      body_text: [
        (template.placeholderExamples || []).slice(
          0,
          template.variableCount
        )
      ]
    };
  }

  components.push(body);

  if (template.footer) {
    components.push({
      type: "FOOTER",
      text: template.footer
    });
  }

  if (template.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: template.buttons.map((button) => ({
        type: "QUICK_REPLY",
        text: button.text
      }))
    });
  }

  return components;
}

export function mapMetaTemplate(meta) {
  const components = meta.components || [];
  const find = (type) => components.find((item) => item.type === type);

  const header = find("HEADER");
  const body = find("BODY");
  const footer = find("FOOTER");
  const buttons = find("BUTTONS");

  const bodyText = body?.text || "";
  const variableCount = new Set(
    [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(
      (match) => match[1]
    )
  ).size;

  const headerFormat = header?.format;

  return {
    name: meta.name,
    language: meta.language,
    category: String(meta.category || "UTILITY").toUpperCase(),
    status: String(meta.status || "PENDING").toUpperCase(),
    type:
      headerFormat === "IMAGE" || headerFormat === "VIDEO"
        ? headerFormat
        : "TEXT",
    body: bodyText,
    footer: footer?.text || "",
    placeholderExamples: (
      body?.example?.body_text?.[0] || []
    ).map(String),
    variableCount,
    buttons: (buttons?.buttons || []).map((button) => ({
      type: button.type || "QUICK_REPLY",
      text: button.text
    })),
    rejectionReason:
      meta.rejected_reason && meta.rejected_reason !== "NONE"
        ? meta.rejected_reason
        : "",
    metaTemplateId: String(meta.id || "")
  };
}

/* ---------------- Meta API calls ---------------- */

export async function uploadHeaderSample({
  filePath,
  mimeType,
  fileName
}) {
  assertMetaConfigured();

  if (!env.WHATSAPP_APP_ID?.trim()) {
    throw httpError(
      "Image/Video templates need WHATSAPP_APP_ID in .env.",
      503
    );
  }

  const file = await fs.readFile(filePath);

  const session = await graph(`/${env.WHATSAPP_APP_ID}/uploads`, {
    method: "POST",
    query: {
      file_length: file.length,
      file_type: mimeType,
      file_name: fileName
    }
  });

  if (!session?.id) {
    throw httpError(
      "Meta did not return an upload session ID.",
      502
    );
  }

  // Meta's resumable-upload endpoint uses OAuth authorization.
  const uploaded = await graph(`/${session.id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${env.WHATSAPP_ACCESS_TOKEN.trim()}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream"
    },
    body: file,
    raw: true
  });

  if (!uploaded?.h) {
    throw httpError(
      "Meta did not return a media handle for the uploaded file.",
      502
    );
  }

  return uploaded.h;
}

export async function createMetaTemplate(template, headerHandle) {
  return graph(
    `/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
    {
      method: "POST",
      body: {
        name: template.name,
        language: template.language,
        category: template.category,
        components: buildMetaComponents(template, headerHandle)
      }
    }
  );
}

export async function listMetaTemplates() {
  const all = [];
  let after;

  do {
    const page = await graph(
      `/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
      {
        query: {
          limit: 100,
          fields:
            "id,name,language,status,category,rejected_reason,components",
          after
        }
      }
    );

    all.push(...(page.data || []));
    after = page.paging?.next
      ? page.paging?.cursors?.after
      : undefined;
  } while (after);

  return all;
}

export async function deleteMetaTemplate({
  name,
  metaTemplateId
}) {
  return graph(
    `/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
    {
      method: "DELETE",
      query: {
        name,
        hsm_id: metaTemplateId
      }
    }
  );
}
