const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  upload,
  uploadToCloudinary,
} = require("../middleware/uploadMiddleware");
const {
  createTicket,
  myTickets,
  getTicket,
  updateTicket,
  addComment,
  getHistory,
  confirmResolution,
  reopenTicket,
  submitReview,
} = require("../controllers/ticketController");

const router = express.Router();

router.use(authenticateToken);

router.post(
  "/",
  authorizeRoles("user"),
  upload.array("photos", 5),
  uploadToCloudinary,
  createTicket
);
router.get("/my", authorizeRoles("user"), myTickets);
router.get("/:id/history", getHistory);
router.get("/:id", getTicket);
router.patch("/:id", authorizeRoles("user"), updateTicket);
router.post("/:id/comments", addComment);
router.post("/:id/confirm-resolution", authorizeRoles("user"), confirmResolution);
router.post("/:id/reopen", authorizeRoles("user"), reopenTicket);
router.post("/:id/reviews", authorizeRoles("user"), submitReview);

module.exports = router;
