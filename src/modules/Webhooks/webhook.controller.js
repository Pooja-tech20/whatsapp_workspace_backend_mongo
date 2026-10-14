import { logger } from "../../config/logger.js";
import {
  isValidVerifyToken,
  verifySignature,
  processWebhook
} from "./webhook.service.js";
// ../../utils/phone.js

// Meta calls this once when you press "Verify and save" in the dashboard
export function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && isValidVerifyToken(token)) {
    return res.status(200).type("text/plain").send(String(challenge ?? ""));
  }

  return res.status(403).json({ success: false, message: "Webhook verification failed" });
}

// Meta calls this for every delivery status and customer message
export function receiveWebhook(req, res) {
  if (!verifySignature(req.rawBody, req.get("x-hub-signature-256"))) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  // Answer immediately. Meta retries (and eventually disables) slow webhooks.
  res.sendStatus(200);

  setImmediate(() => {
    processWebhook(req.body).catch((error) =>
      logger.error({ err: error }, "Unhandled webhook error")
    );
  });
}