const multer = require('multer'); 
const ExcelJS = require('exceljs');
const questionModel = require('../models/question'); 
const subjectModel = require('../models/subject');
const classModel = require('../models/class'); 
const studentModel = require('../models/student'); 
const asyncHandler = require('express-async-handler');
const profileCodeModel = require('../models/profileCode');

// Multer setup for handling file uploads
const storage = multer.memoryStorage(); // Configuring multer to store files in memory
// const upload = multer({ storage: storage }).single('file'); // Setting up multer to handle single file uploads
const upload = multer({ storage: storage }).array('files');


//---------------------------------------------------------------------

const year = new Date().getFullYear();
let profileCounter = 0;

// Generate the next sequential profile code
async function generateSequentialProfileCode() {
  if (profileCounter === 0) {
    const latest = await profileCodeModel
      .findOne({ profileCode: new RegExp(`^ATN${year}`) })
      .sort({ profileCode: -1 });

    if (latest) {
      const currentNumber = parseInt(latest.profileCode.slice(7), 10);
      profileCounter = currentNumber + 1;
    } else {
      profileCounter = 1;
    }
  }

  const formatted = String(profileCounter).padStart(4, "0");
  profileCounter++;
  return `ATN${year}${formatted}`;
}

module.exports.handleExcelFileCandidates = [
  upload,

  asyncHandler(async (req, res) => {
    const candidatesNotAdded = [];
    const studentsToInsert = [];
    const profileCodesToInsert = [];

    const classCache = {};
    const subjectCache = {};

    for (const file of req.files) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const worksheet = workbook.worksheets[0];

      for (let rowIndex = 3; rowIndex <= worksheet.rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);

        const className = row.getCell(1).value?.toString().trim();
        const candidateName = row.getCell(2).value?.toString().trim();
        const phoneNo = row.getCell(3).value?.toString().trim();

        if (!className || !candidateName) continue;

        const classKey = `${req.admin}_${className}`;
        let classData = classCache[classKey];

        if (!classData) {
          classData = await classModel.findOne({
            name: className,
            admin: req.admin,
          });
          classCache[classKey] = classData;
        }

        if (!classData) {
          candidatesNotAdded.push(candidateName);
          continue;
        }

        const subjectIds = [];
        for (let colIndex = 4; colIndex <= row.cellCount; colIndex++) {
          const subjectName = row.getCell(colIndex).value?.toString().trim();
          if (!subjectName) continue;

          const subjectKey = `${req.admin}_${subjectName}`;
          let subject = subjectCache[subjectKey];

          if (!subject) {
            subject = await subjectModel.findOne({
              name: subjectName,
              admin: req.admin,
            });
            subjectCache[subjectKey] = subject;
          }

          if (subject) subjectIds.push(subject._id);
        }

        const profileCode = await generateSequentialProfileCode();

        profileCodesToInsert.push({ profileCode, admin: req.admin });

        studentsToInsert.push({
          classId: classData._id,
          className: classData.name,
          timer: classData.timer,
          candidateName,
          image: "",
          profileCode,
          subject: subjectIds,
          phone: phoneNo,
          admin: req.admin,
        });
      }
    }

    if (studentsToInsert.length) {
      await studentModel.insertMany(studentsToInsert, { ordered: false });
      await profileCodeModel.insertMany(profileCodesToInsert);
    }

    res.status(200).json({
      message: "Candidates uploaded successfully",
      skipped: candidatesNotAdded,
      added: studentsToInsert.length,
    });
  }),
];




module.exports.handleExcelFileQuestion = [
  upload,

  asyncHandler(async (req, res) => {
    const allQuestionsToInsert = [];
    const subjectMap = new Map();

    for (const file of req.files) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const worksheet = workbook.worksheets[0];

      for (let rowIndex = 3; rowIndex <= worksheet.rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);

        const subjectName = row.getCell(1).value?.toString().trim();
        const questionText = row.getCell(2).value;
        const optionA = row.getCell(3).value;
        const optionB = row.getCell(4).value;
        const optionC = row.getCell(5).value;
        const optionD = row.getCell(6).value;
        const answer = row.getCell(7).value?.toString().toLowerCase();

        if (!subjectName || !questionText || !optionA || !optionB || !optionC || !answer) {
          continue;
        }

        const cacheKey = `${req.admin}_${subjectName}`;

        let subject = subjectMap.get(cacheKey);
        if (!subject) {
          subject = await subjectModel.findOne({
            name: subjectName,
            admin: req.admin,
          });

          if (!subject) {
            subject = await subjectModel.create({
              name: subjectName,
              admin: req.admin,
              questions: [],
            });
          }

          subjectMap.set(cacheKey, subject);
        }

        const question = {
          subjectName,
          subjectId: subject._id,
          question: questionText,
          option_A: optionA,
          option_B: optionB,
          option_C: optionC,
          option_D: optionD,
          answer,
          admin: req.admin,
        };

        allQuestionsToInsert.push(question);
        subject.questions.push(question._id);
      }
    }

    if (!allQuestionsToInsert.length) {
      return res.status(400).json({ message: "No valid questions to upload." });
    }

    const insertedQuestions = await questionModel.insertMany(allQuestionsToInsert);

    // Fix ObjectIds after insert
    let i = 0;
    for (const subject of subjectMap.values()) {
      subject.questions = insertedQuestions
        .slice(i, i + subject.questions.length)
        .map(q => q._id);
      i += subject.questions.length;
      await subject.save();
    }

    res.status(200).json({
      message: `${insertedQuestions.length} questions uploaded successfully.`,
    });
  }),
];

//   upload, // Multer middleware to handle file upload

//   asyncHandler(async (req, res) => {
//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.load(req.file.buffer);
//     const worksheet = workbook.worksheets[0]; // Load the first worksheet

//     const questionsToInsert = [];
//     const subjectMap = new Map(); // Cache to hold existing or newly created subjects

//     for (let rowIndex = 3; rowIndex <= worksheet.rowCount; rowIndex++) {
//       const row = worksheet.getRow(rowIndex);

//       const subjectName = row.getCell(1).value
//         ? row.getCell(1).value.toString()
//         : null;
//       const questionText = row.getCell(2).value || "";
//       const optionA = row.getCell(3).value || "";
//       const optionB = row.getCell(4).value || "";
//       const optionC = row.getCell(5).value || "";
//       const optionD = row.getCell(6).value || "";
//       const answer = row.getCell(7).value
//         ? row.getCell(7).value.toString().toLowerCase()
//         : "";

//       if (!subjectName || !questionText || !optionA || !optionB || !optionC || !answer) {
//         console.warn(`Skipping row ${rowIndex} due to missing required data.`);
//         continue;
//       }

//       // Use cached subject or fetch/create it
//       let subject = subjectMap.get(subjectName);
//       if (!subject) {
//         subject = await subjectModel.findOne({ name: subjectName });
//         if (!subject) {
//           subject = await subjectModel.create({ name: subjectName, questions: [] });
//         }
//         subjectMap.set(subjectName, subject);
//       }

//       const question = new questionModel({
//         subjectName,
//         subjectId: subject._id,
//         question: questionText,
//         option_A: optionA,
//         option_B: optionB,
//         option_C: optionC,
//         option_D: optionD,
//         answer,
//       });

//       questionsToInsert.push(question);
//       subject.questions.push(question._id); // Update in-memory only
//     }

//     // Bulk insert questions
//     if (questionsToInsert.length > 0) {
//       await questionModel.insertMany(questionsToInsert);

//       // Save updated subject question lists
//       const saveSubjectPromises = [];
//       for (const subject of subjectMap.values()) {
//         saveSubjectPromises.push(subject.save());
//       }
//       await Promise.all(saveSubjectPromises);

//       res.status(200).json({ message: `${questionsToInsert.length} questions uploaded successfully.` });
//     } else {
//       res.status(400).json({ message: "No valid questions to upload." });
//     }
//   }),
// ];