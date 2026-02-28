const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      // unique: true,
    },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "question" }],
    admin : { type: mongoose.Schema.Types.ObjectId, ref: "admine" },
  },
  { timestamps: true }
);

const subjectModel = mongoose.model("subject", subjectSchema);

module.exports = subjectModel;
