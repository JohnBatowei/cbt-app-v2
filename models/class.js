// const mongoose = require("mongoose");

// const ClassSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       unique: true,
//       required: true,
//     },
//     timer: {
//       type: String,
//       required: true,
//     },
//     subject: [{ type: mongoose.Schema.Types.ObjectId, ref: "subject" }],
//     profileCodeInitials: { type: String },
//   },
//   { timestamps: true }
// );

// const classModel = mongoose.model("class", ClassSchema);
// module.exports = classModel;
const mongoose = require("mongoose");

const ClassSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
    },
    isBatched: {
      type: Boolean,
      default: false,
    },
    timer: {
      type: String,
      required: function () {
        return !this.isBatched;
      },
    },
    subject: [{ type: mongoose.Schema.Types.ObjectId, ref: "subject" }],
    
    subjectTimers: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "subject" },
        timer: { type: String }, // in minutes
      },
    ],

    profileCodeInitials: { type: String },

    admin : { type: mongoose.Schema.Types.ObjectId, ref: "admine" },
  },
  { timestamps: true }
);

const classModel = mongoose.model("class", ClassSchema);
module.exports = classModel;
