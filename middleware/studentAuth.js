const jwt = require('jsonwebtoken');
const studentModel = require('../models/student');

const studentAuth = async (req, res, next) => {
    const token = req.cookies.studentExamCookie;
    // console.log(token)
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.SECRET);
      // req.student = await studentModel.findOne({ _id: decoded.id }).select('_id');
      student = await studentModel.findOne({ _id: decoded.id })
      req.student =  student._id
      req.studentAdminID = student.admin
      console.log(req.studentAdminID)
      if (!req.student) {
        return res.status(401).json({ message: 'Student not found' });
      }
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ message: 'Request not authorized' });
    }
  };
  
  module.exports = studentAuth;
  
