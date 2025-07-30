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
const upload = require('../middlewares/multer');
const multer = require('multer');

// Add this middleware at the top
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
router.get("/signin", cacheControl,Auth.isLogin, userController.loadSignin);
router.post('/signin', cacheControl, userController.signin);
router.get('/',userController.loadHomepage);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get(
    "/auth/google/callback",
    (req, res, next) => {
      if (req.query.error) {
        console.log("Google authentication failed:", req.query.error);
        return res.redirect("/home?error=google_auth_failed"); 
      }
      next();
    },
    passport.authenticate("google", { failureRedirect: "/signup" }),
    (req, res) => {
      console.log("Google authentication success");
            req.session.user=req.user._id
    
            
            
      res.redirect("/");
    }
  );
  

router.post('/resend-otp',userController.resendOtp)
router.get('/logout', cacheControl, (req, res) => {
    req.session.destroy();
    sessionStorage.removeItem('isLoggedIn');
    res.redirect('/signin');
});



router.get('/shop',productController.getAllProducts);


router.get('/product',productController.getProductDetails);



router.get('/userProfile',Auth.checkSession,profileController.userProfile);
router.get('/myInfo',Auth.checkSession,profileController.myInfo);
router.post('/updateInfo',upload.single("image"),profileController.updateInfo);
router.post('/changePassword',profileController.changePassword);

router.post('/send-email-otp',profileController.sendEmailOtp);
router.post('/verify-email-otp',profileController.verifyEmailOtp);

router.get('/my-address',addressController.getAddresses);
router.post('/add-address',addressController.addAddress);
router.post("/edit-address", addressController.editAddress);



router.get('/wishlist',wishlistController.getWishlist)
router.post('/wishlist-add',wishlistController.addToWishlist);



router.post("/cart/add", cartController.addToCart);
router.post("/cart/increment", cartController.incrementCartItem);
router.post("/cart/decrement", cartController.decrementCartItem);
router.post("/cart/remove", cartController.decrementOrRemoveCartItem);
router.get("/cart", Auth.checkSession, Auth.checkOrderPlaced, Auth.checkCartAccess, cartController.getCart);


router.get("/checkout", Auth.checkSession, Auth.checkOrderPlaced, Auth.checkCartAccess, checkoutController.getCheckoutPage);
router.post("/order/place", checkoutController.placeOrder);
router.post("/address/add",checkoutController.addAddress);
router.post("/place",checkoutController.placedOrder);
router.get("/order/view/:orderId",checkoutController.viewOrder);

router.get('/orders',Auth.checkSession,orderController.getUserOrders);
router.get('/order-details/:id',Auth.checkSession,orderController.viewOrderDetails);
router.get('/cancel-order/:id', orderController.cancelOrder);
router.post('/submit-return', orderController.submitReturnRequest);

router.get('/wallet/balance', Auth.checkSession, walletController.getWalletBalance);
router.post('/place-order-with-wallet', Auth.checkSession, walletController.placeOrderWithWallet);


router.get('/wallet',Auth.checkSession,walletController.getWalletPage);

router.post('/create-order',razorpayController.createOrder);
router.post('/verify-payment',razorpayController.verifyPayment);

router.post('/apply-coupon', couponController.applyCoupon);












module.exports = router;