// import { Readable } from "stream";

// import {
//   listQuerySchema,
//   messagesQuerySchema,
//   replySchema,
//   templateSendSchema,
//   startConversationSchema,
//   updateConversationSchema,
//   readSchema
// } from "./inbox.schema.js";
// import {
//   getSummary,
//   listConversations,
//   getConversation,
//   updateConversation,
//   listMessages,
//   replyToConversation,
//   sendTemplateToConversation,
//   startConversation,
//   markConversationRead,
//   openMessageMedia
// } from "./inbox.service.js";

// export async function summary(req, res, next) {
//   try {
//     const data = await getSummary(req.organization._id);
//     res.status(200).json({ success: true, data });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function getConversations(req, res, next) {
//   try {
//     const query = listQuerySchema.parse(req.query);
//     const data = await listConversations(req.organization, req.user._id, query);
//     res.status(200).json({ success: true, data });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function newConversation(req, res, next) {
//   try {
//     const input = startConversationSchema.parse(req.body);
//     const data = await startConversation(req.organization, req.user._id, input);

//     res.status(201).json({ success: true, message: "Message accepted by WhatsApp", data });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function getOneConversation(req, res, next) {
//   try {
//     const conversation = await getConversation(req.organization._id, req.params.id);
//     res.status(200).json({ success: true, data: { conversation } });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function editConversation(req, res, next) {
//   try {
//     const input = updateConversationSchema.parse(req.body);
//     const conversation = await updateConversation(req.organization._id, req.params.id, input);

//     res.status(200).json({ success: true, message: "Conversation updated", data: { conversation } });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function getMessages(req, res, next) {
//   try {
//     const query = messagesQuerySchema.parse(req.query);
//     const data = await listMessages(req.organization._id, req.params.id, query);

//     res.status(200).json({ success: true, data });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function reply(req, res, next) {
//   try {
//     const input = replySchema.parse(req.body);
//     const message = await replyToConversation(req.organization, req.user._id, req.params.id, input);

//     res.status(201).json({ success: true, message: "Message accepted by WhatsApp", data: { message } });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function sendTemplate(req, res, next) {
//   try {
//     const input = templateSendSchema.parse(req.body);
//     const message = await sendTemplateToConversation(req.organization, req.user._id, req.params.id, input);

//     res.status(201).json({ success: true, message: "Message accepted by WhatsApp", data: { message } });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function markRead(req, res, next) {
//   try {
//     // Express 5: req.body is undefined when no body was sent
//     const input = readSchema.parse(req.body ?? {});
//     const data = await markConversationRead(req.organization, req.params.id, input);

//     res.status(200).json({ success: true, data });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function getMedia(req, res, next) {
//   try {
//     const file = await openMessageMedia(req.organization._id, req.params.id);

//     res.setHeader("Content-Type", file.contentType);
//     res.setHeader("Cache-Control", "private, max-age=3600");
//     if (file.fileName) {
//       res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, "")}"`);
//     }

//     const stream = Readable.fromWeb(file.body);
//     stream.on("error", next);
//     stream.pipe(res);
//   } catch (error) {
//     next(error);
//   }
// }



import { Readable } from "stream";

import {
  listQuerySchema,
  messagesQuerySchema,
  replySchema,
  templateSendSchema,
  startConversationSchema,
  updateConversationSchema,
  readSchema
} from "./inbox.schema.js";
import {
  getSummary,
  listConversations,
  getConversation,
  updateConversation,
  listMessages,
  replyToConversation,
  sendTemplateToConversation,
  startConversation,
  markConversationRead,
  openMessageMedia
} from "./inbox.service.js";

export async function summary(req, res, next) {
  try {
    const data = await getSummary(req.organization._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getConversations(req, res, next) {
  try {
    const query = listQuerySchema.parse(req.query);
    const data = await listConversations(req.organization, req.user._id, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function newConversation(req, res, next) {
  try {
    const input = startConversationSchema.parse(req.body);
    const data = await startConversation(req.organization, req.user._id, input);

    res.status(201).json({ success: true, message: "Message accepted by WhatsApp", data });
  } catch (error) {
    next(error);
  }
}

export async function getOneConversation(req, res, next) {
  try {
    const conversation = await getConversation(req.organization._id, req.params.id);
    res.status(200).json({ success: true, data: { conversation } });
  } catch (error) {
    next(error);
  }
}

export async function editConversation(req, res, next) {
  try {
    const input = updateConversationSchema.parse(req.body);
    const conversation = await updateConversation(req.organization._id, req.params.id, input);

    res.status(200).json({ success: true, message: "Conversation updated", data: { conversation } });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const query = messagesQuerySchema.parse(req.query);
    const data = await listMessages(req.organization._id, req.params.id, query);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function reply(req, res, next) {
  try {
    const input = replySchema.parse(req.body);
    const message = await replyToConversation(req.organization, req.user._id, req.params.id, input);

    res.status(201).json({ success: true, message: "Message accepted by WhatsApp", data: { message } });
  } catch (error) {
    next(error);
  }
}

export async function sendTemplate(req, res, next) {
  try {
    const input = templateSendSchema.parse(req.body);
    const message = await sendTemplateToConversation(req.organization, req.user._id, req.params.id, input);

    res.status(201).json({ success: true, message: "Message accepted by WhatsApp", data: { message } });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req, res, next) {
  try {
    // Express 5: req.body is undefined when no body was sent
    const input = readSchema.parse(req.body ?? {});
    const data = await markConversationRead(req.organization, req.params.id, input);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getMedia(req, res, next) {
  try {
    const file = await openMessageMedia(req.organization._id, req.params.id);

    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (file.fileName) {
      // Strip quotes/newlines, and keep the plain filename ASCII-only so setHeader can't throw.
      const clean = String(file.fileName).replace(/["\r\n]/g, "");
      const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`
      );
    }

    const stream = Readable.fromWeb(file.body);
    stream.on("error", (err) => {
      // Headers may already be sent; end the response instead of calling next().
      if (res.headersSent) res.destroy(err);
      else next(err);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}