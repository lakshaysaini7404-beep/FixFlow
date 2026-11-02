
const express = require("express");

const { authenticateToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  dashboard,
  listTickets,
  getTicketDetails,
  assignWorker,
  reassignWorker,
  listAssignments,
  createAssignment,
  updatePriority,
  updateTicketStatus,
  listUsers,
  getUserDetails,
  updateUserStatus,
  listWorkers,
  getWorkerDetails,
  updateWorkerStatus,
  reports,
  activityLogs,
} = require("../controllers/adminController");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("admin"));

router.get("/dashboard", dashboard);

// Assignments
router.get("/assignments", listAssignments);
router.post("/assignments", createAssignment);

// Tickets
router.get("/tickets", listTickets);
router.get("/tickets/:id", getTicketDetails);
router.patch("/tickets/:id/assign", assignWorker);
router.patch("/tickets/:id/reassign", reassignWorker);
router.patch("/tickets/:id/priority", updatePriority);
router.patch("/tickets/:id/status", updateTicketStatus);

// Users
router.get("/users", listUsers);
router.get("/users/:id", getUserDetails);
router.patch("/users/:id/status", updateUserStatus);

// Workers
router.get("/workers", listWorkers);
router.get("/workers/:id", getWorkerDetails);
router.patch("/workers/:id/status", updateWorkerStatus);

// Reports
router.get("/reports", reports);

// Activity Logs
router.get("/activity-logs", activityLogs);

module.exports = router;
