const MAX_LOG = 3000;

function parseDetail(body) {
    if (typeof body.raw === 'string') {
        try {
            return JSON.parse(body.raw);
        } catch (e) {
            return { _unparsed: body.raw.slice(0, 500) };
        }
    }
    return body.obj || null;
}

module.exports = function registerStreamlabsAlertWebhook(router) {
    router.post('/streamlabs/alert', function (req, res) {
        const kind = String(req.body.kind || '').toLowerCase().slice(0, 20);
        const pageid = String(req.body.pageid || '').slice(0, 30);
        const detail = parseDetail(req.body);

        let dump;
        try {
            dump = JSON.stringify(detail);
        } catch (e) {
            dump = '[không stringify được payload]';
        }
        console.log(`[streamlabs-alert] kind=${kind || '?'} page=${pageid || '?'} ${String(dump).slice(0, MAX_LOG)}`);

        res.json({ success: true });
    });
};
