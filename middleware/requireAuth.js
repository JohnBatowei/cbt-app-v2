const jwt = require("jsonwebtoken");
const adminModel = require("../models/admin");


const requireAuth = async (req,res,next)=>{
   
    // verify authorization
    // const { authorization } = req.headers

// console.log(req.headers);
// console.log('i got it');

    // if(!authorization){
    //     return res.status(401).json({message: 'You are not authorize'})
    // }
   
    // 'Bearer uiytiydgkjhuirshthit.jhruishrtshutijkbfyutb.yoioyilfkhofyifk'
    // it comes like this in the string above, so we are using the split array method to grab just the token from the string

    // const token = authorization.split(' ')[1]
    const token = req.cookies.adminCookie;
    // console.log('admin verify',token)
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const {id} = jwt.verify(token, process.env.SECRET)
        // console.log(id);
        // req.admin = await adminModel.findOne({_id:id}).select('_id')
        req.adminModel = await adminModel.findOne({_id:id})
        req.admin = req.adminModel._id
        req.adminRole = req.adminModel.role
        // console.log(req.admin);
        next()
    } catch (error) {
        console.log(error)
        res.status(401).json({message: 'Request not authorized'})
    }
}

module.exports = requireAuth