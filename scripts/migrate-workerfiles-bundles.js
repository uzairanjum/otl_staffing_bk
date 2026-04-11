/**
 * Merges legacy worker_files (one document per upload with root-level file_type)
 * into one bundle document per worker_id (files[] + dvla fields).
 *
 * Run from backend folder: node scripts/migrate-workerfiles-bundles.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const config = require('../src/config');

async function run() {
  await mongoose.connect(config.mongodb.uri);
  const coll = mongoose.connection.collection('worker_files');

  const legacy = await coll
    .find({ file_type: { $exists: true }, files: { $exists: false } })
    .toArray();

  if (legacy.length === 0) {
    console.log('No legacy worker_files documents found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const byWorker = new Map();
  for (const doc of legacy) {
    const key = String(doc.worker_id);
    if (!byWorker.has(key)) byWorker.set(key, []);
    byWorker.get(key).push(doc);
  }

  for (const [wid, docs] of byWorker) {
    const workerObjectId = new mongoose.Types.ObjectId(wid);
    const files = docs.map((d) => ({
      _id: d._id,
      file_type: d.file_type,
      file_url: d.file_url,
      cloudinary_public_id: d.cloudinary_public_id ?? undefined,
      uploaded_at: d.uploaded_at || d.createdAt || new Date(),
    }));

    await coll.deleteMany({ _id: { $in: docs.map((d) => d._id) } });

    const existingBundle = await coll.findOne({
      worker_id: workerObjectId,
      files: { $exists: true },
    });

    if (existingBundle) {
      await coll.updateOne(
        { _id: existingBundle._id },
        { $push: { files: { $each: files } }, $set: { updatedAt: new Date() } }
      );
    } else {
      await coll.insertOne({
        worker_id: workerObjectId,
        files,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  console.log(`Migrated ${legacy.length} legacy file row(s) across ${byWorker.size} worker(s).`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
