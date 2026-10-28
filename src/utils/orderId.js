'use strict';
const { addZero } = require('./dateTime');

function CreateOrderID() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var yyyy = today.getFullYear().toString().slice(2);
    let h = addZero(today.getHours(), 2);
    let m = addZero(today.getMinutes(), 2);
    let s = addZero(today.getSeconds(), 2);
    let ms = addZero(today.getMilliseconds(), 3);
    return `${yyyy}${mm}${dd}${h}${m}${s}${ms}`;
}

module.exports = { CreateOrderID };
