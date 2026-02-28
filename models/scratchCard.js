const mongoose = require("mongoose");

const scratch = mongoose.Schema(
  {
    card: { type: String, required: true, unique: true },
    admin : { type: mongoose.Schema.Types.ObjectId, ref: "admine" }
  },
  { timestamps: true }
);

const scratchCard = mongoose.model("scratchcard", scratch);
module.exports = scratchCard;
