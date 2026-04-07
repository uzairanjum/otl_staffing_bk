const tenantMiddleware = (req, res, next) => {
  if (req.user && req.user.company_id) {
    req.company_id = req.user.company_id;
  }
  next();
};

module.exports = tenantMiddleware;
