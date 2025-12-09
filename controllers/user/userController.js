const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const path = require("path");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const session = require('express-session');
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");


const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"Emporium" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your OTP for Emporium - Verify Now',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 30px; background: #f9f9f9; border-radius: 10px;">
        <h2 style="color: #2c3e50;">Emporium OTP Verification</h2>
        <p style="font-size: 18px;">Your verification code is:</p>
        <h1 style="font-size: 40px; color: #e74c3c; letter-spacing: 10px;">${otp}</h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color: #7f8c8d; font-size: 14px;">© 2025 Emporium. All rights reserved.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

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
    res.render('verifyotp', {
        message: req.flash('error')[0] || '',
        success: req.flash('success')[0] || ''
    });
};



const signup = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    try {
        if (!name || name.trim().length < 4) {
            req.flash('error', 'Name must be at least 4 characters long');
            return res.redirect('/signup');
        }
        if (name.trim().length > 10) {
            req.flash('error', 'Name must be 10 characters or less');
            return res.redirect('/signup');
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            req.flash('error', 'Please enter a valid email address');
            return res.redirect('/signup');
        }

        if (!password) {
            req.flash('error', 'Password is required');
            return res.redirect('/signup');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/signup');
        }

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (!strongPasswordRegex.test(password)) {
            req.flash('error', 'Password must be at least 6 characters and contain uppercase, lowercase, and a number');
            return res.redirect('/signup');
        }

        
        await User.deleteOne({ email, isVerified: false });

        const existingUser = await User.findOne({ email, isVerified: true });
        if (existingUser) {
            req.flash('error', 'User already exists with this email');
            return res.redirect('/signup');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        
        const newUser = new User({
            name: name.trim(),
            email,
            password, 
            otp,
            otpExpires: Date.now() + 60 * 1000, 
            isVerified: false
        });

        await newUser.save();

        
        req.session.tempUserId = newUser._id;
        req.session.signupEmail = email;

        console.log('OTP:', otp);

        const sendOtpEmail = async (email, otp) => {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Your OTP for Sign-up Verification - Emporium',
                text: `Your OTP is: ${otp}\n\nThis OTP is valid for 60 seconds only.\nDo not refresh the page.`,
            };
            await transporter.sendMail(mailOptions);
            console.log('OTP email sent successfully to:', email);
        };

        await sendOtpEmail(email, otp);
        res.redirect('/verifyotp');

    } catch (error) {
        console.log('Error during sign-up:', error);
        req.flash('error', 'An error occurred during sign-up. Please try again');
        res.redirect('/signup');
    }
};



const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!otp || otp.toString().trim().length !== 6 || !/^\d+$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 6-digit OTP"
            });
        }

        let user = null;

        if (req.session.tempUserId) {
            user = await User.findOne({
                _id: req.session.tempUserId,
                otp,
                otpExpires: { $gt: Date.now() }
            });
        }

        if (!user && req.session.signupEmail) {
            user = await User.findOne({
                email: req.session.signupEmail,
                otp,
                otpExpires: { $gt: Date.now() }
            });
        }

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        // Success
        user.otp = undefined;
        user.otpExpires = undefined;
        user.isVerified = true;
        user.password = await bcrypt.hash(user.password, 10);
        await user.save();

        req.session.userId = user._id;
        req.session.isLoggedIn = true;
        delete req.session.tempUserId;
        delete req.session.signupEmail;

        return res.status(200).json({
            success: true,
            message: "Account verified successfully! Welcome to Emporium",
            redirect: "/signin"
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again."
        });
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
        let user = null;

        if (req.session.tempUserId) {
            user = await User.findById(req.session.tempUserId);
        }

        if (!user && req.session.signupEmail) {
            user = await User.findOne({
                email: req.session.signupEmail,
                isVerified: false
            });
        }

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Session expired. Please sign up again."
            });
        }

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = newOtp;
        user.otpExpires = Date.now() + 60 * 1000; 
        await user.save();

        console.log(`Resend OTP → ${user.email}: ${newOtp}`);

        await sendOtpEmail(user.email, newOtp);

        return res.json({
            success: true,
            message: "New OTP sent successfully!",
            otp: process.env.NODE_ENV === "development" ? newOtp : undefined
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to resend OTP"
        });
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
