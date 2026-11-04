const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  upload,
  uploadToCloudinary,
} = require("../middleware/uploadMiddleware");
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

router.use(authenticateToken, authorizeRoles("worker"));

router.get("/available-tickets", availableTickets);
router.get("/my-jobs", myJobs);
router.get("/my-stats", myStats);
router.get("/my-acceptance-limit", myAcceptanceLimit);
router.post("/tickets/:id/accept", acceptTicket);
router.post("/tickets/:id/ignore", ignoreTicket);
router.post("/tickets/:id/start", startJob);
router.post(
  "/tickets/:id/location",
  updateWorkerLocation
);
router.post("/tickets/:id/notes", addWorkNotes);
router.post(
  "/tickets/:id/resolve",
  upload.array("photos", 5),
  uploadToCloudinary,
  resolveJob
);

module.exports = router;
