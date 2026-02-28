const sendEmail = require("../utils/sendEmail");
const generateUniqueProfileCode = require('../helpers/profileCodeGenerator');
const asyncHandler = require("express-async-handler");
const classModel = require("../models/class");
const mongoose = require("mongoose");
const ExcelJS = require('exceljs');
const sanitizeHtml = require('sanitize-html');
const subjectModel = require("../models/subject");
const deleteUploadImage = require("../helpers/deleteImage");
const questionModel = require("../models/question");
const studentModel = require("../models/student");
const { Result } = require("../models/result");
const headersModel = require("../models/headers");
const scratchCardModel = require("../models/scratchCard");
const adminModel = require("../models/admin");
const profileCodeModel = require('../models/profileCode');
const batchAwaitTimeModel = require('../models/batchAwaitTime');
const numberOfQuestionPerSubjectModel = require('../models/numberOFQuestionPerSubject');


//--------------------create--a--class-------------------------------------------------------
module.exports.createClass = asyncHandler(async (req, res) => {
  const { name, timer, subjects, profileCodeInitials, isBatched, subjectTimers } = req.body;

  // Basic validation
  if (!name || !Array.isArray(subjects) || !profileCodeInitials) {
    return res.status(400).json({ message: "Invalid input data." });
  }

  if (!isBatched && !timer) {
    return res.status(400).json({ message: "Timer is required for unbatched classes." });
  }

  if (isBatched && (!Array.isArray(subjectTimers) || subjectTimers.length === 0)) {
    return res.status(400).json({ message: "Batch mode requires subjectTimers." });
  }

  try {
    const name2 = name.trim();
    const profileCodeInitialsUppercase = profileCodeInitials.toUpperCase();

    const findClass = await classModel.findOne({ name: name2 });
    if (findClass) {
      return res.status(400).json({ message: `${name2} already exists` });
    }
    // console.log(findClass)
    const fetchedSubjects = await Promise.all(
      subjects.map((subjectId) => subjectModel.findById(subjectId).lean())
    );

    const  batchAwaitTime = await batchAwaitTimeModel.findOne({set: true});
    if (!batchAwaitTime) batchAwaitTimeModel.create(req.body);
    
    const newClass = new classModel({
      name: name2,
      isBatched: !!isBatched,
      timer: timer || "0", // if not batched, timer is required
      subject: fetchedSubjects,
      subjectTimers: isBatched ? subjectTimers : [],
      profileCodeInitials: profileCodeInitialsUppercase,
      admin: req.admin
    });

    await newClass.save();
    res.status(200).json({ message: `${name2} class created successfully!` });
  } catch (error) {
    // console.error("Error creating class:", error);
    res.status(500).send("Server error.");
  }
});


module.exports.deleteClass = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  let deleteQuery = { _id: id };

  // Non-super admins can only delete their own classes
  if (req.adminRole !== "admin") {
    deleteQuery.admin = req.admin;
  }

  const result = await classModel.findOneAndDelete(deleteQuery);

  if (!result) {
    return res.status(404).json({
      message: "Class not found or not authorized",
    });
  }

  await studentModel.deleteMany({ classId: result._id });

  res.status(200).json({
    message: `${result.name} deleted alongside its students successfully`,
  });
});




module.exports.updateClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, timer, subjects, profileCodeInitials } = req.body;

//  return console.log('object', req.body);
  // console.log('Class ID:', id);
  const profileCodeInitial = profileCodeInitials.toUpperCase()

  try {
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid class ID' });
    }

    // Validate subjects array
    if (!Array.isArray(subjects) || !subjects.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: 'Invalid subject IDs' });
    }

    // Find the class by ID and update it
    const updatedClass = await classModel.findByIdAndUpdate(
      id,
      {
        name,
        timer,
        subject: subjects, // Update the subject field
        profileCodeInitials: profileCodeInitial.toUpperCase(),
      },
      { new: true, runValidators: true } // Return the updated document and apply validators
    );

    if (!updatedClass) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // console.log('Updated Class:', updatedClass);

    res.status(200).json({ message: `${name} has been updated successfully!` });
  } catch (error) {
    // console.error('Update Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports.updateClassBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, profileCodeInitials, subjects } = req.body;
// console.log("Object", req.body);
  try {
    // Validate class ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid class ID" });
    }

    // Validate subjects array
    if (
      !Array.isArray(subjects) ||
      !subjects.every(
        (s) =>
          s.subjectId &&
          mongoose.Types.ObjectId.isValid(s.subjectId) &&
          s.timer &&
          !isNaN(s.timer) &&
          Number(s.timer) >= 1
      )
    ) {
      return res.status(400).json({ message: "Invalid subjects or timers" });
    }

    // Extract subject IDs for the `subject` field
    const subjectIds = subjects.map((s) => s.subjectId);

    // Find the existing class
    const existingClass = await classModel.findById(id);
    if (!existingClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Make sure this class is marked as batched
    if (!existingClass.isBatched) {
      return res.status(400).json({ message: "Class is not batched" });
    }

    // Prepare update data
    const updateData = {
      name,
      profileCodeInitials: profileCodeInitials.toUpperCase(),
      subject: subjectIds, // Array of ObjectIds
      subjectTimers: subjects, // Array of { subjectId, timer }
      timer: undefined, // Clear the single timer since this is batched
    };

    const updatedClass = await classModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({ message: `${name} has been updated successfully!`, updatedClass });
  } catch (error) {
    // console.error("Batch update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//----------------------------End of Class---------------------------------------------------

//------------------------Profile code generator-------------------------------------------

module.exports.generateUniqueProfileCode = asyncHandler(async (req, res) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.status(400).json({ message: "Missing prefix" });

    const profileCode = await generateUniqueProfileCode(prefix);
    // console.log("profileCode",profileCode);
    res.status(200).json({ profileCode });
  } catch (err) {
    // console.error(err);
    res.status(500).json({ message: "Failed to generate profile code" });
  }
});


// ------------------------------Subject---Section-----------------------------------------
module.exports.createUser = asyncHandler(async (req, res) => {
  
  const {fullname, acctType, subType, password, cPassword, role, email} = req.body.data
if(!fullname || !acctType || !subType || !password || !cPassword || !role || !email) return res.status(404).json({ error: "fields cannot be empty" });
if(password !== cPassword ) return res.status(404).json({ error: "Passwords dont match" });
  // return
  const findUser = await adminModel.findOne({ email});
  if (findUser) {
    return res.status(200).json({ message: `Oops ${email} already exists` });
  }

  const startDate = new Date();
  let endDate = new Date(startDate);

  switch (subType) {
    case "one_year":
      endDate.setFullYear(startDate.getFullYear() + 1);
      break;
    case "two_year":
      endDate.setFullYear(startDate.getFullYear() + 2);
      break;
    case "six_month":
      endDate.setMonth(startDate.getMonth() + 6);
      break;
    case "three_month":
      endDate.setMonth(startDate.getMonth() + 3);
      break;
    case "one_month":
      endDate.setMonth(startDate.getMonth() + 1);
      break;
    default:
      return res.status(400).json({ error: "Invalid subscription type" });
  }
  // Create a new subject
  const create = await adminModel.create({
    name: fullname,
    email,
    password,
    image: null,
    role,
    subscription: subType,
    acctType,
    isSuspended: false,
    subscriptionStart: startDate,
    subscriptionEnd: endDate,
    subscriptionActive: true
  });
  if (!create) {
    return res.json({ message: "Error creating user" });
  }
    // 📨 Send confirmation email
     await sendEmail(
      email,
      "Profile created Successfully",
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color:#f9f9f9; border-radius:8px;">
          <h2 style="color:#0052cc;">Hello ${create.name},</h2>
          <p>Your profile has been created successfully. Below are your details:</p>
          <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
            <tr><td><b>Email:</b></td><td>${create.email}</td></tr>
            <tr><td><b>Account Type:</b></td><td>${create.acctType}</td></tr>
            <tr><td><b>Subscription Type:</b></td><td>${create.subscription}</td></tr>
            <tr><td><b>Role:</b></td><td>${create.role}</td></tr>
            <tr><td><b>Temp Password:</b></td><td>${password}</td></tr>
          </table>
          <br/>
          <p>If you did not request this change, please contact our support team immediately.</p>
          <p>— <b>AriTron LTD Support Team</b></p>
        </div>
      `
    );

  // Respond with success message
  res.json({ message: `${fullname} has been created` });
});

module.exports.getUser = asyncHandler(async (req, res) => {
  const findUser = await adminModel.find({role: { $in: ["user", "trier"] }}).sort({ createdAt: -1 }).lean()
  console.log(findUser)
  if(findUser) return   res.status(200).json({ message: findUser});
});

module.exports.updateUserStatus = asyncHandler(async (req, res) => {
  const id = req.params.id

  const findUser = await adminModel.findOne({_id:id})
  // console.log(id,findUser)
  if(!findUser){
    return res.status(404).json({error : 'User not found'})
  }
  findUser.isSuspended = !findUser.isSuspended
 const saveUser =  await findUser.save()
  console.log(saveUser)
 return   res.status(200).json({ message: findUser});
});

module.exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await adminModel.findById(id);

  if (!user) return res.status(404).json({ error: "User not found" });

  const { subType, password } = req.body;

  // 🧩 Update allowed fields (excluding _id)
  Object.keys(req.body).forEach((key) => {
    if (req.body[key] !== undefined && key !== "_id") {
      user[key] = req.body[key];
    }
  });

  // ⚙️ Handle subscription renewal
  if (subType) {
    const now = new Date();
    const currentEnd = new Date(user.subscriptionEnd);
    const startDate = now > currentEnd ? now : currentEnd; // continue from expiry if still active
    let endDate = new Date(startDate);

    switch (subType) {
      case "one_year":
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
      case "two_year":
        endDate.setFullYear(startDate.getFullYear() + 2);
        break;
      case "six_month":
        endDate.setMonth(startDate.getMonth() + 6);
        break;
      case "three_month":
        endDate.setMonth(startDate.getMonth() + 3);
        break;
      case "one_month":
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      default:
        return res.status(400).json({ error: "Invalid subscription type" });
    }

    user.subscriptionStart = now;
    user.subscriptionEnd = endDate;
    user.subscriptionActive = true; // re-enable access
    user.isSuspended = false;
  }

  // 🧠 Only hash password if user explicitly changed it
  if (!password) {
    user.password = user.password; // keep existing password untouched
  }

  // 💾 Save user
  const updatedUser = await user.save();

  // 📩 Send notification email (no password mention)
  await sendEmail(
    updatedUser.email,
    "Profile Updated Successfully",
    `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color:#f9f9f9; border-radius:8px;">
        <h2 style="color:#0052cc;">Hello ${updatedUser.name},</h2>
        <p>Your profile has been updated successfully.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
          <tr><td><b>Email:</b></td><td>${updatedUser.email}</td></tr>
          <tr><td><b>Account Type:</b></td><td>${updatedUser.acctType}</td></tr>
          <tr><td><b>Subscription Type:</b></td><td>${updatedUser.subscription}</td></tr>
          <tr><td><b>Subscription Ends:</b></td><td>${updatedUser.subscriptionEnd.toDateString()}</td></tr>
          <tr><td><b>Role:</b></td><td>${updatedUser.role}</td></tr>
        </table>
        <br/>
        <p>If you did not request this change, please contact our support team immediately.</p>
        <p>— <b>AriTron LTD Support Team</b></p>
      </div>
    `
  );

  res.status(200).json({
    message: "User profile updated successfully",
    updatedUser,
  });
});




// ------------------------------Subject---Section-----------------------------------------
module.exports.createSubject = asyncHandler(async (req, res) => {
  // console.log(req.body.subjectName);
  // Check if the subject already exists
  const findSubject = await subjectModel.findOne({
    name: req.body.subjectName,
  });
  if (findSubject) {
    return res.status(200).json({ message: `Oops ${req.body.subjectName} already exists` });
  }

  // Create a new subject
  const create = await subjectModel.create({ name: req.body.subjectName, admin: req.admin });
  if (!create) {
    return res.json({ message: "Error creating subject" });
  }

  // Respond with success message
  res.json({ message: `${req.body.subjectName} has been created` });
});

// module.exports.getSubjects = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10, searchTerm = "" } = req.query;

//   let query = {};

//   if (searchTerm.trim() !== "") {
//     query = {
//       $or: [
//         { candidateName: { $regex: searchTerm, $options: "i" } },
//         { className: { $regex: searchTerm, $options: "i" } },
//         { timer: { $regex: searchTerm, $options: "i" } },
//         { profileCode: { $regex: searchTerm, $options: "i" } }
//       ]
//     };
//   }

//   const skip = (page - 1) * limit;

//   const [classes, findSubject, findCandidates, findCandidatesDocsCount] = await Promise.all([
//     classModel.find().sort({ createdAt: -1 }).populate({ path: "subject" }).exec(),
//     subjectModel.find().sort({ createdAt: -1 }).lean(),
//     studentModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
//     studentModel.countDocuments(query)
//   ]);

//   console.log(req.admin)
//   console.log(req.adminRole)


//   res.status(200).json({ message: findSubject, classes, findCandidates, findCandidatesDocsCount });
// });

module.exports.getSubjects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, searchTerm = "" } = req.query;
  const skip = (page - 1) * limit;

  let studentQuery = {};
  let subjectQuery = {};
  let classQuery = {};

  /* ---------------- SEARCH ---------------- */
  if (searchTerm.trim()) {
    studentQuery.$or = [
      { candidateName: { $regex: searchTerm, $options: "i" } },
      { className: { $regex: searchTerm, $options: "i" } },
      { timer: { $regex: searchTerm, $options: "i" } },
      { profileCode: { $regex: searchTerm, $options: "i" } },
    ];
  }

  /* ---------------- ACCESS CONTROL ---------------- */
  if (req.adminRole !== "admin") {
    // find super admin(s)
    const superAdmins = await adminModel
      .find({ role: "admin" })
      .select("_id")
      .lean();

    const superAdminIds = superAdmins.map(a => a._id);

    subjectQuery = {
      $or: [
        { admin: { $in: superAdminIds } }, // global subjects
        { admin: req.admin._id },           // own subjects
      ],
    };

    classQuery = { admin: req.admin._id };
    studentQuery.admin = req.admin._id;
  }

  /* ---------------- DB CALLS ---------------- */
  const [classes,findSubject,findCandidates,findCandidatesDocsCount] = await Promise.all([
    classModel.find(classQuery).sort({ createdAt: -1 }).populate({ path: "subject" }).lean(),
    subjectModel.find(subjectQuery).sort({ createdAt: -1 }).lean(),
    studentModel.find(studentQuery).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    studentModel.countDocuments(studentQuery)
  ]);

  /* ---------------- RESPONSE (UNCHANGED) ---------------- */
  res.status(200).json({
    message: findSubject,
    classes,
    findCandidates,
    findCandidatesDocsCount
  });
});



module.exports.deleteSubject = asyncHandler(async (req, res) => {
  const subjectId = req.params.del;

  if (!mongoose.Types.ObjectId.isValid(subjectId)) {
    return res.status(400).json({ message: "Invalid subject ID" });
  }

  const isSuperAdmin = req.adminRole === "admin";

  // 🔍 Build dynamic query
  const subjectQuery = isSuperAdmin
    ? { _id: subjectId }
    : { _id: subjectId, admin: req.admin };

  const subject = await subjectModel.findOne(subjectQuery);

  if (!subject) {
    return res.status(404).json({
      message: "Subject not found or not authorized",
    });
  }

  // 🔍 Question query
  const questionQuery = isSuperAdmin
    ? { subjectId }
    : { subjectId, admin: req.admin };

  const questions = await questionModel.find(questionQuery).lean();

  // 🧹 Delete images
  for (const question of questions) {
    if (question.image) {
      deleteUploadImage(question.image);
    }
  }

  //  Delete questions
  await questionModel.deleteMany(questionQuery);

  //  Delete subject
  await subjectModel.deleteOne({ _id: subjectId });

  // Remove subject references from classes
  const classQuery = isSuperAdmin ? {} : { admin: req.admin };

  await classModel.updateMany(classQuery, {
    $pull: {
      subject: subjectId,
      subjectTimers: { subjectId },
    },
  });

  res.status(200).json({
    message: `${subject.name} deleted successfully.`,
  });
});


//----------------------------------End of Subject------------------------------------------



//------------------------Questions---Section--------------------------------------------------
// module.exports.uploadQuestion = asyncHandler(async (req, res) => {
//   let { subjectId, question, optionA, optionB, optionC, optionD, answer } = req.body;
//   // console.log(req.body)
//   // Validate ObjectId
//   if (!mongoose.Types.ObjectId.isValid(subjectId)) {
//     return res.status(400).json({ message: "Not a valid id" });
//   }

//   // Find the subject
//   const findSubject = await subjectModel.findOne({ _id: subjectId });
//   if (!findSubject) {
//     if (req.file && req.file.filename) {
//       deleteUploadImage(req.file.filename);
//     }
//     return res.status(404).json({ message: "Unable to find subject" });
//   }

//     // Sanitize the question field before saving
//     question = sanitizeHtml(question);
//   // Prepare question object
//   const questionData = {
//     subjectName: findSubject.name,
//     subjectId,
//     question, // Consistent field name
//     option_A: optionA,
//     option_B: optionB,
//     option_C: optionC,
//     option_D: optionD,
//     answer: answer.trim().toLowerCase(),
//     admin: req.admin
//   };

//   // Add file information if provided
//   if (req.file && req.file.filename) {
//     questionData.image = req.file.filename;
//   }

//   // Create and save the question
//   const quest = new questionModel(questionData);

//   try {
//     const saveQuestion = await quest.save();

//     //save question id to subject aswell
//     findSubject.questions.push(saveQuestion._id);
//     await findSubject.save();
//     res
//       .status(200)
//       .json({
//         message: "Your question has been added to " + saveQuestion.subjectName,
//       });
//   } catch (error) {
//     if (req.file && req.file.filename) {
//       deleteUploadImage(req.file.filename);
//     }
//     res.status(500).json({ message: "Server error" });
//   }
// });
module.exports.uploadQuestion = asyncHandler(async (req, res) => {
  let { subjectId, question, optionA, optionB, optionC, optionD, answer } = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(subjectId)) {
    return res.status(400).json({ message: "Not a valid id" });
  }

  // Find the subject
  const findSubject = await subjectModel.findOne({ _id: subjectId });
  if (!findSubject) {
    if (req.file && req.file.filename) {
      deleteUploadImage(req.file.filename);
    }
    return res.status(404).json({ message: "Unable to find subject" });
  }

  // ---------------- ACCESS CONTROL ----------------
  // Only superAdmin or the admin who created the subject can add questions
  if (req.adminRole !== "admin" && !findSubject.admin.equals(req.admin._id)) {
    if (req.file && req.file.filename) {
      deleteUploadImage(req.file.filename);
    }
    return res.status(403).json({
      message: "You are not authorized to add questions to this subject",
    });
  }

  // Sanitize the question field before saving
  question = sanitizeHtml(question);

  // Prepare question object
  const questionData = {
    subjectName: findSubject.name,
    subjectId,
    question, // Consistent field name
    option_A: optionA,
    option_B: optionB,
    option_C: optionC,
    option_D: optionD,
    answer: answer.trim().toLowerCase(),
    admin: req.admin,
  };

  // Add file information if provided
  if (req.file && req.file.filename) {
    questionData.image = req.file.filename;
  }

  // Create and save the question
  const quest = new questionModel(questionData);

  try {
    const saveQuestion = await quest.save();

    // Save question id to subject as well
    findSubject.questions.push(saveQuestion._id);
    await findSubject.save();

    res.status(200).json({
      message: "Your question has been added to " + saveQuestion.subjectName,
    });
  } catch (error) {
    if (req.file && req.file.filename) {
      deleteUploadImage(req.file.filename);
    }
    res.status(500).json({ message: "Server error" });
  }
});


module.exports.getSubjectQuestions = asyncHandler(async (req, res) => {
  const subjectId = req.params.subjectId;
  // console.log("got it");
  // Check if the subject already exists

  const findSubjectQuestions = await questionModel.find({ subjectId });

  const subjectPlusWithImages = findSubjectQuestions.map((question) => ({
    subjectName: question.subjectName,
    questionId: question._id,
    subjectId: subjectId,
    question: question.question,
    optionA: question.option_A,
    optionB: question.option_B,
    optionC: question.option_C,
    optionD: question.option_D,
    answer: question.answer,
    image: `/uploads/${question.image}`,
    // image: `${req.protocol}://${req.get("host")}/uploads/${question.image}`,
  })).reverse();

  const subjectName = subjectPlusWithImages[0].subjectName;

  // console.log(subjectPlusWithImages);
  // Respond with success message
  res.status(200).json({ questions:subjectPlusWithImages, subjectName });
});


// module.exports.getAllQuestions = asyncHandler(async (req, res) => {
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;
//   const skip = (page - 1) * limit;

//   const search = req.query.search || "";

//   let query = {};
//   if (search.trim()) {
//     const searchRegex = new RegExp(search, "i"); // case-insensitive
//     query = {
//       $or: [
//         { subjectName: searchRegex },
//         { question: searchRegex },
//         { option_A: searchRegex },
//         { option_B: searchRegex },
//         { option_C: searchRegex },
//         { option_D: searchRegex },
//         { answer: searchRegex },
//       ],
//     };
//   }

//   const total = await questionModel.countDocuments(query);

//   const questionsdb = await questionModel.find(query)
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(limit);

//   const formattedQuestions = questionsdb.map((question) => ({
//     subjectName: question.subjectName,
//     questionId: question._id,
//     subjectId: question.subjectId,
//     question: question.question,
//     optionA: question.option_A,
//     optionB: question.option_B,
//     optionC: question.option_C,
//     optionD: question.option_D,
//     answer: question.answer,
//     image: question.image ? `/uploads/${question.image}` : null,
//     // image: question.image ? `${req.protocol}://${req.get("host")}/uploads/${question.image}` : null,
//   }));

//   res.status(200).json({
//     total,
//     questions: formattedQuestions,
//   });
// });

module.exports.getAllQuestions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const search = req.query.search || "";

  // ------------------ SEARCH ------------------
  let searchQuery = {};
  if (search.trim()) {
    const searchRegex = new RegExp(search, "i"); // case-insensitive
    searchQuery = {
      $or: [
        { subjectName: searchRegex },
        { question: searchRegex },
        { option_A: searchRegex },
        { option_B: searchRegex },
        { option_C: searchRegex },
        { option_D: searchRegex },
        { answer: searchRegex },
      ],
    };
  }

  // ------------------ ACCESS CONTROL ------------------
  let ownershipQuery = {};
  if (req.adminRole !== "admin") {
    // Non-super admin: include only their own questions + super admin questions
    const superAdmins = await adminModel.find({ role: "admin" }).select("_id").lean();
    const superAdminIds = superAdmins.map(a => a._id);

    ownershipQuery = {
      $or: [
        { admin: req.admin._id },          // their own questions
        { admin: { $in: superAdminIds } }, // super admin questions
      ],
    };
  }
  // Super admin sees everything → ownershipQuery stays empty

  // Merge search + ownership conditions
  let finalQuery = {};
  if (Object.keys(searchQuery).length && Object.keys(ownershipQuery).length) {
    finalQuery = { $and: [searchQuery, ownershipQuery] };
  } else if (Object.keys(searchQuery).length) {
    finalQuery = searchQuery;
  } else if (Object.keys(ownershipQuery).length) {
    finalQuery = ownershipQuery;
  }

  const total = await questionModel.countDocuments(finalQuery);

  const questionsdb = await questionModel.find(finalQuery)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const formattedQuestions = questionsdb.map((question) => ({
    subjectName: question.subjectName,
    questionId: question._id,
    subjectId: question.subjectId,
    question: question.question,
    optionA: question.option_A,
    optionB: question.option_B,
    optionC: question.option_C,
    optionD: question.option_D,
    answer: question.answer,
    image: question.image ? `/uploads/${question.image}` : null,
  }));

  res.status(200).json({
    total,
    questions: formattedQuestions,
  });
});



module.exports.deleteQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    return res.status(400).json({ message: "Invalid question ID" });
  }

  let deleteQuery = { _id: questionId };

  // Non-super admins can only delete their own questions
  if (req.adminRole !== "admin") {
    deleteQuery.admin = req.admin;
  }

  const question = await questionModel.findOneAndDelete(deleteQuery);

  if (!question) {
    return res.status(404).json({
      message: "Question not found or not authorized",
    });
  }

  deleteUploadImage(question.image);

  res.status(200).json({
    message: "Question delete successfully",
  });
});


module.exports.patchQuestion = asyncHandler(async (req, res) => {
  const { subjectId, questionId, question, optionA, optionB, optionC, optionD, answer } = req.body;

  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    return res.status(400).json({ message: "Not a valid id" });
  }

  // Build query: super admin can update any question, others only their own
  let query = { _id: questionId };
  if (req.adminRole !== "admin") {
    query.admin = req.admin; // ownership enforced
  }

  const questionD = await questionModel.findOne(query);
  if (!questionD) {
    return res.status(404).json({ message: "Question not found or not authorized" });
  }

  // Sanitize and update fields
  const sanitizedQuestion = sanitizeHtml(question);
  questionD.question = sanitizedQuestion;
  questionD.option_A = optionA;
  questionD.option_B = optionB;
  questionD.option_C = optionC;
  questionD.option_D = optionD;
  questionD.answer = answer.toLowerCase();

  // Update image if provided
  if (req.file && req.file.filename) {
    deleteUploadImage(questionD.image);
    questionD.image = req.file.filename;
  }

  const saveQuestion = await questionD.save();
  if (!saveQuestion) {
    return res.status(500).json({ message: `Unable to update question` });
  }

  res.status(200).json({ message: `Question updated successfully!!!` });
});

//-----------------------End of Question Section---------------------------------------------------


//----------------Candidates---or---Student---------------------------------------------------------------

module.exports.registerStudent = asyncHandler(async (req, res) => {
  try {
    // console.log('got it')
    // console.log(req.body)
    // let a = req.body.subjects
    // console.log(JSON.parse(a))
    // console.log(req.file.filename)
    // deleteUploadImage(req.file.filename)
    // return
    const { classId, className,fullname,phoneNumber,profileCode, examTime,subjects } = req.body;

    // Check if all required fields are present
    if (!classId || !className || !fullname || !profileCode || !examTime) {
      if (req.file) {
        deleteUploadImage(req.file.filename)
      }
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    const ProfileCodeExist = await studentModel.findOne({profileCode : profileCode})
    if(ProfileCodeExist){
      if (req.file) {
        deleteUploadImage(req.file.filename)
      }
      return res.status(400).json({ message: `Ooops sorry profile code already in use` });
    }

    // Handle file upload
    let image = '';
    if (req.file) {
      image = req.file.filename; // Store the file path in the database
    }
    // Create a new student
    const newStudent = new studentModel({
      classId,
      className,
      timer: examTime,
      candidateName: fullname.toLowerCase(),
      image: image,
      profileCode,
      phone: phoneNumber,
      subject: JSON.parse(subjects), // Parse subjects to array of ObjectIds
      admin: req.admin
    });

    // Save the student to the database
    const saveCan = await newStudent.save();
    new profileCodeModel({profileCode}).save();
    res.status(200).json({ message: `${saveCan.candidateName} has been registered successfully !!!` });
  } catch (error) {
    // console.error('Error registering student:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports.deleteStudent = asyncHandler(async (req, res) => {
  const id = req.params.id;

  // Validate the ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Invalid ID" });
  }

  try {
    // Find and delete the student by ID
    const result = await studentModel.findByIdAndDelete(id);
                   await profileCodeModel.findOneAndDelete({profileCode: result.profileCode});

    // Check if student was found and deleted
    if (!result) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Delete associated image if any
    if (result.image) {
      deleteUploadImage(result.image);
    }

    // console.log(result)
    // Respond with success message
    res.status(200).json({ message: `${result.candidateName} deleted successfully!!!` });

  } catch (error) {
    // Handle any errors that occurred during the process
    console.error("Error deleting student:", error);
    res.status(500).json({ message: "An error occurred while deleting the student" });
  }
});


// ---------------------Send  results -----------------------------------------------------------------

// module.exports.sendResult = asyncHandler(async (req, res) => {
//   try {
//       // Fetch all results
//       const results = await Result.find({})

//       // Organize results by className
//       const resultsByClass = {};

//       results.forEach(result => {
//           const className = result.className;
//           if (!resultsByClass[className]) {
//               resultsByClass[className] = [];
//           }
//           resultsByClass[className].push(result);
//       });

//       // Send organized results to the browser
//       res.status(200).json({
//           success: true,
//           data: resultsByClass
//       });

//   } catch (error) {
//       // console.error('Error fetching results:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Failed to retrieve results'
//       });
//   }
// });

module.exports.sendResult = asyncHandler(async (req, res) => {
  try {
    let query = {};

    //  Role-based access
    if (req.adminRole !== "admin") {
      // normal admin → only their own results
      query.admin = req.admin;
    }

    // Fetch results based on role
    const results = await Result.find(query).lean();

    // Organize results by className
    const resultsByClass = {};

    results.forEach(result => {
      const className = result.className;
      if (!resultsByClass[className]) {
        resultsByClass[className] = [];
      }
      resultsByClass[className].push(result);
    });

    res.status(200).json({
      success: true,
      data: resultsByClass
    });

  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve results"
    });
  }
});

// ---------------------End Send  results -------------------------------------------------------
module.exports.sendClassResult = asyncHandler(async (req, res) => {
  const classId = req.params.classId;
  const { page = 1, limit = 10, search = '' } = req.query;

  const query = {
      classId: classId,
      $or: [
          { candidateName: { $regex: search, $options: 'i' } },
          { profileCode: { $regex: search, $options: 'i' } },
          { 'subjects.subjectName': { $regex: search, $options: 'i' } }
      ]
  };

    //role base
  if (req.adminRole !== "admin") {

    query.admin = req.admin;

  }

  try {
      const totalCount = await Result.countDocuments(query);
      const results = await Result.find(query)
          .skip((page - 1) * limit)
          .limit(Number(limit));

      res.status(200).json({
          data: results,
          totalCount
      });
  } catch (error) {
      console.error("Error fetching class results:", error);
      res.status(500).json({ error: "Failed to retrieve class results" });
  }
});



module.exports.exportClassResultExcelDownload = asyncHandler( async (req, res) => {
    const classId = req.params.id;
    const { search = '' } = req.query;

    const query = {
        classId: classId,
        $or: [
            { candidateName: { $regex: search, $options: 'i' } },
            { profileCode: { $regex: search, $options: 'i' } },
            { 'subjects.subjectName': { $regex: search, $options: 'i' } }
        ]
    };

    if (req.adminRole !== "admin") {
      query.admin = req.admin;
    }

    try {
        const results = await Result.find(query);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Class Results');

        // Headers
        worksheet.columns = [
            { header: 'S/N', key: 'sn', width: 10 },
            { header: 'Student Name', key: 'candidateName', width: 30 },
            { header: 'Profile Code', key: 'profileCode', width: 20 },
            { header: 'Subjects & Scores', key: 'subjects', width: 50 },
            { header: 'Total Score', key: 'totalScore', width: 15 }
        ];

        results.forEach((result, index) => {
            worksheet.addRow({
                sn: index + 1,
                candidateName: result.candidateName.toUpperCase(),
                profileCode: result.profileCode,
                subjects: result.subjects.map(sub => `${sub.subjectName.toUpperCase()}: ${parseInt(sub.score)}`).join(', '),
                totalScore: parseInt(result.totalScore)
            });
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=class_results.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting class results to Excel:", error);
        res.status(500).json({ error: "Failed to export results to Excel" });
    }
});


module.exports.sendClassRegisteredCans = asyncHandler(async (req, res) => {
  try {
    const { classId } = req.params;
    const { page = 1, limit = 12, search = "" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(404).json({ data: 'Invalid ID' });
    }

    const query = {
      classId,
      $or: [
        { candidateName: { $regex: search, $options: 'i' } },
        { profileCode: { $regex: search, $options: 'i' } }
      ]
    };

  if (req.adminRole !== "admin") {
    query.admin = req.admin;
  }
    const total = await studentModel.countDocuments(query);

    const results = await studentModel.find(query)
      .populate('subject')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      data: results,
      total
    });

  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve results'
    });
  }
});

module.exports.downloadClassExcel = asyncHandler(async (req, res) => {
  try {
 const classId = req.params.id;
   //Create query
    const query = {
      classId: classId
    };
    //  Apply role filter
    if (req.adminRole !== "admin") {
      query.admin = req.admin;
    }
    // Use query
    const students = await studentModel.find(query).populate('subject');
// console.log('downloaded');
  // const students = await studentModel.find({ classId }).populate('subject');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Class Candidates');

  worksheet.columns = [
    { header: 'S/N', key: 'sn', width: 10 },
    { header: 'Name', key: 'candidateName', width: 30 },
    { header: 'Profile Code', key: 'profileCode', width: 20 },
    { header: 'Subjects', key: 'subjects', width: 40 },
  ];

  students.forEach((student, index) => {
    worksheet.addRow({
      sn: index + 1,
      candidateName: student.candidateName.toUpperCase(),
      profileCode: student.profileCode,
      subjects: (student.subject.map(sub => sub.name).join(', ')).toUpperCase()
    });
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename=ClassCandidates.xlsx');

  await workbook.xlsx.write(res);
  res.end();
  } catch (error) {
    res.status(500).json({ message: 'Could not generate excel', error });
  }
});



// --------------------Headers ------------------------------------------------------------------


module.exports.changeHeaders = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
        // console.log(body)
    if(req.adminRole !== 'admin') return res.status(400).json({data: "Header update not allowed at the moment"});
    if (!body || !id) {
      return res.status(400).json({ data: "Client errors" });
    }

    const headerUpdate = {};
    if (id === "f") {
      headerUpdate.frontPage = body;
      headerUpdate.admin = req.admin
    } else if (id === "coo") {
      headerUpdate.corPage = body;
      headerUpdate.admin = req.admin
    } else if (id === "can") {
      headerUpdate.canPage = body;
      headerUpdate.admin = req.admin
    } else if(id === "confirmation"){
      headerUpdate.confirmation = body.toLowerCase();
      headerUpdate.admin = req.admin
    }else if (id === "result") {
      headerUpdate.resultPage = body;
      headerUpdate.admin = req.admin
    } else {
      return res.status(400).json({ data: "Invalid header type" });
    }

    const header = await headersModel.findOneAndUpdate(
      { deff: id },
      headerUpdate,
      { upsert: true, new: true } // upsert creates a new document if none exists
    );

    return res.status(200).json({ data: `${id.toUpperCase()} page heading updated successfully!!!` });
  } catch (error) {
    console.error("Error updating header:", error);
    res.status(500).json({ data: "Server error" });
  }
});


module.exports.allHeaders = asyncHandler(async (req, res) => {
  try {
    const allHeaders = await headersModel.find({}).lean();
    res.status(200).json({ data: allHeaders });
  } catch (error) {
    console.error("Error fetching headers:", error);
    res.status(500).json({ data: "Server error" });
  }
});

module.exports.getBatchAwwaitTime = asyncHandler(async (req, res) => {
  try {
    const [batchTime, numOfQuest ]= await Promise.all( [batchAwaitTimeModel.findOne({admin: req.admin}).lean(), numberOfQuestionPerSubjectModel.findById(req.admin)] ) 
    // console.log(batchTime,numOfQuest);
    res.status(200).json({ data: batchTime, numOfQuest });
  } catch (error) {
    console.error("Error fetching headers:", error);
    res.status(500).json({ data: "Server error" });
  }
});




// Function to generate a unique scratch card
function generateScratchCard(length) {
  const chars = 'ABCDEFGH0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function handleCard(cardLength, cardNumber) {
  const generatedCards = new Set();
  const year = new Date().getFullYear();

  while (generatedCards.size < cardNumber) {
    generatedCards.add(`${year}${generateScratchCard(cardLength)}`);
  }

  return [...generatedCards];
}


module.exports.scratchCard = asyncHandler(async (req, res) => {
  if(req.adminRole !== 'admin'){
    return res.status(400).json({message: "Scratch card generation not allowed at the moment"});
  }
  let { cardCount } = req.body;

  cardCount = Number(cardCount);

  if (!Number.isInteger(cardCount) || cardCount <= 0) {
    return res.status(400).json({
      error: "cardCount must be a positive number",
    });
  }

  const genCards = handleCard(10, cardCount);

  const cardData = genCards.map(card => ({
    card,
    admin: req.admin, 
  }));

  try {
    await scratchCardModel.insertMany(cardData, { ordered: false });
  } catch (err) {
    // Ignore duplicate key errors safely
    if (err.code !== 11000) throw err;
  }

  res.status(200).json({
    data: `${cardCount} scratch cards generated successfully`,
  });
});



module.exports.getScratchCard = asyncHandler(async (req, res) => {
  try {
    const data = await scratchCardModel.find({admin: req.admin}).sort({createdAt: -1}).lean()

    res.status(200).json({ data });
  } catch (error) {
    console.error("Error generating scratch cards:", error);
    res.status(500).json({ data: "Server error" });
  }
});

module.exports.changePassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
 
  if(!newPassword || newPassword < 6){
    return res.status(404).json({error: 'Password cannot be empty'})
  }
  if(!email){
    return res.status(404).json({error: 'Invalid email'})
  }
  // Optional: verify email if needed
  const admin = await adminModel.findOne({email: email});

  if (admin) {
    admin.password = newPassword;
    await admin.save();
    return res.status(200).json({ message: 'Congratulations, password changed successfully' });
  } else {
      return res.status(404).json({ message: 'Admin not found' });
    }
    // const updateUser = await adminModel.findOneAndUpdate(req.admin, {password:hashedPassword },{new:true})
    // if(updateUser){
    //   return res.status(200).json({ message: 'Congratulations, password changed successfully' });      
    // }
    //   return res.status(404).json({ message: 'Admin not found' });
});


module.exports.changeProfileImage = asyncHandler(async (req, res) => {
  // console.log('got here')
  if (!req.file) {
    return res.status(400).json({ error: 'Invalid file input' });
  }

  const admin = await adminModel.findById(req.admin);
  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }

  deleteUploadImage(admin.image)
  admin.image = req.file.filename; 
  const savedDocs = await admin.save();
  const image = `/uploads/${savedDocs.image}`;
  // const image = `${req.protocol}://${req.get('host')}/uploads/${savedDocs.image}`;

  res.status(200).json({ message: 'Profile image updated successfully', newImage : image});
});

module.exports.changeProfileName= asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const admin = await adminModel.findById(req.admin);
  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }

  admin.name = req.body.name; 
  const savedDocs = await admin.save();

  res.status(200).json({ message: 'Profile name updated successfully', newName : savedDocs.name});
});

module.exports.changeBatchAwaitTime = asyncHandler(async (req, res) => {
  // return console.log(req.body);
  if (!req.body.batchAwaitTime || isNaN(req.body.batchAwaitTime) || req.body.batchAwaitTime < 1) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const  batchAwaitTime = await batchAwaitTimeModel.findOne({admin: req.admin});
  if (!batchAwaitTime) {
   const newBatch = await batchAwaitTimeModel.create({...req.body, admin: req.admin})
    // return res.status(200).json({ message: 'batchAwaitTime created for the first time' });
    return res.status(200).json({ message: 'batchAwaitTime created for the first time', newName : newBatch.batchAwaitTime});
  }

  batchAwaitTime.batchAwaitTime = req.body.batchAwaitTime; 
  const batchAwaitTimeSave = await batchAwaitTime.save();
  // console.log(batchAwaitTimeSave.batchAwaitTime);

  res.status(200).json({ message: 'Batch await time has been set to ', newName : batchAwaitTimeSave.batchAwaitTime});
});

module.exports.numberOfQuestionsPerSubjects = asyncHandler(async (req, res) => {
  let { numberOfQuestionPerSubject } = req.body;

  // convert string → number
  numberOfQuestionPerSubject = Number(numberOfQuestionPerSubject);

  if (
    Number.isNaN(numberOfQuestionPerSubject) ||
    numberOfQuestionPerSubject <= 0
  ) {
    return res.status(400).json({
      error: 'numberOfQuestionPerSubject must be a positive number',
    });
  }

  const setting = await numberOfQuestionPerSubjectModel.findOneAndUpdate(
    { admin: req.admin }, // 🔑 validation key
    { numberOfQuestionPerSubject },
    { new: true, upsert: true }
  );

  res.status(200).json({
    message: 'Number of questions per subject saved successfully',
    newNumQuest: setting.numberOfQuestionPerSubject,
  });
});

//--------------delete candidates by class and result---------------------

module.exports.deleteRegisteredStudents = asyncHandler(async (req, res) => {
  const classId = req.params.classId;

  // Validate the classId
  if (!mongoose.Types.ObjectId.isValid(classId)) {
    return res.status(400).json({ message: "Invalid class ID" });
  }

  try {
    // Find all students with the classId
    const students = await studentModel.find({ classId });

    if (!students.length) {
      return res.status(404).json({ message: "No students found for this class" });
    }

    // Delete all related profile codes and images
    for (const student of students) {
      if (student.profileCode) {
        await profileCodeModel.deleteOne({ profileCode: student.profileCode });
      }

      if (student.image) {
        deleteUploadImage(student.image);
      }
    }

    // Delete the students from the database
    await studentModel.deleteMany({ classId });

    res.status(200).json({
      message: `${students.length} student(s) and their profile codes deleted successfully`,
    });

  } catch (error) {
    console.error("Error deleting students:", error);
    res.status(500).json({ message: "An error occurred while deleting students" });
  }
});


module.exports.deleteClassResults = asyncHandler(async (req, res) => {
  const classId = req.params.classId;

  // Validate the classId
  if (!mongoose.Types.ObjectId.isValid(classId)) {
    return res.status(400).json({ message: "Invalid class ID" });
  }

  try {
    // Find all students with the classId
    const students = await Result.find({ classId });

    if (!students.length) {
      return res.status(404).json({ message: "No students found for this class" });
    }

    // Delete all related profile codes and images
    for (const student of students) {
      if (student.profileCode) {
        await profileCodeModel.deleteOne({ profileCode: student.profileCode });
      }

      if (student.image) {
        deleteUploadImage(student.image);
      }
    }

    // Delete the students from the database
    await Result.deleteMany({ classId });

    res.status(200).json({
      message: `${students.length} student(s) results deleted successfully from ${students[0].className}`,
    });

  } catch (error) {
    console.error("Error deleting students:", error);
    res.status(500).json({ message: "An error occurred while deleting students" });
  }
});