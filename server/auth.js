const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const configPath = path.join(__dirname, 'config.json');
const config = fs.existsSync(configPath) ? require(configPath) : { jwtSecret: 'dev-secret' };

function signToken(user) {
  const payload = { id: user.id, username: user.username, role: user.role };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '12h' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}

async function findUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, password_hash, role FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

module.exports = { signToken, authMiddleware, requireRole, findUserByUsername };