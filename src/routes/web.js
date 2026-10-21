import express from "express";

require('../configs/processHandlers');
require('../services/browserService');

const registerMessagesRoutes = require('./modules/messages.routes');
const registerNotificationRoutes = require('./modules/notification.routes');
const registerPrintRoutes = require('./modules/print.routes');
const registerViettelRoutes = require('./modules/viettel.routes');
const registerOrderRoutes = require('./modules/order.routes');
const registerJtexRoutes = require('./modules/jtex.routes');
const registerFacebookRoutes = require('./modules/facebook.routes');
const registerLiveCommentRoutes = require('./modules/liveComment.routes');
const registerCustomerRoutes = require('./modules/customer.routes');
const registerDienNuocRoutes = require('./modules/diennuoc.routes');
const registerPageRoutes = require('./modules/pages.routes');
const registerApiRoutes = require('./modules/api.routes');

const registerJtexWebhook = require('./webhooks/jtex.webhook');
const registerViettelWebhook = require('./webhooks/viettel.webhook');
const registerFacebookWebhook = require('./webhooks/facebook.webhook');
const registerStreamlabsWebhook = require('./webhooks/streamlabs.webhook');

let router = express.Router();

let initWebRoutes = (app) => {
    // --- Webhook (bên thứ ba gọi vào) ---
    registerJtexWebhook(router);
    registerViettelWebhook(router);
    registerFacebookWebhook(router);
    registerStreamlabsWebhook(router);

    // --- Chức năng nghiệp vụ ---
    registerMessagesRoutes(router);
    registerNotificationRoutes(router);
    registerPrintRoutes(router);
    registerViettelRoutes(router);
    registerJtexRoutes(router);
    registerOrderRoutes(router);
    registerFacebookRoutes(router);
    registerLiveCommentRoutes(router);
    registerCustomerRoutes(router);
    registerDienNuocRoutes(router);

    // --- Trang giao diện + đăng nhập ---
    registerPageRoutes(router);

    // --- /api/* (đăng ký trước khi mount router chính, giống bản gốc) ---
    registerApiRoutes(app);

    return app.use("/", router);
};

module.exports = initWebRoutes;
