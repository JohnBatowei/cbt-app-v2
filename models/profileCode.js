const mongoose = require("mongoose");

const profileCode = mongoose.Schema(
  {
    profileCode: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

const profileCodeModel = mongoose.model("profileCode", profileCode);
module.exports = profileCodeModel;
