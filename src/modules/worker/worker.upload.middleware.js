const multer = require('multer');
const { AppError } = require('../../common/middleware/error.middleware');

const storage = multer.memoryStorage();

const allowedMime = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const uploadWorkerDocument = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (allowedMime.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF and JPEG/PNG files are allowed'));
  },
});

function uploadWorkerFileSingle(req, res, next) {
  uploadWorkerDocument.single('file')(req, res, (err) => {
    if (err) {
      next(new AppError(err.message || 'Upload failed', 400));
      return;
    }
    next();
  });
}

module.exports = { uploadWorkerDocument, uploadWorkerFileSingle };
