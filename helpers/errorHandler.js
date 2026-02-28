function error(err,req,res,next){
        if(err.name === 'unauthorizedError'){
         return res.status(401).json({message:'unauthorized user'})
        }
        if(err.name === 'validationError'){
        return  res.status(401).json({message:err})
        }
        return  res.status(500).json({message:err})
      }

module.exports = error