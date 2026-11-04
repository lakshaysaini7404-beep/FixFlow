
const express = require("express");
const { upload, uploadToCloudinary } = require("../middleware/uploadMiddleware");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  availableTickets,
  acceptTicket,
  ignoreTicket,
  myJobs,
  startJob,
  addWorkNotes,
  resolveJob,
  myStats,
  updateWorkerLocation,
  myAcceptanceLimit,
} = require("../controllers/workerController");

const router = express.Router();

// All worker routes require worker authentication.
router.use(
  authenticateToken,
  authorizeRoles("worker")
);

// Dashboard and ticket discovery.
router.get("/available-tickets", availableTickets);
router.get("/my-jobs", myJobs);
router.get("/my-stats", myStats);
router.get("/my-acceptance-limit", myAcceptanceLimit);

// Ticket actions.
router.post("/tickets/:id/accept", acceptTicket);
router.post("/tickets/:id/ignore", ignoreTicket);
router.post("/tickets/:id/start", startJob);

// Live GPS location.
router.post(
  "/tickets/:id/location",
  updateWorkerLocation
);

// Work notes.
router.post(
  "/tickets/:id/notes",
  addWorkNotes
);

// Resolve job with optional completion photos.
router.post(
  "/tickets/:id/resolve",
  upload.array("photos", 5),
  uploadToCloudinary,
  resolveJob
);

module.exports = router;
