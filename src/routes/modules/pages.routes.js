'use strict';
const auth = require("../../validation/authValidation");
const dienNuocController = require("../../controllers/dienNuocController");
const loadcommentController = require("../../controllers/loadcommentController");
const loginController = require("../../controllers/loginController");
const orderController = require("../../controllers/orderController");
const profileController = require("../../controllers/profileController");
const publicJourneyController = require("../../controllers/publicJourneyController");
const readcommentController = require("../../controllers/readcommentController");
const registerController = require("../../controllers/registerController");
const { REGISTER_PATH } = require('../../configs/constants');
const { webAuth, requireAdmin } = require('../../middleware/jwtAuth');
const shipping = require('../../services/shippingAccounts');

module.exports = function registerPageRoutes(router) {
    router.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.user) return next();
        try {
            res.locals.activeCarrier = (await shipping.getDefault())?.carrier || null;
        } catch (error) {
            console.error('Lỗi đọc hãng lên đơn mặc định:', error.code || error.message);
            res.locals.activeCarrier = null;
        }
        next();
    });

    router.get('/khachhang', webAuth, function (req, res) {
        res.render('khachhang', { user: req.user });
    });

    router.get('/readcomment', webAuth, readcommentController.handleReadComment);

    router.get("/", webAuth, loadcommentController.handleLoadComment);
    router.get("/admin", webAuth, requireAdmin, profileController.handleProfile);
    router.get("/admin/users", webAuth, requireAdmin, (req, res) => res.render("adminUsers", { user: req.user, registerPath: REGISTER_PATH }));
    router.get("/profile", webAuth, require("../../controllers/personalProfileController").show);
    router.post('/profile/info', webAuth, require('../../controllers/personalProfileController').updateProfile);
    router.post('/profile/revoke-sessions', webAuth, require('../../controllers/personalProfileController').revokeSessions);
    router.post("/changepass", webAuth, require("../../controllers/personalProfileController").changePassword);
    router.get("/diennuoc", webAuth, dienNuocController.handleDienNuoc);
    router.get("/donhang", webAuth, orderController.handleOrder);

    router.get("/journey", publicJourneyController.handleJourneySearch);
    router.get("/journey/:madonhang", publicJourneyController.handleJourneyDetail);
    router.get("/login", loginController.checkLoggedOut, loginController.getPageLogin);
    router.post("/login", loginController.handleLogin);

    router.get(REGISTER_PATH, webAuth, requireAdmin, registerController.getPageRegister);//register
    router.post(REGISTER_PATH, webAuth, requireAdmin, auth.validateRegister, registerController.createNewUser);
    router.post("/logout", (req, res, next) => {
        res.clearCookie('token');
        loginController.postLogOut(req, res, next);
    });
};
