// server/routes/studentRoutes.js
const express = require('express');
const studentAuth = require('../middleware/studentAuth');
const { getStudentDetails,markQuestion,updateExamInstance } = require('../controllers/studentController');

const router = express.Router();

router.use(studentAuth); // Apply authentication middleware

router.get('/student-info', getStudentDetails); // Get student details
router.post('/mark-questions', markQuestion); // Get student details
router.post('/save-exam-instances', updateExamInstance); // Get student details


module.exports = router;