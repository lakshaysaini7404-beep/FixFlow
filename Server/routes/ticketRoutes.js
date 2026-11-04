
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

// Create ticket with optional Cloudinary image uploads.
router.post(
  "/",
  authorizeRoles("user"),
  upload.array("photos", 5),
  uploadToCloudinary,
  createTicket
);

// User tickets.
router.get(
  "/my",
  authorizeRoles("user"),
  myTickets
);

// Ticket history and details.
router.get("/:id/history", getHistory);
router.get("/:id", getTicket);

// Update ticket.
router.patch(
  "/:id",
  authorizeRoles("user"),
  updateTicket
);

// Comments.
router.post("/:id/comments", addComment);

// Confirm repair.
router.post(
  "/:id/confirm-resolution",
  authorizeRoles("user"),
  confirmResolution
);

// Reopen ticket.
router.post(
  "/:id/reopen",
  authorizeRoles("user"),
  reopenTicket
);

// Submit review.
router.post(
  "/:id/reviews",
  authorizeRoles("user"),
  submitReview
);

module.exports = router;
