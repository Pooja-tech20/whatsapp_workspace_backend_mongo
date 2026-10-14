// import { env } from "../../config/env.js";
// import {
//   resolvePhoneNumberId,
//   getPhoneNumberInfo
// } from "../../services/whatsapp.service.js";
// import {
//   sendTemplateToPhone,
//   sendTextToPhone
// } from "../../services/messaging.service.js";

// // Powers the "WhatsApp connection" chip and the Home setup checklist
// export async function getConnectionStatus(organization) {
//   const phoneNumberId = resolvePhoneNumberId(organization);

//   const configured = {
//     accessToken: Boolean(env.WHATSAPP_ACCESS_TOKEN),
//     businessAccountId: Boolean(env.WHATSAPP_BUSINESS_ACCOUNT_ID),
//     phoneNumberId: Boolean(phoneNumberId),
//     appId: Boolean(env.WHATSAPP_APP_ID),
//     appSecret: Boolean(env.WHATSAPP_APP_SECRET),
//     webhookVerifyToken: Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
//     publicBaseUrl: Boolean(env.PUBLIC_BASE_URL)
//   };

//   const missing = Object.entries(configured)
//     .filter(([, ok]) => !ok)
//     .map(([key]) => key);

//   let connected = false;
//   let phone = null;
//   let error = "";

//   if (configured.accessToken && configured.phoneNumberId) {
//     try {
//       const info = await getPhoneNumberInfo(phoneNumberId);

//       connected = true;
//       phone = {
//         id: info.id,
//         verifiedName: info.verified_name || "",
//         displayPhoneNumber: info.display_phone_number || "",
//         qualityRating: info.quality_rating || ""
//       };
//     } catch (err) {
//       error = err.message;
//     }
//   }

//   return {
//     connected,
//     configured,
//     missing,
//     phone,
//     error,
//     webhookUrl: env.PUBLIC_BASE_URL
//       ? `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/v1/webhooks/whatsapp`
//       : null
//   };
// }

// export async function sendTestMessage(organization, userId, input) {
//   if (input.type === "text") {
//     return sendTextToPhone({
//       organization,
//       userId,
//       phone: input.to,
//       text: input.text
//     });
//   }

//   return sendTemplateToPhone({
//     organization,
//     userId,
//     phone: input.to,
//     templateId: input.templateId,
//     variables: input.variables,
//     headerMediaUrl: input.headerMediaUrl
//   });
// }




import { env } from "../../config/env.js";

import {
  resolvePhoneNumberId,
  getPhoneNumberInfo,
} from "../../services/whatsapp.service.js";

import {
  sendTemplateToPhone,
  sendTextToPhone,
} from "../../services/messaging.service.js";

// Get WhatsApp connection status for the organization.
export async function getConnectionStatus(organization) {
  const phoneNumberId = resolvePhoneNumberId(organization);

  const configured = {
    accessToken: Boolean(env.WHATSAPP_ACCESS_TOKEN),
    businessAccountId: Boolean(env.WHATSAPP_BUSINESS_ACCOUNT_ID),
    phoneNumberId: Boolean(phoneNumberId),
    appId: Boolean(env.WHATSAPP_APP_ID),
    appSecret: Boolean(env.WHATSAPP_APP_SECRET),
    webhookVerifyToken: Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    publicBaseUrl: Boolean(env.PUBLIC_BASE_URL),
  };

  const missing = Object.entries(configured)
    .filter(([, isConfigured]) => !isConfigured)
    .map(([key]) => key);

  let connected = false;
  let phone = null;
  let error = "";

  if (configured.accessToken && configured.phoneNumberId) {
    try {
      const info = await getPhoneNumberInfo(phoneNumberId);

      connected = true;

      phone = {
        id: info.id,
        verifiedName: info.verified_name || "",
        displayPhoneNumber: info.display_phone_number || "",
        qualityRating: info.quality_rating || "",
      };
    } catch (err) {
      error = err.message || "Unable to connect to WhatsApp.";
    }
  }

  const baseUrl = env.PUBLIC_BASE_URL
    ? env.PUBLIC_BASE_URL.replace(/\/$/, "")
    : "";

  return {
    connected,
    configured,
    missing,
    phone,
    error,
    webhookUrl: baseUrl
      ? `${baseUrl}/api/v1/webhooks/whatsapp`
      : null,
  };
}

// Send a test message from the dashboard.
export async function sendTestMessage(organization, userId, input) {
  if (input.type === "text") {
    return sendTextToPhone({
      organization,
      userId,
      phone: input.to,
      text: input.text,
    });
  }

  if (input.type === "template") {
    return sendTemplateToPhone({
      organization,
      userId,
      phone: input.to,
      templateId: input.templateId,
      variables: input.variables || [],
      headerMediaUrl: input.headerMediaUrl,
    });
  }

  const error = new Error(
    "Unsupported message type. Use text or template."
  );
  error.statusCode = 400;
  throw error;
}
