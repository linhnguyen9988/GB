let handleProfile = async (req, res) => {
    return res.render("profile.ejs",{
        user: req.user
    });
};

module.exports = {
    handleProfile: handleProfile,
};