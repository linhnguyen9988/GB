const apiAuth = require('../api/auth');
const apiCustomers = require('../api/customers');
const apiDashboard = require('../api/dashboard');
const apiLivecomments = require('../api/livecomments');
const apiMessages = require('../api/messages');
const apiNotifications = require('../api/notifications');
const apiOrders = require('../api/orders');
const apiPages = require('../api/pages');
const apiLucky = require('../api/lucky');

module.exports = function registerApiRoutes(app) {
    app.use('/api/auth', apiAuth);
    app.use('/api/dashboard', apiDashboard);
    app.use('/api/messages', apiMessages);
    app.use('/api/livecomments', apiLivecomments);
    app.use('/api/customers', apiCustomers);
    app.use('/api/orders', apiOrders);
    app.use('/api/pages', apiPages);
    app.use('/api/notifications', apiNotifications);
    app.use('/api/lucky', apiLucky);
};
