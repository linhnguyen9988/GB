import DBConnection from "../../configs/DBConnection";
const SqlString = require('sqlstring');
const jwtAuth = require('../../middleware/jwtAuth');
const { RestartChromeX, getBrowser } = require('../../services/browserService');
const { delay, isNumeric } = require('../../utils/common');
const { refreshPageTokensViaChrome } = require('../../services/pageTokenService');

module.exports = function registerFacebookRoutes(router) {
    router.post("/restartchrome", jwtAuth, async function (request, response, next) {
        RestartChromeX()
        response.json({
            data: JSON.parse('{"success": "Restart Chrome thành công"}')
        });
    });

    router.post('/getrealfbid', jwtAuth, function (req, res) {
        res.sendStatus(200);
        return;
        var userid = req.body.userid;
        var tag = req.body.tag;
        if (tag == 'null' && tag == null || tag == undefined) {
            console.log('Null Tag');
            return;
        }
        (async () => {
            const browser = await getBrowser();
            const page2 = await browser.newPage();
            await page2.bringToFront();
            await page2.goto('https://business.facebook.com/latest/inbox/', { waitUntil: 'networkidle2' });
            const inputSelector = '#js_6g';

            await page2.waitForSelector(inputSelector, { visible: true });
            await page2.evaluate((selector, text) => {
                const input = document.querySelector(selector);
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }, inputSelector, tag);

            const classSelector = '.x2izyaf.x1ejq31n.x18oe1m7.xstzfhl.xso031l.x1q0q8m5.xy7tls4.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
            const classSelector2 = '._4ik4._4ik5';
            try {
                await page2.waitForSelector(classSelector, { visible: true });
                await delay(500);
                if (classSelector) {
                    await classSelector.click();
                } else {
                    console.log("Không tìm thấy dòng chữ này!");
                }
                await page2.waitForSelector(classSelector2, { visible: true });
                await delay(500);
                await page2.click(classSelector2);
            } catch (error) {
                console.error('Lỗi khi chờ hoặc click:', error);
            }
            var realid = page2.url().split('selected_item_id=').pop().split('&')[0];
            var sql = SqlString.format(`UPDATE khachhang SET realfbid=? WHERE userid=?`, [realid, userid]);
            if (isNumeric(realid)) {
                DBConnection.query(sql);
                console.log('Update Real ID: ' + realid);
            }
            await page2.close();
            res.json({
                data: realid
            });
        })();
    });

    router.post("/gettoken", jwtAuth, function (request, response, next) {
        (async () => {
            const r = await refreshPageTokensViaChrome();
            if (r.ok) response.json({ data: r.data });
            else response.json({ data: { error: r.error } });
        })();
    });
};
