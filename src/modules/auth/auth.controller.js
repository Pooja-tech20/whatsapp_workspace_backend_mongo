
// import { z } from "zod";

// import {
//   registerUser,
//   loginUser
// } from "./auth.service.js";

// const registerSchema = z.object({
//   name: z.string().trim().min(2).max(100),
//   organizationName: z.string().trim().min(2).max(150),
//   email: z.string().trim().email().max(254),
//   password: z.string().min(8).max(72)
// });

// const loginSchema = z.object({
//   email: z.string().trim().email(),
//   password: z.string().min(1)
// });

// export async function register(req, res, next) {
//   try {
//     const data = registerSchema.parse(req.body);
//     const result = await registerUser(data);

//     res.status(201).json({
//       success: true,
//       message: "Organization registered successfully",
//       data: result
//     });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function login(req, res, next) {
//   try {
//     const data = loginSchema.parse(req.body);
//     const result = await loginUser(data);

//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       data: result
//     });
//   } catch (error) {
//     next(error);
//   }
// }

// export async function getMe(req, res) {
//   res.status(200).json({
//     success: true,
//     data: {
//       user: req.user
//     }
//   });
// }


import { z } from "zod";

import {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession
} from "./auth.service.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  organizationName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().optional()
});

function requestMeta(req) {
  return {
    userAgent: req.get("user-agent") || "",
    ip: req.ip || ""
  };
}

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerUser(data, requestMeta(req));

    res.status(201).json({
      success: true,
      message: "Organization registered successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginUser(data, requestMeta(req));

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body ?? {});
    const result = await refreshSession(refreshToken);

    res.status(200).json({
      success: true,
      message: "Session refreshed",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body ?? {});
    await logoutSession(refreshToken);

    res.status(200).json({ success: true, message: "Logged out" });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res) {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
}