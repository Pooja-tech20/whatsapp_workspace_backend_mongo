// import { env } from "../config/env.js";

// /**
//  * Thin wrapper over the WhatsApp Cloud API (graph.facebook.com).
//  * It only talks to Meta. Saving messages in MongoDB happens in messaging.service.js.
//  */

// function httpError(message, statusCode, extra = {}) {
//   const error = new Error(message);
//   error.statusCode = statusCode;
//   Object.assign(error, extra);
//   return error;
// }

// /* ------------------------------ config ------------------------------ */

// export function resolvePhoneNumberId(organization) {
//   return organization?.whatsapp?.phoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID || "";
// }

// export function assertSendConfigured(phoneNumberId) {
//   if (!env.WHATSAPP_ACCESS_TOKEN || !phoneNumberId) {
//     throw httpError(
//       "WhatsApp is not connected. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to .env and restart the server.",
//       409
//     );
//   }
// }

// /* ------------------------------ HTTP helper ------------------------------ */

// // Meta failures are returned as 502 on purpose: a 401 would make the frontend
// // think the user's login expired and start a token-refresh loop.
// async function graph(path, { method = "GET", query, body } = {}) {
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
//         ...(body ? { "Content-Type": "application/json" } : {})
//       },
//       body: body ? JSON.stringify(body) : undefined,
//       signal: AbortSignal.timeout(30000)
//     });
//   } catch (error) {
//     throw httpError(`Could not reach Meta: ${error.message}`, 502, {
//       metaCode: "NETWORK",
//       retryable: true
//     });
//   }

//   let data = null;
//   try {
//     data = await response.json();
//   } catch {
//     /* empty or non-JSON body */
//   }

//   if (!response.ok) {
//     const metaError = data?.error || {};

//     throw httpError(
//       metaError.error_data?.details ||
//         metaError.error_user_msg ||
//         metaError.message ||
//         `Meta request failed (${response.status})`,
//       502,
//       {
//         metaCode: String(metaError.code ?? response.status),
//         metaSubcode: metaError.error_subcode ? String(metaError.error_subcode) : "",
//         // 5xx and rate limits are worth retrying later; the rest are permanent
//         retryable: response.status >= 500 || [4, 80007, 130429, 131056].includes(metaError.code)
//       }
//     );
//   }

//   return data;
// }

// /* ------------------------------ helpers ------------------------------ */

// // Meta wants digits only, no "+"
// export function toWaId(phone) {
//   return String(phone).replace(/\D/g, "");
// }

// // Template parameters cannot contain new lines, tabs or more than 4 spaces in a row
// export function sanitizeParam(value) {
//   return String(value ?? "")
//     .replace(/[\r\n\t]+/g, " ")
//     .replace(/ {5,}/g, "    ")
//     .trim();
// }

// export function buildTemplateComponents({ variables = [], headerMediaUrl, headerType }) {
//   const components = [];

//   if (headerMediaUrl && (headerType === "IMAGE" || headerType === "VIDEO")) {
//     const kind = headerType.toLowerCase(); // "image" | "video"

//     components.push({
//       type: "header",
//       parameters: [{ type: kind, [kind]: { link: headerMediaUrl } }]
//     });
//   }

//   if (variables.length > 0) {
//     components.push({
//       type: "body",
//       parameters: variables.map((value) => ({
//         type: "text",
//         text: sanitizeParam(value)
//       }))
//     });
//   }

//   return components;
// }

// /* ------------------------------ Meta API calls ------------------------------ */

// export async function sendTemplateMessage({
//   phoneNumberId,
//   to,
//   name,
//   language,
//   variables,
//   headerMediaUrl,
//   headerType
// }) {
//   assertSendConfigured(phoneNumberId);

//   const components = buildTemplateComponents({ variables, headerMediaUrl, headerType });

//   return graph(`/${phoneNumberId}/messages`, {
//     method: "POST",
//     body: {
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to: toWaId(to),
//       type: "template",
//       template: {
//         name,
//         language: { code: language },
//         ...(components.length > 0 ? { components } : {})
//       }
//     }
//   });
// }

// // Only works while the customer's 24-hour window is open
// export async function sendTextMessage({ phoneNumberId, to, text, replyToWamid }) {
//   assertSendConfigured(phoneNumberId);

//   return graph(`/${phoneNumberId}/messages`, {
//     method: "POST",
//     body: {
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to: toWaId(to),
//       type: "text",
//       text: { preview_url: false, body: text },
//       ...(replyToWamid ? { context: { message_id: replyToWamid } } : {})
//     }
//   });
// }

// // Shows the blue ticks to the customer
// export async function markAsRead({ phoneNumberId, wamid }) {
//   assertSendConfigured(phoneNumberId);

//   return graph(`/${phoneNumberId}/messages`, {
//     method: "POST",
//     body: { messaging_product: "whatsapp", status: "read", message_id: wamid }
//   });
// }

// // Used by the "WhatsApp connection" check
// export async function getPhoneNumberInfo(phoneNumberId) {
//   assertSendConfigured(phoneNumberId);

//   return graph(`/${phoneNumberId}`, {
//     query: { fields: "verified_name,display_phone_number,quality_rating" }
//   });
// }



import { env } from "../config/env.js";

function httpError(message, statusCode, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

// Resolve the phone number ID for the organization.
export function resolvePhoneNumberId(organization) {
  return (
    organization?.whatsapp?.phoneNumberId ||
    env.WHATSAPP_PHONE_NUMBER_ID ||
    ""
  );
}

export function assertSendConfigured(phoneNumberId) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !phoneNumberId) {
    throw httpError(
      "WhatsApp is not connected. Configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.",
      409
    );
  }
}

// Generic Meta Graph API request helper.
async function graph(path, { method = "GET", query, body } = {}) {
  if (!env.WHATSAPP_ACCESS_TOKEN) {
    throw httpError("WHATSAPP_ACCESS_TOKEN is missing.", 409);
  }

  const version = env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const url = new URL(
    `https://graph.facebook.com/${version}${path}`
  );

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw httpError(`Could not reach Meta: ${error.message}`, 502, {
      metaCode: "NETWORK",
      retryable: true,
    });
  }

  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const metaError = data?.error || {};

    throw httpError(
      metaError.error_data?.details ||
        metaError.error_user_msg ||
        metaError.message ||
        `Meta request failed (${response.status})`,
      502,
      {
        metaCode: String(metaError.code ?? response.status),
        metaSubcode: metaError.error_subcode
          ? String(metaError.error_subcode)
          : "",
        retryable:
          response.status >= 500 ||
          [4, 80007, 130429, 131056].includes(metaError.code),
      }
    );
  }

  return data;
}

// Convert a phone number to digits only.
export function toWaId(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

export function sanitizeParam(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {5,}/g, "    ")
    .trim();
}

export function buildTemplateComponents({
  variables = [],
  headerMediaUrl,
  headerType,
}) {
  const components = [];

  if (
    headerMediaUrl &&
    ["IMAGE", "VIDEO"].includes(String(headerType).toUpperCase())
  ) {
    const kind = String(headerType).toLowerCase();

    components.push({
      type: "header",
      parameters: [
        {
          type: kind,
          [kind]: { link: headerMediaUrl },
        },
      ],
    });
  }

  if (variables.length > 0) {
    components.push({
      type: "body",
      parameters: variables.map((value) => ({
        type: "text",
        text: sanitizeParam(value),
      })),
    });
  }

  return components;
}

// Send an approved WhatsApp template.
export async function sendTemplateMessage({
  phoneNumberId,
  to,
  name,
  language = "en_US",
  variables = [],
  headerMediaUrl,
  headerType,
}) {
  assertSendConfigured(phoneNumberId);

  if (!to || !name) {
    throw httpError("Recipient phone and template name are required.", 400);
  }

  const components = buildTemplateComponents({
    variables,
    headerMediaUrl,
    headerType,
  });

  return graph(`/${phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toWaId(to),
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    },
  });
}

// Send a text message. The recipient's 24-hour customer-service window
// must be open for ordinary free-form messages.
export async function sendTextMessage({
  phoneNumberId,
  to,
  text,
  replyToWamid,
}) {
  assertSendConfigured(phoneNumberId);

  if (!to || !String(text ?? "").trim()) {
    throw httpError("Recipient phone and message text are required.", 400);
  }

  return graph(`/${phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toWaId(to),
      type: "text",
      text: {
        preview_url: false,
        body: String(text),
      },
      ...(replyToWamid
        ? { context: { message_id: replyToWamid } }
        : {}),
    },
  });
}

// Mark an incoming WhatsApp message as read.
export async function markAsRead({ phoneNumberId, wamid }) {
  assertSendConfigured(phoneNumberId);

  if (!wamid) {
    throw httpError("WhatsApp message ID is required.", 400);
  }

  return graph(`/${phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      status: "read",
      message_id: wamid,
    },
  });
}

// Get phone-number information from Meta.
export async function getPhoneNumberInfo(phoneNumberId) {
  assertSendConfigured(phoneNumberId);

  return graph(`/${phoneNumberId}`, {
    query: {
      fields: "verified_name,display_phone_number,quality_rating",
    },
  });
}
