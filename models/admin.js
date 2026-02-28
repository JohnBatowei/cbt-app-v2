const mongoose = require("mongoose");
const bcrypt = require('bcrypt')
// const jwt = require('jsonwebtoken')

//3 level users, admin, user, trier
// const {isEmail} = require('validator')
const adminSchema = new mongoose.Schema(
  {
    name: {
        type: String,
        default: 'Admin'
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
    //   validate: [isEmail, 'please enter a valid email']
    },
    password: {
      type: String,
      // required: [true,'Please enter a password'],
    //   minlength: [6,'your password should be more than 6 characters']
    },
    image:{
      type: String, default: null,
    },
    role: {type: String, enum: ["admin", "user", "trier"], default : null},
    subscription: { type: String, enum: ["one_year", "two_year", "six_month", "three_month", "one_month", "life"], default: null },
    // subscription: { type : String, default : 'life'},
    acctType: { type : String, default : 'owner'},
    isSuspended: { type: Boolean, default: false },
    subscriptionStart: { type: Date, default: null },
    subscriptionEnd: { type: Date, default: null },
    subscriptionActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);


// fire a function after a user has been  saved
adminSchema.post('save',function(doc,next){
  console.log('new user was saved')
  next()
})

// fire a function before a user has been  saved
adminSchema.pre('save',async function(next){
  // console.log('admin is about to be saved', this)
  if(this.isModified('password') && this.password && this.password.trim() !== ''){
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password,salt)
  }
  next()
})

// lets verify the isAdmin with the static mathod
adminSchema.statics.login = async function(email, password){

  const admin = await this.findOne({email})
  // console.log(email, admin.email);
  if(!admin) return {error: 'incorrect Email'};
  const auth = await bcrypt.compare(password, admin.password)
  if(!auth) return {error:'incorrect Password'}; 
  return admin
   
}


const adminModel = mongoose.model("admine", adminSchema);

module.exports = adminModel;
