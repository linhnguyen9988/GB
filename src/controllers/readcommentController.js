const db = require('../configs/DBConnection');

const handleReadComment = async (req, res, next) => {
  try {
    const [data] = await db.query('SELECT * FROM livestream ORDER BY idx DESC');
    res.render('readcomment', { data, user: req.user });
  } catch (err) {
    next(err);
  }
};

module.exports = { handleReadComment };