
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const {
  cloudinary,
  isCloudinaryConfigured,
} = require("../config/cloudinary");

const uploadDir = path.join(__dirname, "..", "uploads");

// Create local uploads directory only when Cloudinary is not configured.
if (!isCloudinaryConfigured && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Use memory storage for Cloudinary and disk storage for local uploads.
const storage = isCloudinaryConfigured
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${ext}`;

        cb(null, filename);
      },
    });

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(
        new Error("Only JPEG, PNG, WebP, and GIF images are allowed")
      );
    }

    cb(null, true);
  },
});

// Upload received images to Cloudinary when configured.
async function uploadToCloudinary(req, res, next) {
  try {
    if (!isCloudinaryConfigured || !req.files?.length) {
      return next();
    }

    for (const file of req.files) {
      const base64Image = file.buffer.toString("base64");
      const dataUri = `data:${file.mimetype};base64,${base64Image}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "fixflow",
        resource_type: "image",
      });

      file.path = result.secure_url;
      file.filename = file.originalname;
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  upload,
  uploadDir,
  uploadToCloudinary,
};
