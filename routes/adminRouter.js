const express = require("express");
const router = express.Router();
const adminController=require('../controllers/admin/adminController')
const authMiddleware = require('../middlewares/adminAuth');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const coupenController = require('../controllers/admin/coupenController');
const salesController = require('../controllers/admin/salesController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/products');
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    },
    limits: {
        fileSize: 5 * 1024 * 1024 
    }
});


router.get('/login',authMiddleware.isLogin,adminController.loadsignin);
router.post('/login',adminController.adminSignIn);
router.get('/logout',adminController.adminLogout);


router.get("/dashboard", authMiddleware.checkSession, adminController.loadDashboard);
router.get("/api/sales",          adminController.getSalesTrend);
router.get("/api/top-products",   adminController.getTopProducts);
router.get("/api/top-categories", adminController.getTopCategories);


router.get("/customers",authMiddleware.checkSession,customerController.customerInfo);
router.get("/blockCustomer",authMiddleware.checkSession,customerController.customerBlocked);
router.get("/unblockCustomer",authMiddleware.checkSession,customerController.customerunBlocked);


router.get('/category',authMiddleware.checkSession,categoryController.categoryInfo);
router.post('/addCategory',categoryController.addCategory);
router.get("/listCategory",authMiddleware.checkSession,categoryController.getListCategory);
router.get('/unlistCategory',authMiddleware.checkSession,categoryController.getUnlistCategory);
router.get('/editCategory',authMiddleware.checkSession,categoryController.getEditCategory);
router.post('/updateCategory',categoryController.updateCategory);
router.post('/addCategoryOffer',categoryController.addCategoryOffer);
router.post('/removeCategoryOffer',categoryController.removeCategoryOffer);


router.get('/products',productController.getProductPage);
router.get('/addProducts',productController.getProductAddPage);
router.post('/addProducts', 
    authMiddleware.checkSession,
    upload.array('productImages', 5),
    (req, res) => {
        productController.addProducts(req, res).catch(error => {
            console.error('Error in addProducts:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add product'
            });
        });
    }
);
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



router.get('/salesReport',authMiddleware.checkSession,salesController.getSalesReport);
router.get('/sales-report/download',salesController.downloadSalesReport);
router.get('/sales-report/download-excel', salesController.downloadSalesReportExcel);


router.get('/coupons', coupenController.getCoupons); 
router.post('/coupons', upload.none(), coupenController.addCoupon); 
router.post('/coupons/delete/:id', coupenController.deleteCoupon);
router.post('/coupons/edit/:id', coupenController.editCoupon);


module.exports = router;