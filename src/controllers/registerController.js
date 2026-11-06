'use strict';
const { REGISTER_PATH } = require('../configs/constants');
const registerService = require("./../services/registerService");
const { validationResult } = require("express-validator");

let getPageRegister = (req, res) => {
    return res.render("register.ejs", {
        errors: req.flash("errors")
    });
};

let createNewUser = async (req, res) => {
    let errorsArr = [];
    let validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        let errors = Object.values(validationErrors.mapped());
        errors.forEach((item) => {
            errorsArr.push(item.msg);
        });
        req.flash("errors", errorsArr);
        return res.redirect(REGISTER_PATH);
    }

    let newUser = {
        fullname: req.body.fullName,
        username: req.body.username,
        password: req.body.password
    };
    try {
        await registerService.createNewUser(newUser);
        return res.redirect("/login");
    } catch (err) {
        req.flash("errors", err);
        return res.redirect(REGISTER_PATH);
    }
};
module.exports = {
    getPageRegister: getPageRegister,
    createNewUser: createNewUser
};
