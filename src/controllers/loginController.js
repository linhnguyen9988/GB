'use strict';
const { validationResult } = require("express-validator");
const loginService = require("../services/loginService");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN, COOKIE_NAME } = require("../configs/jwtConfig");
const { getCareReturnPath, loginPath } = require('../utils/carePath');

let getPageLogin = (req, res) => {
    return res.render("login.ejs", {
        errors: req.flash("errors"),
        returnTo: getCareReturnPath(req.query?.returnTo)
    });
};

let handleLogin = async (req, res) => {
    const returnTo = getCareReturnPath(req.body.returnTo);
    let errorsArr = [];
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        Object.values(validationErrors.mapped()).forEach(item => errorsArr.push(item.msg));
        req.flash("errors", errorsArr);
        return res.redirect(loginPath(returnTo));
    }

    try {
        const user = await loginService.handleLogin(req.body.username, req.body.password);

        const payload = { id: user.id, username: user.username, auth_version: user.auth_version || 0 };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày (ms)
        });

        return res.redirect(returnTo || '/');
    } catch (err) {
        req.flash("errors", err.message || err);
        return res.redirect(loginPath(returnTo));
    }
};

let checkLoggedIn = (req, res, next) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
        return res.redirect("/login");
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie(COOKIE_NAME);
        return res.redirect("/login");
    }
};

let checkLoggedOut = (req, res, next) => {
    const token = req.cookies[COOKIE_NAME];
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            return res.redirect(getCareReturnPath(req.query?.returnTo) || '/');
        } catch (_) {
            res.clearCookie(COOKIE_NAME);
        }
    }
    next();
};

let postLogOut = (req, res) => {
    res.clearCookie(COOKIE_NAME);
    return res.redirect("/login");
};

module.exports = {
    getPageLogin,
    handleLogin,
    checkLoggedIn,
    checkLoggedOut,
    postLogOut,
};
