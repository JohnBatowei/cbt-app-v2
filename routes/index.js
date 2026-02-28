const express = require("express");
const router = express.Router();
const adminModel = require("../models/admin");
const jwt = require('jsonwebtoken');
// const requireAuth = require("../middleware/requireAuth");
const deleteUploadImage = require("../helpers/deleteImage");
const upload = require("./files");
const studentModel = require("../models/student");
const headersModel = require("../models/headers");
const { Result } = require("../models/result");
const { default: mongoose } = require("mongoose");
const scratchCardModel = require("../models/scratchCard");
const { ExamInstances } = require("../models/examInstances");
const classModel = require("../models/class");
const batchAwaitTimeModel = require("../models/batchAwaitTime");
const numberOfQuestionPerSubjectModel = require("../models/numberOFQuestionPerSubject");
// const createToken = require("../auth/jwt");

// const maxAge = 3*24*60*60
// const createToken = (id)=>{
//   // 1st parameter is the payload, 2nd is the secret
// return jwt.sign({id},process.env.SECRET,{
// expiresIn: maxAge
// });
// }

router.get("/", (req, res) => {
  // res.json({message:'successful'})
  res.status(200).render("admin");
});


// create an admin route
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const tEmail = req.body.email.toLowerCase();
    const findAdmin = await adminModel.findOne({ email: tEmail });

    if (findAdmin) {
      if (req.file) deleteUploadImage(req.file.filename);
      return res.status(400).json({ message: `${req.body.email} already exists` });
    }

    const form = new adminModel({
      name: req.body.name,
      email: tEmail,
      password: req.body.password,
      image: req.file?.filename || null,
      role: "admin",
      subscription: "life",
      acctType: "owner",
      isSuspended: false,
      subscriptionStart: null,
      subscriptionEnd: null,
      subscriptionActive: false,
    });

    const data = await form.save();
    res.status(200).json({ message: `${data.name} is now an admin` });
  } catch (error) {
    if (req.file) deleteUploadImage(req.file.filename);
    res.status(400).json({ message: error.message });
  }
});



// verify admin logins
router.post("/verify", async (req, res, next) => {
  try {
    const {email,password} = req.body
    // return console.log(req.body)
    const tEmail = email.toLowerCase()
    const admin = await adminModel.login(tEmail,password)
    // console.log(admin)
    if(admin.error){
      return res.status(404).json({message : admin.error})
    }
    if(admin.isSuspended == true){
      return res.status(400).json({message : 'Account deactivated'})
    }
    // let token = createToken(admin._id)
    const token = jwt.sign({ id: admin._id }, process.env.SECRET, { expiresIn: '3d' });
    // const image = `${req.protocol}://${req.get('host')}/uploads/${admin.image}`;
    const image = `/uploads/${admin.image}`;

    res.cookie('adminCookie', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use true in production
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
      sameSite: 'Strict', // Adjust based on your setup
      path: '/'
    });

    // console.log('Cookie sent:', res.get('Set-Cookie'));
      // console.log('cookie :', req.cookies)
    res.status(200).json({name: admin.name,email , image, role: admin.role, subscription: admin.subscription });
  
  } catch (error) {
    console.log(error);
  
    if (error.message === 'incorrect Email') {
      return res.status(404).json({ message: 'Email is not registered' });
    } else if (error.message === 'incorrect Password') {
      return res.status(400).json({ message: 'Password is incorrect' });
    } else {
      return res.status(500).json({ message: 'Something went wrong' });
    }
  }
});


// Helper function to shuffle array
function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

// Format questions with images
function formatQuestions(subject ,numOfQuestions) {
  const shuffled = shuffleArray(subject.questions).slice(0, numOfQuestions?.numberOfQuestionPerSubject || 50);
  return shuffled.map(q => ({
    _id: q._id,
    subjectName: subject.name,
    subjectId: subject._id,
    question: q.question,
    option_A: q.option_A,
    option_B: q.option_B,
    option_C: q.option_C,
    option_D: q.option_D,
    answer: q.answer,
    selectedOption: "",
    image: q.image ? `/uploads/${q.image}` : null
  }));
}

// Get subject timer (fallback to default if not found)
function getSubjectTimer(classDoc, subjectId) {
  const timerObj = classDoc.subjectTimers?.find(t => t.subjectId.toString() === subjectId.toString());
  return timerObj ? timerObj.timer : classDoc.defaultTimer || 30;
}

// Batched login handler
async function handleBatchedLogin(req, res, candidate, classDoc, examInstnc, token,numOfQuestions) {
  const subjectList = candidate.subject;
  if (!subjectList || subjectList.length === 0) {
    return res.status(400).json({ error: 'No subject found for candidate' });
  }

  const subjectNames = subjectList.map(S=> S.name)

// Step 1
const getListSubject = subjectList.map(S => ({
  name: S.name,
  subjectId: String(S._id)
}));

// Step 2: Fallback to empty array if completedSubjectTimes is null or undefined
const completedIds = new Set(
  (examInstnc?.completedSubjectTimes || []).map(y => String(y.subjectId))
);

// Step 3
const getSubjectStatus = getListSubject.map(D => ({
  subjectNames: D.name,
  isComplete: completedIds.has(D.subjectId)
}));



  const image = candidate.image ? `/uploads/${candidate.image}` : '';

  // Set cookie
  res.cookie('studentExamCookie', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3 * 24 * 60 * 60 * 1000,
    sameSite: 'Strict',
    path: '/'
  });

  // If exam instance already exists
  if (examInstnc) {
    const completed = examInstnc.completedSubjectIds || [];

    // Find the next uncompleted subject
    const nextSubject = examInstnc.subject.find(s => !completed.includes(s._id.toString()) && !s.isCompleted);

    if (!nextSubject) {
      if (!examInstnc.isCompleted) {
        examInstnc.isCompleted = true;
        await examInstnc.save();
      }
      return res.status(200).json({ message: "All subjects completed", image, isCompleted: true });
    }

    //-----------------------------------------------------------------------
        // Wait interval logic
        try {
          const batchConfig = await batchAwaitTimeModel.findOne({admin: candidate?.admin});
          const awaitTimeInMinutes = batchConfig?.batchAwaitTime || 15;
    
          const completedTimes = examInstnc.completedSubjectTimes || [];
          const lastCompleted = completedTimes[completedTimes.length - 1];
    
          if (lastCompleted) {
            const now = new Date();
            const completedAt = new Date(lastCompleted.completedAt);
            const elapsedMinutes = (now - completedAt) / (1000 * 60);
    
            if (elapsedMinutes < awaitTimeInMinutes) {
              const remaining = Math.ceil(awaitTimeInMinutes - elapsedMinutes);
              return res.status(200).json({
                message: `Please wait ${remaining} more minute(s) before taking the next exam.`,
                wait: true,
                remainingMinutes: remaining
              });
            }
          }
        } catch (error) {
          console.error("Error checking batch wait time:", error);
        }
        //----------------------------------------------------------------------------

    // Find the timer for the next subject
    let timer = "0";
    if (Array.isArray(examInstnc.subjectTimers)) {
      const timerEntry = examInstnc.subjectTimers.find(t => t.subjectId.toString() === nextSubject._id.toString());
      if (timerEntry) {
        timer = timerEntry.timer;
      }
    }

    // Respond with only the next subject
    const {
      studentId,
      classId,
      className,
      candidateName,
      profileCode,
      completedSubjectIds,
      isCompleted,
      isBatched
    } = examInstnc.toObject();

    return res.status(200).json({
      message: {
        subject: [nextSubject],
        studentId,
        classId,
        className,
        timer,
        candidateName,
        profileCode,
        completedSubjectIds,
        isCompleted,
        isBatched,
        subjectNames,
        getSubjectStatus
      },
      image,
      fetched: true
    });
  }

  // If this is a new exam instance
  const formattedSubjects = subjectList.map(subject => ({
    _id: subject._id,
    name: subject.name,
    isCompleted: false,
    questions: formatQuestions(subject,numOfQuestions),
    timer: getSubjectTimer(classDoc, subject._id)
  }));

  const subjectTimers = subjectList.map(subject => ({
    subjectId: new mongoose.Types.ObjectId(subject._id),
    timer: getSubjectTimer(classDoc, subject._id).toString()
  }));

  const batchedInstance = new ExamInstances({
    studentId: candidate._id,
    profileCode: candidate.profileCode,
    classId: candidate.classId,
    className: candidate.className,
    timer: candidate.timer,
    candidateName: candidate.candidateName,
    isBatched: true,
    subject: formattedSubjects,
    completedSubjectIds: [],
    subjectTimers,
    phone: candidate.phone,
    endExam: candidate.endExam,
    image,
    isCompleted: false,
    subjectNames,
    getSubjectStatus
  });

  const saved = await batchedInstance.save();
  const firstSubject = saved.subject[0];

  const savedObject = JSON.parse(JSON.stringify(saved));
  savedObject.subject = firstSubject ? [firstSubject] : [];

  // Find matching timer
  let timer = "0";
  if (firstSubject && Array.isArray(savedObject.subjectTimers)) {
    const timerEntry = savedObject.subjectTimers.find(
      entry => entry.subjectId.toString() === firstSubject._id.toString()
    );
    if (timerEntry) {
      timer = timerEntry.timer;
    }
  }

  const {
    studentId,
    classId,
    className,
    candidateName,
    profileCode,
    completedSubjectIds,
    isCompleted,
    isBatched
  } = savedObject;

  return res.status(200).json({
    message: {
      subject: savedObject.subject,
      studentId,
      classId,
      className,
      timer,
      candidateName,
      profileCode,
      completedSubjectIds,
      isCompleted,
      subjectNames,
      getSubjectStatus,
      isBatched
    },
    image,
    fetched: true
  });
}




// Main route
router.post('/verify-login', async (req, res) => {
  try {
    const { profileCode } = req.body;
    if (!profileCode) return res.status(400).json({ error: 'You did not enter a profile code' });

    const candidate = await studentModel.findOne({ profileCode }).populate({
        path: 'subject',
        populate: { path: 'questions' }
      })

    const [ examInstnc, numOfQuestions] = await Promise.all([
      ExamInstances.findOne({ profileCode }),
      numberOfQuestionPerSubjectModel.findOne({ admin: candidate?.admin })
    ]);

    if (!candidate) return res.status(400).json({ error: 'You are not authorized for an exam' });

    const classDoc = await classModel.findById(candidate.classId);
    if (!classDoc) return res.status(404).json({ error: 'Class not found for candidate' });

    const token = jwt.sign({ id: candidate._id }, process.env.SECRET, { expiresIn: '3d' });

    if (classDoc.isBatched) {
      return await handleBatchedLogin(req, res, candidate, classDoc, examInstnc, token ,numOfQuestions);
    }

    // Regular (non-batched) flow
    const copiedSubjects = candidate.subject.map(subject => ({
      _id: subject._id,
      name: subject.name,
      questions: formatQuestions(subject,numOfQuestions)
    }));

    const image = candidate.image ? `/uploads/${candidate.image}` : '';

    res.cookie('studentExamCookie', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3 * 24 * 60 * 60 * 1000,
      sameSite: 'Strict',
      path: '/'
    });

    if (examInstnc) {
      return res.status(200).json({ message: examInstnc, image: examInstnc.image });
    }

    const newExamInstance = new ExamInstances({
      studentId: candidate._id,
      profileCode: candidate.profileCode,
      classId: candidate.classId,
      className: candidate.className,
      timer: candidate.timer,
      candidateName: candidate.candidateName,
      subject: copiedSubjects,
      phone: candidate.phone,
      endExam: candidate.endExam,
      image
    });

    const savedInstance = await newExamInstance.save();
    return res.status(200).json({ message: savedInstance, image: savedInstance.image });

  } catch (error) {
    console.error("Error verifying login:", error);
    if (!res.headersSent) {
      return res.status(500).send("Server error.");
    }
  }
});

router.post('/student-state/:profileCode', async (req, res) => {
  try {
    const { profileCode } = req.params; // Use query parameters
    // console.log(req.params.profileCode)
    // Find student by profileCode
    const examInstnc = await ExamInstances.findOne({ profileCode });
    // If an instance already exists, return it immediately
    if (examInstnc) {
      return res.status(200).json({ message: examInstnc, image: examInstnc.image });
    } else {
      return res.status(404).json({ error: "No exam instance found." });
    }
  } catch (error) {
    console.error("Error fetching student state:", error);
    res.status(500).send("Server error."); 
  }
});


router.get('/headings',async function(req, res) {
  try {
    const headings = await headersModel.find().lean()
    // console.log(headings)
    res.status(200).json({data: headings});
  } catch (error) {
    console.log(error.message)
  }
})



router.get('/student-results/:id',async (req,res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ data: 'Invalid ID' });
    }
    const results = await Result.findById({_id: id});
    if (!results) {
      return res.status(404).json({ data: 'No results found' });
    }
    res.status(200).json({ data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ data: 'Server error' });
  }
})



router.post('/st-check-result', async (req, res) => {
  try {
    const { profileCode, scratchCard } = req.body;

    // Fetch result and scratch card data in parallel
    const [sCard, result] = await Promise.all([
      scratchCardModel.findOne({ card: scratchCard }),
      Result.findOne({ profileCode }),
    ]);
    

    // Ensure result exists for the provided profile code
    if (!result) {
      return res.status(404).json({ error: 'Result not found for this profile code' });
    }

    // Check if the result already has a scratch card associated
    if (result.scratchCard) {
      // If the scratch card is different, check its validity
      if (result.scratchCard !== scratchCard) {
        if (!sCard) {
          return res.status(400).json({ error: 'This scratch card is either used or wrong' });
        }
        // Assign the new valid scratch card
        result.count = 1;
        result.scratchCard = scratchCard;
        await Promise.all([ result.save(),scratchCardModel.findByIdAndDelete( { _id: sCard._id })])
        return res.status(200).json({ markedResult: result._id });
      }

      // Enforce maximum usage of scratch card (3 times)
      if (result.count >= 3) {
        return res.status(400).json({ error: 'Scratch card limit of 3 time triers has been reached' });
      }

      // Increment the usage count
      result.count += 1;
      await result.save();

      // Return the result
      return res.status(200).json({ markedResult: result._id });
    }

    // For first-time scratch card usage
    if (!sCard) {
      return res.status(400).json({ error: 'Invalid scratch card' });
    }

    
    // Assign scratch card and initialize count
    result.count = 1;
    result.scratchCard = scratchCard;
    await Promise.all([ result.save(),scratchCardModel.findByIdAndDelete( { _id: sCard._id })])
    // await result.save();
    // Remove the scratch card from the database after use
  //  const gg = await scratchCardModel.findByIdAndDelete( { _id: sCard._id });

    // Respond with the result ID
    res.status(200).json({ markedResult: result._id });
  } catch (error) {
    console.error('Error checking result:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


router.post("/student-logout",(req, res) => {
  // console.log('got cookies');
  res.clearCookie('studentExamCookie', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/',
  });
  res.status(200).json({ message: "Candidate logged out successfully" });
});


router.post( "/admin-logout", (req, res) => {
  res.clearCookie('adminCookie', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/',
  });
  res.status(200).json({ message: "Admin logged out successfully" });
});

module.exports = router;