const express = require("express");
const router = express.Router();
const {
  deleteStudent,
  createClass,
  updateClass,
  deleteClass,
  createSubject,
  getSubjects,
  deleteSubject,
  uploadQuestion,
  getSubjectQuestions,
  getAllQuestions,
  deleteQuestion,
  patchQuestion,
  registerStudent,
  sendResult,
  sendClassResult,
  changeHeaders,
  allHeaders,
  sendClassRegisteredCans,
  scratchCard,
  getScratchCard,
  changePassword,
  changeProfileImage,
  changeProfileName,
  downloadClassExcel,
  generateUniqueProfileCode,
  exportClassResultExcelDownload,
  deleteRegisteredStudents,
  deleteClassResults,
  updateClassBatch,
  changeBatchAwaitTime,
  getBatchAwwaitTime,
  numberOfQuestionsPerSubjects,
  createUser,
  getUser,
  updateUser,
  updateUserStatus,
} = require("../controllers/admin");

const requireAuth = require("../middleware/requireAuth");
const upload = require("./files");
const { handleExcelFileQuestion, handleExcelFileCandidates } = require("../controllers/handleExcelFileController");

router.use(requireAuth);

//-------------generate profile code--------------------------------
router.get("/generate-profile-code", generateUniqueProfileCode);

//--------------Create-----Class---------------------------------------
router.post("/create-class", createClass);
router.delete("/delete-class/:id", deleteClass);
router.patch("/update-class/:id", updateClass);

//----------------------create-batched-class---------------------------------
router.post("/create-batched-class", createClass);
router.patch("/update-class/:id/batch", updateClassBatch);


// ---------------------Users--------------------------------------------
router.post("/create-user", createUser);
router.get("/get-user", getUser);
router.put("/update-user-profile/:id", updateUser);
router.put("/users/:id/status", updateUserStatus);

// ---------------------Subject--------------------------------------------
router.post("/create-subject", createSubject);
router.get("/get-subjects", getSubjects);
router.delete("/delete-subject/:del", deleteSubject);

//-----------------Question------------------------------------------------
router.post("/create-subject-question", upload.single("file"), uploadQuestion);
router.get("/get-subject-questions/:subjectId", getSubjectQuestions);
router.get("/get-all-questions", getAllQuestions);
router.delete("/delete-question/:subjectId/:questionId", deleteQuestion);
router.patch("/update-question", upload.single("file"), patchQuestion);

//------------------------Candidate---or------Student-------------------------
router.post("/register-student", upload.single("file"), registerStudent);
router.delete("/delete-student/:id", deleteStudent);

//-----------upload-----excel---file--- for----cand
router.post("/upload-x-question", handleExcelFileQuestion);
router.post("/upload-x-candidate", handleExcelFileCandidates);

// -----------get all result----------------------
router.get("/get-results", sendResult);
router.get("/class-results/:classId", sendClassResult);
router.get("/class-results/export-excel/:id", exportClassResultExcelDownload);
router.get("/class-registered-students/:classId", sendClassRegisteredCans);
router.get("/class-registered-students/download-excel/:id", downloadClassExcel);

//-------------------change-----headers------------------------
router.post("/change-headers/:id", changeHeaders);
router.get("/all-headers", allHeaders);
router.get("/batchAwaitTime", getBatchAwwaitTime);

router.post("/create-scratch-card", scratchCard);
router.get("/get-scratch-card", getScratchCard);

//---------------/change-password----------------
router.put("/change-password", changePassword);
router.put("/update-profile-image", upload.single("image"), changeProfileImage);
router.put("/name-change", changeProfileName);
router.put("/change-batchAwaitTime", changeBatchAwaitTime);
router.put("/number-of-questions", numberOfQuestionsPerSubjects);


//--------------------Candidates-----and result--------------
router.delete("/delete-registered-students/:classId", deleteRegisteredStudents)
router.delete("/delete-class-results/:classId", deleteClassResults)

module.exports = router;
