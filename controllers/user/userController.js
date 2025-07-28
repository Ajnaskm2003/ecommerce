const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const path = require("path");
const crypto = require('crypto');
const nodemailer = require('nodemailer');

exports.showSignup = (req, res) => {
    res.render('signup');
};

const loadSignup = async (req, res) => {
    try {
        return res.render('signup');
    } catch (error) {
        console.log('Homepage not loading:', error);
        res.status(500).send("Server error");
    }
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const loadOtpPage = (req, res) => {
    res.render('verifyotp', { message: req.flash('error') });
};

const signup = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    try {
        if (password !== confirmPassword) {
            req.flash('error', 'Password does not match');
            return res.redirect('/signup');
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            req.flash('error', 'User already exists');
            return res.redirect('/signup');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.otp = otp; 
        req.session.signupData = { name, email, password };

        console.log('Details:', req.session.signupData);

        const sendOtpEmail = async (email, otp) => {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Your OTP for Sign-up verification',
                text: `Your OTP is: ${otp}`, // 
            };
            console.log(otp)

            try {
                await transporter.sendMail(mailOptions);
                console.log('OTP email sent successfully');
            } catch (error) {
                console.error('Error sending OTP email:', error);
            }
        };
        req.session.userEmail=email
        await sendOtpEmail(email, otp); 
        res.redirect('/verifyotp'); 

    } catch (error) {
        console.log('Error during sign-up:', error);
        req.flash('error', 'An error occurred during sign-up. Please try again');
        res.redirect('/signup');
    }
};

const verifyOtp = async (req, res) => {
    console.log(req.body);
    
    const { otp } = req.body;
    console.log(otp)
    

    try {
        if (otp !== req.session.otp) {
            req.flash('error', 'Invalid OTP, Please try again');
            return res.redirect('/verifyotp');
        }

        console.log('Verify:', req.session.signupData);

        const { name, email, password } = req.session.signupData;
        console.log('Destructure:', name);
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Hashed:', hashedPassword);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
        });

        await newUser.save();
        console.log('Saved:', newUser);

        delete req.session.otp;
        delete req.session.signupData;


        req.flash('success', 'Account created successfully! Please log in');
        console.log('finish');
        res.redirect('/signin');
        

    } catch (error) {
        console.error(error);
        req.flash('error', 'Error occurred, please try again');
        res.redirect('/verifyotp');
    }
};

const loadSignin = (req, res) => {
    res.render('signin', { message: req.flash('error') });
};

const signin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/signin');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash('error', 'Invalid password');
            return res.redirect('/signin');
        }

        // Set session with secure options
        req.session.user = {
            id: user._id,
            email: user.email,
            name: user.name
        };

        // Set secure cookie options
        req.session.cookie.secure = process.env.NODE_ENV === 'production';
        req.session.cookie.httpOnly = true;
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours

        // Set headers for no caching
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        return res.redirect('/');
    } catch (error) {
        console.error('Signin error:', error);
        req.flash('error', 'Something went wrong');
        return res.redirect('/signin');
    }
};

const pageNotFound = async (req, res) => {
    try {
        res.render("page-404");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
   

      
        if (user) {
            if (user.isBlocked) {
                console.log('User is blocked');
                req.session.destroy()
               return  res.render('login')
            } else {
                res.render('home', { user });
            }
        } else {
            res.render('home')
       }
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("Server error");
    }
};




const resendOtp = async (req, res) => {
    try {
      const email = req.session.userEmail;
      console.log("Session email:", email);
      
      if (!email) {
        return res.status(400).json({ message: 'User email not found in session' });
      }
  
      
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      req.session.otp = newOtp;
      req.session.otpExpiry = Date.now() + 600000;
      console.log(`Generated OTP: ${newOtp}`);
  
      
      const sendOtpEmail = async (email, otp) => {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Your OTP for Sign-up Verification',
          text: `Your OTP is: ${otp}`,
        };
  
        try {
          await transporter.sendMail(mailOptions);
          console.log('OTP email sent successfully to:', email);
        } catch (error) {
          console.error('Error sending OTP email:', error);
          throw new Error('Failed to send OTP email');
        }
      };
  
      await sendOtpEmail(email, newOtp);
  
      res.redirect('/verifyotp');
    } catch (error) {
      console.error('Error resending OTP:', error);
      res.status(500).json({ message: 'Failed to resend OTP' });
    }
};
  

const logout = (req,res) =>{
    req.session.destroy();
    res.redirect('/signin');
}


module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    loadSignin,
    signin,
    loadOtpPage,
    verifyOtp,
    logout,
    resendOtp
    
};
