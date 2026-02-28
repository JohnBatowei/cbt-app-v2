const mongoose = require('mongoose');

const questionBreakdownSchema = new mongoose.Schema({
    questionId:     { type: mongoose.Schema.Types.ObjectId },
    questionText:   { type: String },
    options: {
      A: String,
      B: String,
      C: String,
      D: String,
    },
    selectedOption: { type: String },
    correctAnswer:  { type: String },
    isCorrect:      { type: Boolean },
  }, { _id: false });            // no extra _id for sub‑docs
  
const ResultSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    className: {
        type: String,
        required: true
    },
    candidateName: {
        type: String,
        required: true
    },
    profileCode: {
        type: String,
        required: true
    },
    totalScore: {
        type: Number,
        required: true
    },
    subjects: [
        {
            subjectId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Subject',
                required: true
            },
            subjectName: {
                type: String,
                required: true
            },
            score: {
                type: Number,
                required: true
            },
            questions:   [questionBreakdownSchema] 
        }
    ],
    count: {type: Number, default: 0},
    scratchCard: {type: String},
    date: {
        type: Date,
        default: Date.now
    },
    admin : { type: mongoose.Schema.Types.ObjectId, ref: "admine" }
});

module.exports.Result = mongoose.model('Result', ResultSchema);
