function delay(time) { return new Promise(resolve => setTimeout(resolve, time)); }

async function WaitUntil(conditionFunction) {
    const poll = resolve => {
        if (conditionFunction()) resolve();
        else setTimeout(_ => poll(resolve), 100);
    }
    return new Promise(poll);
}

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

module.exports = { delay, WaitUntil, isNumeric };
