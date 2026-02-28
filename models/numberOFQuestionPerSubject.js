const mongoose = require('mongoose');

const numberOfQuestionPerSubjectSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'admine',        
      required: true,
      unique: true,        
      index: true,
    },
    numberOfQuestionPerSubject: {
      type: Number,
      default: 50,
      min: 1,
    },
  },
  { timestamps: true }
);

const numberOfQuestionPerSubjectModel = mongoose.model(
  'numberOfQuestionPerSubject',
  numberOfQuestionPerSubjectSchema
);

module.exports = numberOfQuestionPerSubjectModel;
