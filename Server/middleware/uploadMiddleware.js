
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const {
  cloudinary,
  isCloudinaryConfigured,
} = require("../config/cloudinary");

const uploadDir = path.join(__dirname, "..", "uploads");

// Create local upload directory only when Cloudinary is not configured.
if (!isCloudinaryConfigured && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Use Cloudinary memory storage in production.
// Use disk storage for local uploads.
const storage = isCloudinaryConfigured
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        cb(
          null,
          `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
        );
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

// Upload images to Cloudinary.
async function uploadToCloudinary(req, res, next) {
  try {
    if (!isCloudinaryConfigured || !req.files?.length) {
      return next();
    }

    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        {
          folder: "fixflow",
          resource_type: "image",
        }
      );

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
