import { validationResult } from "express-validator";
import loginService from "../services/loginService";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
const COOKIE_NAME = "token";

let getPageLogin = (req, res) => {
    return res.render("login.ejs", {
        errors: req.flash("errors")
    });
};

let handleLogin = async (req, res) => {
    let errorsArr = [];
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        Object.values(validationErrors.mapped()).forEach(item => errorsArr.push(item.msg));
        req.flash("errors", errorsArr);
        return res.redirect("/login");
    }

    try {
        const user = await loginService.handleLogin(req.body.username, req.body.password);

        const payload = { id: user.id, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày (ms)
        });

        return res.redirect("/");
    } catch (err) {
        req.flash("errors", err.message || err);
        return res.redirect("/login");
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
            return res.redirect("/");
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
