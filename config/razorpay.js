const Razorpay = require('razorpay');
require('dotenv').config();

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Validation check
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('❌ RAZORPAY CREDENTIALS MISSING IN .env FILE');
    console.error('Please ensure .env contains:');
    console.error('RAZORPAY_KEY_ID=your_key_id');
    console.error('RAZORPAY_KEY_SECRET=your_key_secret');
}

module.exports = razorpayInstance;