import { sendMessageSchema } from "./whatsapp.schema.js";
import { getConnectionStatus, sendTestMessage } from "./whatsapp.service.js";

export async function getStatus(req, res, next) {
  try {
    const data = await getConnectionStatus(req.organization);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const input = sendMessageSchema.parse(req.body);
    const message = await sendTestMessage(req.organization, req.user._id, input);

    res.status(201).json({
      success: true,
      message: "Message accepted by WhatsApp",
      data: { message }
    });
  } catch (error) {
    next(error);
  }
}
