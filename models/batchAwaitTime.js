const mongoose = require('mongoose');

const batchAwaitTime = new mongoose.Schema({
    batchAwaitTime : {type: Number , default: 15},
    set: {type: Boolean, default: true},
    admin : { type: mongoose.Schema.Types.ObjectId, ref: "admine" }
},{timestamps:true})

const batchAwaitTimeModel = mongoose.model('batchAwaitTime', batchAwaitTime)

module.exports = batchAwaitTimeModel