import mongoose from "mongoose";

const listSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    }
  },
  { timestamps: true }
);

// List names are unique per organization, ignoring upper/lower case
listSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export default mongoose.model("List", listSchema);