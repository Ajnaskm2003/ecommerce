const Razorpay = require('razorpay');
require('dotenv').config();

const razorpayInstance = newRazorpay({
    rzp_test_FPcddXuOor5zgx : process.env.RAZORPAY_KEY_ID,
    LOldUzl85R5zp9By7L2QgvWQ : process.env.RAZORPAY_KEY_SECRET
});

module.exports = razorpayInstance;