const express = require("express");
const router = express.Router();
// const { adminSignIn, adminLogout,dashboard} = require("../controllers/admin/adminController");
const adminController=require('../controllers/admin/adminController')
const authMiddleware = require('../middlewares/adminAuth');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const coupenController = require('../controllers/admin/coupenController');
const upload = require('../middlewares/multer');
const multer = require('multer');
// const upload = multer({storage:storage});

router.get('/login',authMiddleware.isLogin,adminController.loadsignin);
router.post('/login',adminController.adminSignIn);
router.get('/logout',adminController.adminLogout);
router.get("/dashboard", authMiddleware.checkSession, adminController.loadDashboard);

router.get("/customers",authMiddleware.checkSession,customerController.customerInfo);
router.get("/blockCustomer",authMiddleware.checkSession,customerController.customerBlocked);
router.get("/unblockCustomer",authMiddleware.checkSession,customerController.customerunBlocked);


router.get('/category',authMiddleware.checkSession,categoryController.categoryInfo);
router.post('/addCategory',categoryController.addCategory);
router.get("/listCategory",authMiddleware.checkSession,categoryController.getListCategory);
router.get('/unlistCategory',authMiddleware.checkSession,categoryController.getUnlistCategory);
router.get('/editCategory',authMiddleware.checkSession,categoryController.getEditCategory);
router.post('/editCategory/:id',categoryController.editCategory);
router.post('/addCategoryOffer',categoryController.addCategoryOffer);
router.post('/removeCategoryOffer',categoryController.removeCategoryOffer)


router.get('/products',productController.getProdutPage);
router.get('/addProducts',productController.getProductAddPage);
router.post('/addProducts', upload.array("productImages"), productController.addProducts);
router.get('/editProduct/:id',productController.getEditProduct);
router.post("/editProduct/:id",authMiddleware.checkSession, upload.array("productImages"), productController.editProduct);
router.post('/deleteImage',authMiddleware.checkSession,productController.deleteSingleImage);
router.get('/blockProduct',authMiddleware.checkSession,productController.blockProduct);
router.get('/unblockProduct',authMiddleware.checkSession,productController.unblockProduct);



router.get('/orders',authMiddleware.checkSession,orderController.getAllOrders);
router.get('/order-details/:orderId',authMiddleware.checkSession,orderController.getOrderDetails);
router.post('/orders/:orderId/update-status',orderController.updateOrderStatus);

router.get('/returnOrders',authMiddleware.checkSession,orderController.getReturnOrders);
router.post('/returns/accept/:orderId/:itemId', orderController.acceptReturn);
router.post('/returns/reject/:orderId/:itemId', orderController.rejectReturn);


router.get('/coupons', coupenController.getCoupons); 
router.post('/coupons', coupenController.addCoupon);
router.post('/coupons/delete/:id', coupenController.deleteCoupon);


module.exports = router;