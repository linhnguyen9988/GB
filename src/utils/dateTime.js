'use strict';
function addZero(x, n) {
    while (x.toString().length < n) {
        x = "0" + x;
    }
    return x;
}

function formatFbTime(fbTimeString) {
    const date = new Date(fbTimeString);
    const localOffsetMinutes = date.getTimezoneOffset();
    const vietnamOffsetMinutes = -420;
    const offsetDifferenceMinutes = localOffsetMinutes - vietnamOffsetMinutes;
    const vietnamTime = new Date(date.getTime() - (offsetDifferenceMinutes * 60 * 1000));
    const hour = vietnamTime.getHours();
    const timeCode = (hour >= 2 && hour < 19) ? 'S' : 'T';
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const year = String(vietnamTime.getFullYear()).slice(2);
    return `${timeCode} - ${day}/${month}/${year}`;
}

module.exports = { addZero, formatFbTime };
