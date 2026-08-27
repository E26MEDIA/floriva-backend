const session = require('express-session');

module.exports = session({
  name: 'floriva.cms.sid',
  secret: process.env.JWT_SECRET || 'floriva-cms-session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/api/cms',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
