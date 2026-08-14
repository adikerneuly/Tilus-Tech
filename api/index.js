const { ready } = require('../db');
const app = require('../app');

module.exports = async (req, res) => {
  await ready;
  return app(req, res);
};
