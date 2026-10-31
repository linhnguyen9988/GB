'use strict';
const express = require("express");
let configViewEngine = (app)=> {
    app.use(express.static("./src/public"));
    app.set("view engine", "ejs");
    app.set("views","./src/views");
    app.locals.activeCarrier = require("./constants").ACTIVE_CARRIER;
};

module.exports = configViewEngine;
