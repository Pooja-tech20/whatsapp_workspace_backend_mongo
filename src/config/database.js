
// import mongoose from "mongoose";

// const connectDatabase = async () => {
//   try {
//     const connection = await mongoose.connect(
//       process.env.MONGODB_URI
//     );

//     console.log(
//       `MongoDB connected: ${connection.connection.host}`
//     );
//   } catch (error) {
//     console.error("MongoDB connection failed:", error.message);
//     process.exit(1);
//   }
// };

// export default connectDatabase;
import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);

let listenersAttached = false;

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });
  mongoose.connection.on("error", (error) => {
    console.error("MongoDB error:", error.message);
  });
}

function explainConnectionError(error) {
  const message = error.message || "";

  if (error.name === "MongooseServerSelectionError") {
    return "Cannot reach MongoDB. Local: is mongod running on this port? Atlas: is your IP allowed under Network Access, and is the cluster host correct?";
  }
  if (/auth/i.test(message)) {
    return "Authentication failed. Check the username/password in MONGODB_URI (URL-encode special characters like @ : / # in the password) and that the user has access to this database.";
  }
  if (/ENOTFOUND|querySrv/i.test(message)) {
    return "DNS lookup failed. Check the cluster hostname in MONGODB_URI and your internet connection.";
  }
  return null;
}

export async function connectDatabase() {
  attachConnectionListeners();

  try {
    const connection = await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME || undefined,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 20
    });

    console.log(
      `MongoDB connected: host=${connection.connection.host} db=${connection.connection.name}`
    );

    return connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);

    const hint = explainConnectionError(error);
    if (hint) console.error(`Hint: ${hint}`);

    throw error;
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

const READY_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};

export function getDatabaseStatus() {
  const state = mongoose.connection.readyState;

  return {
    connected: state === 1,
    state: READY_STATES[state] || "unknown",
    name: mongoose.connection.name || null
  };
}

export default connectDatabase;