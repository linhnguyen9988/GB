const db = require('../configs/DBConnection');

const handleLoadComment = async (req, res, next) => {
  try {
    const [data] = await db.query('SELECT * FROM livestream ORDER BY idx DESC');
    res.render('loadcomment', { data, user: req.user });
  } catch (err) {
    next(err);
  }
};

module.exports = { handleLoadComment };
