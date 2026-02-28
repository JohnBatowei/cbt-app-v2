const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "class" },
    className: { type: String },
    timer: { type: String },
    candidateName: { type: String },
    image: { type: String },
    profileCode: { type: String , unique: true },
    subject: [{ type: mongoose.Schema.Types.ObjectId, ref: "subject" }],
    phone: {type: String},
    endExam: { type: Boolean, default: false },
    admin : { type: mongoose.Schema.Types.ObjectId, ref: "admine" },
  },
  { timestamps: true }
);


const studentModel = mongoose.model("student", studentSchema);
module.exports = studentModel