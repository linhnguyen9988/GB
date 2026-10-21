import auth from "../../validation/authValidation";
import dienNuocController from "../../controllers/dienNuocController";
import loadcommentController from "../../controllers/loadcommentController";
import loginController from "../../controllers/loginController";
import orderController from "../../controllers/orderController";
import profileController from "../../controllers/profileController";
import publicJourneyController from "../../controllers/publicJourneyController";
import readcommentController from "../../controllers/readcommentController";
import registerController from "../../controllers/registerController";
const { REGISTER_PATH } = require('../../configs/constants');
const { webAuth } = require('../../middleware/jwtAuth');

module.exports = function registerPageRoutes(router) {
    router.get('/khachhang', webAuth, function (req, res) {
        res.render('khachhang', { user: req.user });
    });

    router.get('/readcomment', webAuth, readcommentController.handleReadComment);

    router.get("/", webAuth, loadcommentController.handleLoadComment);
    router.get("/profile", webAuth, profileController.handleProfile);
    router.get("/diennuoc", webAuth, dienNuocController.handleDienNuoc);
    router.get("/donhang", webAuth, orderController.handleOrder);

    router.get("/journey", publicJourneyController.handleJourneySearch);
    router.get("/journey/:madonhang", publicJourneyController.handleJourneyDetail);
    router.get("/login", loginController.checkLoggedOut, loginController.getPageLogin);
    router.post("/login", loginController.handleLogin);

    router.get(REGISTER_PATH, registerController.getPageRegister);//register
    router.post(REGISTER_PATH, auth.validateRegister, registerController.createNewUser);
    router.post("/logout", (req, res, next) => {
        res.clearCookie('token');
        loginController.postLogOut(req, res, next);
    });
};
