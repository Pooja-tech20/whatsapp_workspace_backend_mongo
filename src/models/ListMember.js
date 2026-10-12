import mongoose from "mongoose";

// One document = one contact inside one list
const listMemberSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    listId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: true
    },

    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

listMemberSchema.index({ listId: 1, contactId: 1 }, { unique: true });

export default mongoose.model("ListMember", listMemberSchema);