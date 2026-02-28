const mongoose = require('mongoose');
const asyncHandler = require("express-async-handler");
const studentModel = require("../models/student");
const { Result } = require("../models/result");
const { ExamInstances } = require("../models/examInstances");

// Fetch student details including subjects and questions
module.exports.getStudentDetails = asyncHandler(async (req, res) => {
  try {
    const studentId = req.student; // The authenticated student's ID

    if (!studentId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: No student ID provided" });
    }

    // Find the student by ID and populate their subjects and related questions
    const student = await studentModel.findById(studentId).populate({
      path: "subject",
      populate: {
        path: "questions",
      },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Respond with the found student details
    res.status(200).json({ data: student });
  } catch (error) {
    // console.error("Error fetching student details:", error);
   return res.status(500).json({ error: "Server error" });
  }
});

module.exports.updateExamInstance = asyncHandler(async (req, res) => {
  try {
    const studentId = req.student.toString();
    const {
      classId,
      className,
      candidateName,
      profileCode,
      subjects,
      timer,
      completedSubjectId
    } = req.body;

    // console.log(`Updating exam for: ${candidateName}, Timer sent: ${timer}`);

    // Find the existing exam instance for the student by profileCode
    let examInstance = await ExamInstances.findOne({ profileCode });

    if (!examInstance) {
      return res.status(404).json({ message: 'Exam instance not found' });
    }

    // ✅ Update timer if lower
    if (timer && examInstance.timer) {
      examInstance.timer = Math.min(Number(timer), Number(examInstance.timer));
    }

    // ✅ Create a Map for faster subject lookup
    const subjectMap = new Map(
      examInstance.subject.map(sub => [sub._id.toString(), sub])
    );

    // ✅ Update answers with full breakdown
    subjects.forEach(subjectToUpdate => {
      const instanceSubject = subjectMap.get(subjectToUpdate.subjectId);
      if (instanceSubject) {
        const questionMap = new Map(
          instanceSubject.questions.map(q => [q._id.toString(), q])
        );

        subjectToUpdate.questions.forEach(questionToUpdate => {
          const instanceQuestion = questionMap.get(questionToUpdate.questionId);
          if (instanceQuestion) {
            // ✅ Always update selectedOption
            instanceQuestion.selectedOption = questionToUpdate.selectedOption || instanceQuestion.selectedOption;

            // ✅ Update for unbatched
            if (!examInstance.isBatched) {
              if (questionToUpdate.questionText) instanceQuestion.questionText = questionToUpdate.questionText;
              if (questionToUpdate.options) instanceQuestion.options = questionToUpdate.options;
              if (questionToUpdate.correctAnswer) instanceQuestion.correctAnswer = questionToUpdate.correctAnswer;
              if (typeof questionToUpdate.isCorrect === 'boolean') {
                instanceQuestion.isCorrect = questionToUpdate.isCorrect;
              }
            }

            // ✅ For batched exams, populate full question data
            if (examInstance.isBatched) {
              instanceQuestion.subjectName = questionToUpdate.subjectName || instanceQuestion.subjectName;
              instanceQuestion.subjectId = questionToUpdate.subjectId || instanceQuestion.subjectId;
              instanceQuestion.question = questionToUpdate.question || instanceQuestion.question;
              instanceQuestion.option_A = questionToUpdate.option_A || instanceQuestion.option_A;
              instanceQuestion.option_B = questionToUpdate.option_B || instanceQuestion.option_B;
              instanceQuestion.option_C = questionToUpdate.option_C || instanceQuestion.option_C;
              instanceQuestion.option_D = questionToUpdate.option_D || instanceQuestion.option_D;
              instanceQuestion.answer = questionToUpdate.answer || instanceQuestion.answer;
              instanceQuestion.image = questionToUpdate.image ?? instanceQuestion.image;
              if (typeof questionToUpdate.isCorrect === 'boolean') {
                instanceQuestion.isCorrect = questionToUpdate.isCorrect;
              }
            }
          }
        });
      }
    });

    // ✅ Handle batched subject completion
    if (examInstance.isBatched && completedSubjectId) {
      const completedIdStr = completedSubjectId.toString();
      if (!examInstance.completedSubjectIds.includes(completedIdStr)) {
        examInstance.completedSubjectIds.push(completedIdStr);
      }
    }

    // ✅ Save the updated exam instance
    await examInstance.save();

    return res.status(200).json({ message: 'Exam instance updated successfully' });

  } catch (error) {
    // console.error("Error updating exam instance:", error);
    return res.status(500).json({ message: 'Server error' });
  }
});


// controller/studentController.js
module.exports.markQuestion = asyncHandler(async (req, res) => {
  try {
    const studentId = req.student;
    const { classId, className, candidateName, profileCode, subjects } = req.body;

    const examInstance = await ExamInstances.findOne({ profileCode });
    if (!examInstance) {
      return res.status(404).json({ message: 'Exam instance not found' });
    }

    if(examInstance.isBatched){
      return handleIsBatched(req,res,examInstance,studentId)
    }
    
    let totalScore = 0;

    const markedSubjects = subjects.map(subject => {
      const totalQuestions = subject.questions.length;
      if (!totalQuestions) {
        return {
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          score: 0,
          questions: []
        };
      }

      let correctAnswers = 0;

      const answeredQuestions = subject.questions.map(q => {
        // keys already lowercase in your data; normalise just in case
        const selKey  = (q.selectedOption || '').toLowerCase(); // '' when skipped
        const corrKey = (q.correctAnswer  || '').toLowerCase();

        /* ---------- FIX START ---------- */
        const answered  = !!selKey;                     // Boolean – did the student pick anything?
        const isCorrect = answered && selKey === corrKey; // Boolean – always true/false
        /* ----------  FIX END  ---------- */

        if (isCorrect) correctAnswers++;

        // helper to map A/B/C/D to the option text
        const keyToText = key => {
          switch (key) {
            case 'a': return q.option_A;
            case 'b': return q.option_B;
            case 'c': return q.option_C;
            case 'd': return q.option_D;
            default:  return '';
          }
        };

        const doc = {
          questionId:     q.questionId || q._id,
          questionText:   q.question,
          options: {
            A: q.option_A,
            B: q.option_B,
            C: q.option_C,
            D: q.option_D
          },
          selectedOption: selKey,        // '' if skipped
          correctAnswer:  corrKey,
          isCorrect                       // <-- now guaranteed Boolean
        };

        if (!isCorrect) {
          doc.selectedText = keyToText(selKey);   // '' when skipped
          doc.correctText  = keyToText(corrKey);
        }

        return doc;
      });

      const subjectScore = (correctAnswers / totalQuestions) * 100;
      totalScore += subjectScore;

      return {
        subjectId:   subject.subjectId,
        subjectName: subject.subjectName,
        score:       subjectScore,
        questions:   answeredQuestions
      };
    });

    /* ----------------- save result ----------------- */
    const result = await Result.create({
      studentId,
      classId,
      className,
      candidateName,
      profileCode,
      totalScore,
      subjects: markedSubjects,
      admin: req.studentAdminID
    });

    await Promise.all([
      studentModel.findByIdAndDelete(result.studentId),
      ExamInstances.findOneAndDelete({ profileCode })
    ]);

    return res.status(200).json({
      message: 'Results marked successfully',
      totalScore,
      subjects: markedSubjects,
      markedResult: result._id
    });
  } catch (error) {
    // console.error('Error marking questions:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});


const handleIsBatched = asyncHandler(async (req, res, examInstance, studentId) => {
  const { classId, className, candidateName, profileCode, subjects } = req.body;

  if (!Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json({ message: "Subjects are missing or invalid." });
  }

  for (const subject of subjects) {
    const totalQuestions = subject.questions.length;
    if (!totalQuestions) continue;

    let correctAnswers = 0;

    const answeredQuestions = subject.questions.map(q => {
      // console.log('investigating :',q.question);
      // console.log('question  :',q);

      const selKey = (q.selectedOption || '').toLowerCase();
      const corrKey = (q.correctAnswer || '').toLowerCase();
      const answered  = !!selKey;  
      const isCorrect = answered && selKey === corrKey;

      if (isCorrect) correctAnswers++;


      const questionId = q.questionId || q._id;
      const questionText =   q.question;
     const  selectedOption = selKey;      // '' if skipped
     const correctAnswer =  corrKey;

    //  console.log('Objetcs : :',questionId,questionText,selectedOption,correctAnswer);
      const keyToText = key => {
        switch (key) {
          case 'a': return q.option_A;
          case 'b': return q.option_B;
          case 'c': return q.option_C;
          case 'd': return q.option_D;
          default:  return '';
        }
      };


      const doc = {
        questionId,
        questionText,
        options: {
          A: q.option_A,
          B: q.option_B,
          C: q.option_C,
          D: q.option_D,
        },
        selectedOption,       // '' if skipped
        correctAnswer,
        isCorrect                       // <-- now guaranteed Boolean
      };

      if (!isCorrect) {
        doc.selectedText = keyToText(selKey);   // '' when skipped
        doc.correctText  = keyToText(corrKey);
      }

      return doc;

    });



    const subjectScore = (correctAnswers / totalQuestions) * 100;

    // Find and update the corresponding subject in the examInstance
    const subjectIndex = examInstance.subject.findIndex(
      s => s.subjectId === subject.subjectId || (s._id && s._id.toString() === subject.subjectId.toString())
    );

    if (subjectIndex !== -1) {
      const targetSubject = examInstance.subject[subjectIndex];

      targetSubject.questions = answeredQuestions;
      targetSubject.score = subjectScore;
      targetSubject.subjectId = subject.subjectId;
      targetSubject.subjectName = subject.subjectName;
      targetSubject.isCompleted = true;

      // Update completed subjects tracker
      const subIdStr = subject.subjectId.toString();
      if (!examInstance.completedSubjectIds.includes(subIdStr)) {
        examInstance.completedSubjectIds.push(subIdStr);
      }
            // ✅✅✅ START: ADDING completedSubjectTimes LOGIC
            const alreadyLogged = examInstance.completedSubjectTimes.some(
              t => t.subjectId.toString() === subject.subjectId.toString()
            );
            if (!alreadyLogged) {
              examInstance.completedSubjectTimes.push({
                subjectId: new mongoose.Types.ObjectId(subject.subjectId),
                completedAt: new Date()
              });
            }
            // ✅✅✅ END
      
    }
  }

  // Check if all subjects are completed
  const allCompleted = examInstance.subject.every(s => s.isCompleted === true);
  examInstance.isCompleted = allCompleted;

 const allinstanceResult =  await examInstance.save();

  if (!allCompleted) {
    return res.status(200).json({
      message: "Subject(s) marked. Waiting for remaining subjects before finalizing.",
      completedSubjects: examInstance.completedSubjectIds.length,
      totalSubjects: examInstance.subject.length,
      updatedSubjects: examInstance.subject
    });
  }

  // console.log('allinstanceResult', allinstanceResult);

  // If all subjects are completed, finalize the result
  return await handleBatchedCompletion(
    allinstanceResult,
    res,
    studentId,
    classId,
    className,
    candidateName,
    profileCode
  );
});


const handleBatchedCompletion = async (
  allinstanceResult,
  res,
  studentId,
  classId,
  className,
  candidateName,
  profileCode
) => {
  try {
    // ✅ Ensure all subjects are completed before finalizing
    const allCompleted = allinstanceResult.subject.every(subj => subj.isCompleted === true);
    if (!allCompleted) {
      return res.status(400).json({
        message: 'Not all subjects are completed. Cannot finalize the result.',
        completedSubjects: allinstanceResult.subject.filter(s => s.isCompleted).length,
        totalSubjects: allinstanceResult.subject.length
      });
    }

    // ✅ Compute the total score
    const totalScore = allinstanceResult.subject.reduce((sum, subj) => {
      return sum + (typeof subj.score === 'number' ? subj.score : 0);
    }, 0);

    const formattedSubjects = allinstanceResult.subject.map(subj => {
      // Log all questions first
      subj.questions.forEach((q, i) => {
        console.log(`Question #${i}`, q);
      });
    
      // Then return the mapped subject object
      return {
        subjectId: subj.subjectId || subj._id,
        subjectName: subj.subjectName || subj.name,
        score: subj.score,


        questions: subj.questions.map(q => ({
          questionId: q.questionId,
          questionText: q.questionText || '',
          options: q.options,
          selectedOption: q.selectedOption || '',
          correctAnswer: q.correctAnswer || q.answer || '',
          isCorrect: !!q.isCorrect,
        }))
      };
    });
    
    

  

    // ✅ Save the final result document
    const finalResult = await Result.create({
      studentId,
      classId,
      className,
      candidateName,
      profileCode,
      totalScore,
      subjects: formattedSubjects
    });

    // ✅ Clean up: remove student and instance
    await Promise.all([
      studentModel.findByIdAndDelete(studentId),
      ExamInstances.findOneAndDelete({ profileCode })
    ]);

    // ✅ Respond
    return res.status(200).json({
      message: 'All subjects marked and result finalized (batched).',
      totalScore,
      subjects: finalResult.subjects,
      markedResult: finalResult._id
    });

  } catch (error) {
    // console.error('Error finalizing batched result:', error);
    return res.status(500).json({
      message: 'Failed to finalize result due to server error',
      error: error.message
    });
  }
};
