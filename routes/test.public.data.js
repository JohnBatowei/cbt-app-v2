const express = require('express')
const questionModel = require('../models/question')
const studentModel = require('../models/student')
const router = express.Router()

//testing api power bi
router.get("/bi", async (req, res) => {
    try {
    //   const questionData = await questionModel.find({}).limit(1).lean();
  
    //   const student = await studentModel
    //     .findOne({ profileCode }) // make sure profileCode is defined
    //     .populate({
    //       path: 'subject',
    //       populate: {
    //         path: 'questions',
    //         options: { limit: 2 } // Limit nested questions too (if needed)
    //       }
    //     }).limit(1)
    //     .lean();
  
    //   if (!questionData || !student) {
    //     return res.status(404).json({ data: "No data found" });
    //   }
  console.log('Got here')
      res.status(200).json({ name : 'Aquarius'});
  
    } catch (error) {
      console.log(error.message, error);
      res.status(500).json({ error: "Server error" });
    }
  });
  

  module.exports = router