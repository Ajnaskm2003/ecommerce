const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const path=require('path');
const nodemailer = require('nodemailer');
let emailOtpStorage = {};


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});






const userProfile = async(req,res) =>{
    try {
        
        const userId = req.session.user.id;

        const userData = await User.findById(userId)
        
        
        res.render('profile',{
            user:userData,
        })


    } catch (error) {
        
        console.error("error in retrive profile data ",error );
        res.redirect("/pageNotFound");
        
    }
}


const myInfo = async (req, res) => {
    try {
        const email = req.session.user?.email;

        if (!email) {
            return res.redirect('/signin'); // no session set
        }

        let userData = await User.findOne({ email });

        // If not found, fallback to session user (Google login case)
        if (!userData && req.session.user) {
            userData = {
                name: req.session.user.name || 'Unknown User',
                email: req.session.user.email,
                phone: req.session.user.phone || '',
                image: req.session.user.image || '/images/default-profile.png' // Fallback image
            };
        } else {
            // Ensure image has a fallback even for database users
            userData.image = userData.image || '/images/default-profile.png';
            userData.phone = userData.phone || ''; // Fallback for phone if not set
        }

        res.render('myprofile', {
            data: userData,
        });

    } catch (error) {
        console.log('Error in myInfo:', error);
        res.redirect('/pageNotFound');
    }
};

const updateInfo = async (req,res) =>{

    try {   
        console.log('1')     
        const {name,phone} = req.body;
        const userId = req.session.user.id;


        let profileImage = req.session.user.image;
        console.log(profileImage)
        if(req.file){
            profileImage = `/uploads/temp/${req.file.filename}`; // Store only relative path
        }
        

        const updatedUser = await User.findByIdAndUpdate(userId,{
            name:name,
            phone:phone,
            image:profileImage,
            
        },{new:true});

        console.log(updatedUser);
        

        if (!updatedUser) {
            return res.json({success:false, message: "User not found" });
        }

        req.session.user.name = updatedUser.name;
        req.session.user.phone = updatedUser.phone;
        req.session.user.image = updatedUser.image;

       res.json({success:true,message:"edited successfully",redirectUrl:'/myInfo'})

    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound')

        
    }


};


const changePassword = async (req,res)=>{
    try {
        
        const{currentPassword, newPassword} = req.body;
        const userId = req.session.user.id;

        const user = await User.findById(userId);
        if(!user){
            return res.json({success : false, message:"user Not Found"});

        }

        const isMatch = await bcrypt.compare(currentPassword,user.password);

        if(!isMatch){
            return res.json({success:false,message: "Current password is incorect"});
        }

        const hashedPassword = await bcrypt.hash(newPassword,10);
        user.password = hashedPassword;

        await user.save();

        res.json({success: true,message : "password updated successfully"});

    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound');
        
    }
};



const sendEmailOtp = async (req,res)=>{
    try {
    
        const {email} = req.body;

        const existingUser = await User.findOne({ email });
        if(existingUser) {
            return res.json({seccess: false, message: "Email already in use"});

        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        emailOtpStorage[email] = otp;
        console.log(otp);
        

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP forr email change",
            text:`Your OTP code is : ${otp}`
        });

        res.json({ success :  true , messsage: "OTP sent"});


    } catch (error) {
        
        console.error(error,"error sending Otp");
        
        
    }
};


const verifyEmailOtp = async (req,res)=>{
    try {
        
        const {email, otp } = req.body;
        const userId = req.session.user.id;

        console.log(req.session.user)
        console.log(userId)


        if(emailOtpStorage[email] && emailOtpStorage[email] == otp){
            await User.findByIdAndUpdate(userId, {email});

            req.session.user.email = email;
            delete emailOtpStorage[email];

            return res.json({success:true, message:"Email updated successfully "});

        }

        res.json({success:false,message: "Invalid OTP"});

    } catch (error) {
        console.error(error,"error in updating email");
        
    }
};






module.exports  = {
    userProfile,
    myInfo,
    updateInfo,
    changePassword,
    sendEmailOtp,
    verifyEmailOtp,

    
}