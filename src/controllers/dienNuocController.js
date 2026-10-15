let handleDienNuoc = async (req, res) => {
    return res.render("diennuoc.ejs",{
        user: req.user
    });
};

module.exports = {
    handleDienNuoc: handleDienNuoc,
};