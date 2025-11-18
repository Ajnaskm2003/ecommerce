const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const path = require("path");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const session = require('express-session');
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");

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
                text: `Your OTP is: ${otp}`, 
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
    console.log(otp);
    

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
    res.render('signin', {
        error: req.flash('error')[0] || '',     
        old: req.flash('old')[0] || {}          
    });
};


const signin = async (req, res) => {
    try {
        let { email = '', password = '' } = req.body;

        email = email.trim();

        
        if (!email || !password) {
            const msg = !email && !password 
                ? 'Email and Password are required'
                : !email ? 'Email is required' : 'Password is required';

            req.flash('error', msg);
            req.flash('old', { email: req.body.email || '' });  
            return res.redirect('/signin');
        }

        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error', 'Invalid email or password');
            req.flash('old', { email: req.body.email || '' });
            return res.redirect('/signin');
        }

        if (user.isBlocked) {
            req.flash('error', 'Your account has been blocked. Please contact support.');
            return res.redirect('/pageNotFound');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash('error', 'Invalid email or password');
            req.flash('old', { email: req.body.email || '' });  
            return res.redirect('/signin');
        }

        // Success login
        req.session.user = {
            id: user._id,
            email: user.email,
            name: user.name
        };

        req.session.cookie.secure = process.env.NODE_ENV === 'production';
        req.session.cookie.httpOnly = true;
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        return res.redirect('/');

    } catch (err) {
        console.error('Signin error:', err);
        req.flash('error', 'Something went wrong. Please try again.');
        req.flash('old', { email: req.body.email || '' });
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

        
        const latestProducts = await Product.find({ 
            isBlocked: false, 
            status: 'Available' 
        })
        .sort({ createdOn: -1 })
        .limit(8)
        .populate('category');

        
        let topSelling = [];

        try {
            const aggregationResult = await Order.aggregate([
                
                { $match: { "orderItems.status": "Delivered" } },

                
                { $unwind: "$orderItems" },

               
                { $match: { "orderItems.status": "Delivered" } },

               
                {
                    $group: {
                        _id: "$orderItems.product",
                        totalQty: { $sum: "$orderItems.quantity" }
                    }
                },

                { $sort: { totalQty: -1 } },

                
                { $limit: 8 },

                {
                    $lookup: {
                        from: "products",  
                        localField: "_id",
                        foreignField: "_id",
                        as: "product"
                    }
                },

                { $unwind: "$product" },

                { $replaceRoot: { newRoot: "$product" } }
            ]);

            if (aggregationResult && aggregationResult.length > 0) {
                topSelling = aggregationResult;
            }
        } catch (aggError) {
            console.error("Top-selling aggregation failed:", aggError);
        }

        if (topSelling.length === 0) {
            console.log("No delivered orders → showing latest products in Coming Products");
            topSelling = await Product.find({ 
                isBlocked: false, 
                status: "Available" 
            })
            .sort({ createdOn: -1 })
            .limit(8)
            .populate("category");
        }

        const deals = await Product.find({ 
            isBlocked: false, 
            status: 'Available' 
        })
        .sort({ createdOn: -1 })
        .limit(9)
        .populate('category');

        res.render('home', {
            user,
            latestProducts,
            topSelling,
            deals
        });

    } catch (error) {
        console.error("Homepage load error:", error);
        res.status(500).send("Server Error");
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
  

const logout = async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Error destroying session:", err);
      return res.status(500).send("Could not log out");
    }
    res.redirect('/signin');
  });
};


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
    resendOtp,
    
    
};
