const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const emailOtpStorage = {};


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


const getForgotPasswordPage = async (req,res) => {
    try {
        
        res.render('forgetPass');

    } catch (error) {
        
    }
}


const forgotSendOtp = async (req,res) => {
    try {

        const { email } = req.body;

    const existingUser = await User.findOne({ email });

    if(!existingUser) {
        return res.status(400).json({ success: false, message: 'Email not registered'});
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    emailOtpStorage[email] = otp;

    console.log("OTP for", email, ":", otp);

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`
    });

    res.status(200).json({ success: true, message: "Otp sent to your email"});
        
    } catch (error) {
        console.log("Error sending OTP:",error);
        res.status(500).json({ success: false, message: "Error sending OTP. Please try again later."});
    }
};


const forgotVerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log('Verify OTP - Email:', email, 'OTP:', otp, 'Type:', typeof otp); 
    console.log('Stored OTP:', emailOtpStorage[email], 'Type:', typeof emailOtpStorage[email]); 

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please fill out the field' });
    }

    if (!emailOtpStorage[email]) {
      return res.status(400).json({ success: false, message: 'No OTP found for this email or OTP expired' });
    }

    if (String(emailOtpStorage[email]) !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    delete emailOtpStorage[email];
    console.log(`OTP verified for ${email}, storage cleared`);
    res.status(200).json({ success: true, message: 'OTP verified successfully', email });
  } catch (error) {
    console.error('Error verifying OTP:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error verifying OTP. Please try again.' });
  }
};


const renderChangePassword = (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send('Email is required');
    }
    res.render('changePassword', { email });
  } catch (error) {
    console.error('Error rendering change password page:', error.message, error.stack);
    res.status(500).send('Error loading password reset page');
  }
};

const resetPassword = async (req, res) => {
    try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Please fill out the field' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    
    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.log(error)
    console.error('Error resetting password:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to reset password. Please try again.' });
  }
}



module.exports = {
    getForgotPasswordPage,
    forgotSendOtp,
    forgotVerifyOtp,
    renderChangePassword,
    resetPassword
}