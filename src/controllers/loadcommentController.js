const db = require('../configs/DBConnection');

const handleLoadComment = async (req, res, next) => {
  try {
    const [data] = await db.query(
      `SELECT ls.*, pl.status, pl.liveviews
       FROM livestream ls
       LEFT JOIN postlive pl ON pl.liveid = ls.id
       ORDER BY ls.idx DESC`
    );
    res.render('loadcomment', { data, user: req.user });
  } catch (err) {
    next(err);
  }
};

module.exports = { handleLoadComment };
