const mongoose = require("mongoose");


const userOTPSchema = new mongoose.Schema ({
    userId :{
        type: mongoose.Schema.Types.ObjectId,
        ref= 'User',
        required: true,
    },
    otp: {
        type: String,
        required : true,
    },
    otpExpiresAt :{
        type : Date,
        required: true,
    },
    createdAt:{
        type: Date,
        default: Date.now,
        expires: 300,
    },

});

module.exports = mongoose.model('userOTP',userOTPSchema);