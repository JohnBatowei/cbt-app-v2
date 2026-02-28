const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  subjectName: { type: String },
  subjectId: { type: String },
  question: { type: String },
  option_A: { type: String },
  option_B: { type: String },
  option_C: { type: String },
  option_D: { type: String },
  answer: { type: String },
  image: { type: String },
  admin : { type: mongoose.Schema.Types.ObjectId, ref: "admine" },
}, { timestamps: true });


const questionModel = mongoose.model("question", questionSchema);

module.exports = questionModel;
