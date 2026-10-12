
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";

// import User from "../../models/User.js";
// import Organization from "../../models/Organization.js";

// function generateToken(user) {
//   return jwt.sign(
//     {
//       id: user._id.toString(),
//       organizationId: user.organizationId.toString(),
//       role: user.role
//     },
//     process.env.JWT_ACCESS_SECRET,
//     {
//       expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m"
//     }
//   );
// }

// export async function registerUser(data) {
//   const email = data.email.trim().toLowerCase();

//   const existingUser = await User.findOne({ email });

//   if (existingUser) {
//     const error = new Error("Email is already registered");
//     error.statusCode = 409;
//     throw error;
//   }

//   const organization = await Organization.create({
//     name: data.organizationName,
//     email
//   });

//   try {
//     const hashedPassword = await bcrypt.hash(data.password, 12);

//     const user = await User.create({
//       name: data.name,
//       email,
//       password: hashedPassword,
//       organizationId: organization._id,
//       role: "owner"
//     });

//     return {
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         organizationId: user.organizationId
//       },
//       organization: {
//         id: organization._id,
//         name: organization.name
//       },
//       token: generateToken(user)
//     };
//   } catch (error) {
//     await Organization.findByIdAndDelete(organization._id);
//     throw error;
//   }
// }

// export async function loginUser(data) {
//   const email = data.email.trim().toLowerCase();

//   const user = await User.findOne({ email })
//     .select("+password");

//   if (!user) {
//     const error = new Error("Invalid email or password");
//     error.statusCode = 401;
//     throw error;
//   }

//   const passwordMatches = await bcrypt.compare(
//     data.password,
//     user.password
//   );

//   if (!passwordMatches) {
//     const error = new Error("Invalid email or password");
//     error.statusCode = 401;
//     throw error;
//   }

//   if (!user.isActive) {
//     const error = new Error("Your account is inactive");
//     error.statusCode = 403;
//     throw error;
//   }

//   const organization = await Organization.findById(
//     user.organizationId
//   );

//   if (!organization || organization.status !== "active") {
//     const error = new Error("Organization is unavailable");
//     error.statusCode = 403;
//     throw error;
//   }

//   user.lastLoginAt = new Date();
//   await user.save();

//   return {
//     user: {
//       id: user._id,
//       name: user.name,
//       email: user.email,
//       role: user.role,
//       organizationId: user.organizationId
//     },
//     token: generateToken(user)
//   };
// }



import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../../models/User.js";
import Organization from "../../models/Organization.js";
import RefreshToken from "../../models/RefreshToken.js";
import { env } from "../../config/env.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

function toUserDto(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId
  };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * DAY_MS);
}

async function issueRefreshToken(user, meta = {}) {
  const token = crypto.randomBytes(48).toString("hex");

  await RefreshToken.create({
    userId: user._id,
    organizationId: user.organizationId,
    tokenHash: hashToken(token),
    expiresAt: newExpiry(),
    userAgent: (meta.userAgent || "").slice(0, 300),
    ip: meta.ip || ""
  });

  return token;
}

export async function registerUser(data, meta = {}) {
  const email = data.email.trim().toLowerCase();

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw httpError("Email is already registered", 409);
  }

  const organization = await Organization.create({
    name: data.organizationName,
    email
  });

  let user;

  try {
    const hashedPassword = await bcrypt.hash(data.password, 12);

    user = await User.create({
      name: data.name,
      email,
      password: hashedPassword,
      organizationId: organization._id,
      role: "owner"
    });
  } catch (error) {
    await Organization.findByIdAndDelete(organization._id);
    throw error;
  }

  const refreshToken = await issueRefreshToken(user, meta);

  return {
    user: toUserDto(user),
    organization: {
      id: organization._id,
      name: organization.name
    },
    token: generateToken(user),
    refreshToken
  };
}

export async function loginUser(data, meta = {}) {
  const email = data.email.trim().toLowerCase();

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw httpError("Invalid email or password", 401);
  }

  const passwordMatches = await bcrypt.compare(data.password, user.password);

  if (!passwordMatches) {
    throw httpError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw httpError("Your account is inactive", 403);
  }

  const organization = await Organization.findById(user.organizationId);

  if (!organization || organization.status !== "active") {
    throw httpError("Organization is unavailable", 403);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const refreshToken = await issueRefreshToken(user, meta);

  return {
    user: toUserDto(user),
    token: generateToken(user),
    refreshToken
  };
}

/**
 * Exchanges a valid refresh token for a new access token.
 * The refresh token itself stays the same, but its expiry moves forward
 * (sliding session), so an active user is never logged out.
 */
export async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw httpError("Refresh token required", 401);
  }

  const record = await RefreshToken.findOne({
    tokenHash: hashToken(refreshToken)
  });

  if (!record || record.revokedAt || record.expiresAt <= new Date()) {
    throw httpError("Session expired. Please log in again.", 401);
  }

  const user = await User.findById(record.userId);

  if (!user || !user.isActive) {
    throw httpError("User is unavailable or inactive", 401);
  }

  const organization = await Organization.findById(user.organizationId);

  if (!organization || organization.status !== "active") {
    throw httpError("Organization is unavailable", 403);
  }

  await RefreshToken.updateOne(
    { _id: record._id },
    { $set: { expiresAt: newExpiry(), lastUsedAt: new Date() } }
  );

  return {
    user: toUserDto(user),
    token: generateToken(user),
    refreshToken
  };
}

// Always succeeds, so logging out twice or with a stale token is harmless
export async function logoutSession(refreshToken) {
  if (!refreshToken) return;

  await RefreshToken.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}