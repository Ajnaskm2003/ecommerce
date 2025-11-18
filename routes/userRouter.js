const express = require("express");
const router = express.Router();
const passport = require('passport');
const userController = require("../controllers/user/userController");
const Auth=require('../middlewares/auhtMiddleware');
const productController = require("../controllers/user/productController");
const profileController = require("../controllers/user/profileController");
const addressController = require('../controllers/user/addressController');
const cartController = require('../controllers/user/cartController');
const wishlistController = require('../controllers/user/wishlistController');
const checkoutController = require('../controllers/user/checkoutController');
const orderController = require("../controllers/user/orderController");
const walletController = require("../controllers/user/walletController");
const razorpayController = require("../controllers/user/razorpayController");
const couponController = require("../controllers/user/couponController");
const forgotPasswordController = require("../controllers/user/forgotPasswordController");
const upload = require('../middlewares/multer');
const multer = require('multer');



const cacheControl = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
};



router.get("/pageNotFound",userController.pageNotFound);
router.get("/signup",Auth.isLogin,userController.loadSignup);
router.post("/signup", userController.signup);
router.get('/verifyotp',Auth.isLogin,userController.loadOtpPage);
router.post('/verifyotp',userController.verifyOtp);
router.get('/signin', 
    (req, res, next) => {
        console.log("Session at signin:", req.session);
        next();
    }, 
    Auth.redirectIfLoggedIn, 
    userController.loadSignin 
);




router.post('/signin', cacheControl, userController.signin);
router.get('/',userController.loadHomepage);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get(
  '/auth/google/callback',
  (req, res, next) => {
    if (req.query.error) {
      console.log('Google authentication failed:', req.query.error);
      return res.redirect('/home?error=google_auth_failed');
    }
    next();
  },
  passport.authenticate('google', { failureRedirect: '/signup' }),
  (req, res) => {
    try {
      console.log('Google authentication success');

      req.session.user = {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name || 'Unknown User', 
      };

    
      req.session.cookie.secure = process.env.NODE_ENV === 'production'; 
      req.session.cookie.httpOnly = true; 
      req.session.cookie.maxAge = 24 * 60 * 60 * 1000;

      
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.redirect('/');
    } catch (error) {
      console.error('Google auth callback error:', error);
      req.flash('error', 'Something went wrong with Google authentication');
      res.redirect('/signup');
    }
  }
);
  

router.post('/resend-otp',userController.resendOtp)
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Session destroy error:", err);
            return res.status(500).send("Logout failed");
        }

        res.clearCookie('connect.sid'); 
        res.redirect('/signin'); 
    });
});


router.get('/forgot-password',forgotPasswordController.getForgotPasswordPage);
router.post('/forgot-password/send-otp',forgotPasswordController.forgotSendOtp);
router.post('/forgot-password/verify-otp',forgotPasswordController.forgotVerifyOtp);
router.get('/change-password', forgotPasswordController.renderChangePassword);
router.post('/reset-password', forgotPasswordController.resetPassword);



router.get('/shop',productController.getAllProducts);


router.get('/product',productController.getProductDetails);
router.get('/order-details/orderid/:orderId/invoice', productController.downloadInvoice);



router.get('/userProfile',Auth.checkSession,profileController.userProfile);
router.get('/myInfo',Auth.checkSession,profileController.myInfo);
router.post('/updateInfo',upload.single("image"),profileController.updateInfo);
router.post('/changePassword',profileController.changePassword);

router.post('/send-email-otp',profileController.sendEmailOtp);
router.post('/verify-email-otp',profileController.verifyEmailOtp);

router.get('/my-address',addressController.getAddresses);
router.post('/add-address',addressController.addAddress);
router.post("/edit-address", addressController.editAddress);
router.post("/delete-address/:addressId",addressController.deleteAddress);



router.get('/wishlist',wishlistController.getWishlist)
router.post('/wishlist-add',wishlistController.addToWishlist);
router.post('/wishlist/remove',wishlistController.removeFromWishlist);



router.post("/cart/add", cartController.addToCart);
router.post("/cart/increment", cartController.incrementCartItem);
router.post("/cart/decrement", cartController.decrementCartItem);
router.post("/cart/remove", cartController.decrementOrRemoveCartItem);
router.get("/cart", Auth.checkSession, Auth.checkOrderPlaced,  cartController.getCart);


router.get("/checkout", Auth.checkSession, Auth.checkOrderPlaced, Auth.checkCartAccess, checkoutController.getCheckoutPage);
router.post("/order/place", checkoutController.placeOrder);
router.post("/address/add",checkoutController.addAddress);
router.post("/place",checkoutController.placedOrder);
router.get("/order/view/:orderId", checkoutController.viewOrder);
router.get("/address/:id", checkoutController.getAddress); 
router.put('/address/edit/:id', checkoutController.editAddress);
router.get("/api/coupons/active",checkoutController.getActiveCoupons);



router.get('/orders',Auth.checkSession,orderController.getUserOrders);
router.get('/order-details/:id',Auth.checkSession,orderController.viewOrderDetails);
router.get('/cancel-order/:id', orderController.cancelOrder);
router.get('/cancel-item/:orderId/:itemId', orderController.cancelItem);
router.post('/submit-return', orderController.submitReturnRequest);
router.post('/return-item/:orderId/:itemId', orderController.returnItem);


router.get('/wallet/balance', Auth.checkSession, walletController.getWalletBalance);
router.post('/place-order-with-wallet', walletController.placeOrderWithWallet);
router.get('/wallet',Auth.checkSession,walletController.getWalletPage);
router.get('/wallet/history', Auth.checkSession, walletController.getWalletHistory);



router.post('/create-order',razorpayController.createOrder);
router.post('/verify-payment',razorpayController.verifyPayment);
router.get('/retry-payment', razorpayController.showRetryPage);
router.post('/retry-payment/initiate', razorpayController.initiateRetry);
router.post('/retry-payment/mark-failed',razorpayController.markFailed);

router.get("/coupons/active", couponController.getActiveCoupons);
router.post('/apply-coupon', couponController.applyCoupon);
router.get('/get-wallet-balance', Auth.checkSession, checkoutController.getWalletBalance);










module.exports = router;