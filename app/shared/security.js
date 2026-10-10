'use strict';
const { promisify } = require('node:util');
const { scrypt: scryptCallback, randomBytes, timingSafeEqual } = require('node:crypto');
const scrypt = promisify(scryptCallback);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  const [scheme, salt, hex] = String(encoded).split('$');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{128}$/.test(hex || '') || !/^[a-f0-9]{32}$/.test(salt || '')) return false;
  const actual = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(Buffer.from(hex, 'hex'), actual);
}
function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function validPassword(value) { return typeof value === 'string' && value.length >= 12 && value.length <= 128; }
function ownedEmail(req, email) { return req.identity?.email === email; }
module.exports = { hashPassword, verifyPassword, validEmail, validPassword, ownedEmail };
