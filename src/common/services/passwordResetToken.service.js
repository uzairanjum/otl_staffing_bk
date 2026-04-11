const crypto = require('crypto');
const PasswordResetToken = require('../models/PasswordResetToken');
const config = require('../../config');

function expiryMs() {
  const mins = config.passwordReset?.expiryMinutes ?? 15;
  return Math.max(1, mins) * 60 * 1000;
}

/**
 * Invalidate any unused reset tokens for this user (audit-friendly; marks usedAt).
 */
async function invalidateUnusedTokensForUser(userId, session = null) {
  const q = PasswordResetToken.updateMany(
    { userId, usedAt: null },
    { $set: { usedAt: new Date() } }
  );
  if (session) q.session(session);
  await q;
}

/**
 * Create a new single-use token; returns the raw token string for URLs.
 */
async function createTokenForUser(userId, session = null) {
  await invalidateUnusedTokensForUser(userId, session);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryMs());
  const docs = [{ userId, token: rawToken, expiresAt }];
  if (session) {
    await PasswordResetToken.create(docs, { session });
  } else {
    await PasswordResetToken.create(docs);
  }
  return rawToken;
}

async function findValidTokenDocument(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const trimmed = rawToken.trim();
  if (!trimmed) return null;
  const doc = await PasswordResetToken.findOne({ token: trimmed });
  if (!doc) return null;
  if (doc.usedAt) return null;
  if (doc.expiresAt.getTime() <= Date.now()) return null;
  return doc;
}

async function markTokenUsed(doc, session = null) {
  doc.usedAt = new Date();
  if (session) {
    await doc.save({ session });
  } else {
    await doc.save();
  }
}

module.exports = {
  createTokenForUser,
  findValidTokenDocument,
  markTokenUsed,
  invalidateUnusedTokensForUser,
  expiryMs,
};
