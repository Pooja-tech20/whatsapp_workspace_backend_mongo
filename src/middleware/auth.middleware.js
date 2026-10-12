
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";

export async function protect(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required"
      });
    }

    const token = authorization.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    const user = await User.findById(decoded.id)
      .select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User is unavailable or inactive"
      });
    }

    const organization = await Organization.findById(
      user.organizationId
    );

    if (!organization || organization.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Organization is unavailable"
      });
    }

    req.user = user;
    req.organization = organization;

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    next(error);
  }
}
