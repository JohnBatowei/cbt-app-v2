const mongoose = require("mongoose");

const ExamInstance = new mongoose.Schema(
  {
    studentId : { type: String },
    classId: { type: String },
    className: { type: String },
    timer: { type: String },
    candidateName: { type: String },
    profileCode: { type: String },
    completedSubjectIds: [{ type: String }],
    completedSubjectTimes: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
        completedAt: Date
      }
    ],
    
    isBatched: {type : Boolean, default: false},
    isCompleted: { type: Boolean, default: false },
    subject: [
      {
        _id: {type:String},
        name: {
            type: String
        },
        score: { type: Number, default: 0 },
        isCompleted: { type: Boolean, default: false },
        questions: [
            {
                subjectName: { type: String },
                subjectId: { type: String },
                question: { type: String },
                option_A: { type: String },
                option_B: { type: String },
                option_C: { type: String },
                option_D: { type: String },
                answer: { type: String },
                selectedOption: { type: String },
                image: { type: String },
                _id: {type:String},

                questionId:     { type: mongoose.Schema.Types.ObjectId },
                questionText:   { type: String },
                options: {
                  A: String,
                  B: String,
                  C: String,
                  D: String,
                },
                correctAnswer:  { type: String },
                isCorrect:      { type: Boolean }, 
          }
        ]
      }
    ],
    subjectTimers: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "subject" },
        timer: { type: String }, // in minutes
      },
    ],
    phone: { type: String },
    endExam: { type: String },
    image: { type: String }
  },
  { timestamps: true }
);

module.exports.ExamInstances = mongoose.model("ExamInstance", ExamInstance);
