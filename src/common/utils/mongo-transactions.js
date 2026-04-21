const mongoose = require('mongoose');

let cachedSupportsTransactions;

/**
 * Multi-document transactions require a replica set member or mongos.
 * Standalone mongod (common in local dev) returns false.
 */
async function mongoSupportsMultiDocTransactions() {
  if (cachedSupportsTransactions !== undefined) {
    return cachedSupportsTransactions;
  }
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    cachedSupportsTransactions = false;
    return false;
  }
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const ok = Boolean(
      hello &&
        (hello.setName || hello.msg === 'isdbgrid')
    );
    cachedSupportsTransactions = ok;
    return ok;
  } catch {
    cachedSupportsTransactions = false;
    return false;
  }
}

module.exports = { mongoSupportsMultiDocTransactions };
