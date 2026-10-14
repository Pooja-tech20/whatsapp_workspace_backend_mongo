
// import mongoose from "mongoose";

// const organizationSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//       trim: true
//     },

//     email: {
//       type: String,
//       required: true,
//       lowercase: true,
//       trim: true
//     },

//     website: {
//       type: String,
//       default: ""
//     },

//     status: {
//       type: String,
//       enum: ["active", "suspended"],
//       default: "active"
//     }
//   },
//   { timestamps: true }
// );

// organizationSchema.index({ email: 1 });

// export default mongoose.model(
//   "Organization",
//   organizationSchema
// );


import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    website: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active"
    },

    // WhatsApp number this organization sends from. When empty, the value
    // from WHATSAPP_PHONE_NUMBER_ID in .env is used.
    whatsapp: {
      phoneNumberId: { type: String, trim: true, default: "" }
    }
  },
  { timestamps: true }
);

organizationSchema.index({ email: 1 });
organizationSchema.index({ "whatsapp.phoneNumberId": 1 });

export default mongoose.model("Organization", organizationSchema);