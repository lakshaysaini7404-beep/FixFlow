
const mongoose = require("mongoose");

const Ticket = require("../models/ticket");
const User = require("../models/user");
const Review = require("../models/review");
const AuditLog = require("../models/auditLog");
const Activity = require("../models/activity");
const { notify } = require("../services/notificationService");
const { PRIORITIES, STATUSES } = require("../utils/constants");

async function audit(actor, action, extras = {}) {
  await AuditLog.create({ actor, action, ...extras });
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Get ticket details
async function getTicketDetails(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("assignedWorker", "name email category");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    return res.json({ ticket });
  } catch (error) {
    next(error);
  }
}

// Get user details
async function getUserDetails(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findOne({
      _id: req.params.id,
      role: "user",
    }).select("-password -resetPasswordToken");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const reportedTickets = await Ticket.countDocuments({
      createdBy: user._id,
    });

    return res.json({
      success: true,
      user: {
        ...user.toObject(),
        phone: user.phone || user.number || "",
        address: user.address || "",
        reportedTickets,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Get worker details
async function getWorkerDetails(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid worker ID" });
    }

    const worker = await User.findOne({
      _id: req.params.id,
      role: "worker",
    }).select("-password -resetPasswordToken");

    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    return res.json({ worker });
  } catch (error) {
    next(error);
  }
}

// Dashboard
async function dashboard(req, res, next) {
  try {
    const [tickets, users, workers, reviews] = await Promise.all([
      Ticket.find()
        .populate("assignedWorker", "name category")
        .populate("createdBy", "name"),
      User.countDocuments({ role: "user" }),
      User.find({ role: "worker" }),
      Review.find(),
    ]);

    const now = new Date();

    const overdue = tickets.filter(
      (ticket) =>
        !["Resolved", "Closed", "Cancelled"].includes(ticket.status) &&
        ticket.slaResolveBy &&
        ticket.slaResolveBy < now
    );

    const byStatus = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});

    const byCategory = tickets.reduce((acc, ticket) => {
      acc[ticket.category] = (acc[ticket.category] || 0) + 1;
      return acc;
    }, {});

    const resolved = tickets.filter((ticket) => ticket.resolvedAt);

    const avgResolutionHours = resolved.length
      ? resolved.reduce(
          (sum, ticket) =>
            sum + (ticket.resolvedAt - ticket.createdAt) / 36e5,
          0
        ) / resolved.length
      : 0;

    const assigned = tickets.filter((ticket) => ticket.acceptedAt);

    const avgAssignHours = assigned.length
      ? assigned.reduce(
          (sum, ticket) =>
            sum + (ticket.acceptedAt - ticket.createdAt) / 36e5,
          0
        ) / assigned.length
      : 0;

    return res.json({
      counts: {
        tickets: tickets.length,
        users,
        workers: workers.length,
        overdue: overdue.length,
        open: byStatus.Open || 0,
        inProgress:
          (byStatus.Assigned || 0) + (byStatus["In Progress"] || 0),
        resolved: byStatus.Resolved || 0,
        closed: byStatus.Closed || 0,
      },
      byStatus,
      byCategory,
      avgResolutionHours: Number(avgResolutionHours.toFixed(1)),
      avgAssignHours: Number(avgAssignHours.toFixed(1)),
      slaCompliance: tickets.length
        ? Number(
            (((tickets.length - overdue.length) / tickets.length) * 100).toFixed(1)
          )
        : 100,
      avgRating: reviews.length
        ? Number(
            (
              reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviews.length
            ).toFixed(1)
          )
        : 0,
      recent: tickets.slice(-8).reverse(),
      overdue,
    });
  } catch (error) {
    next(error);
  }
}

// List and search tickets
async function listTickets(req, res, next) {
  try {
    const { status, category, priority, q, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    if (q) {
      const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: new RegExp(escapedQuery, "i") },
        { ticketNumber: new RegExp(escapedQuery, "i") },
        { description: new RegExp(escapedQuery, "i") },
      ];
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const currentLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (currentPage - 1) * currentLimit;

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("createdBy", "name email")
        .populate("assignedWorker", "name category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit),
      Ticket.countDocuments(filter),
    ]);

    return res.json({
      tickets,
      total,
      page: currentPage,
      limit: currentLimit,
    });
  } catch (error) {
    next(error);
  }
}

// Assign worker
async function assignWorker(req, res, next) {
  try {
    const { workerId } = req.body;

    if (!isValidId(req.params.id) || !isValidId(workerId)) {
      return res.status(400).json({
        message: "Invalid ticket or worker ID",
      });
    }

    const worker = await User.findOne({
      _id: workerId,
      role: "worker",
      isActive: true,
      isApproved: true,
    });

    if (!worker) {
      return res.status(404).json({
        message: "Active and approved worker not found",
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (["Resolved", "Closed", "Cancelled"].includes(ticket.status)) {
      return res.status(400).json({
        message: "Cannot assign a completed or cancelled ticket",
      });
    }

    const fromStatus = ticket.status;
    const previousWorker = ticket.assignedWorker;

    ticket.assignedWorker = worker._id;
    ticket.status = "Assigned";
    ticket.acceptedAt = new Date();

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      actor: req.user.userId,
      action: previousWorker ? "admin-reassigned" : "admin-assigned",
      fromStatus,
      toStatus: "Assigned",
      metadata: {
        workerId: worker._id,
        previousWorkerId: previousWorker || null,
      },
    });

    await audit(
      req.user.userId,
      previousWorker ? "reassign-worker" : "assign-worker",
      {
        targetType: "Ticket",
        targetId: ticket.id,
        metadata: {
          workerId: worker._id,
          workerName: worker.name,
          previousWorkerId: previousWorker || null,
        },
      }
    );

    await notify(req, {
      recipient: worker._id,
      ticket: ticket._id,
      type: "ticket:assigned",
      message: `Admin assigned you ${ticket.ticketNumber}`,
    });

    await notify(req, {
      recipient: ticket.createdBy,
      ticket: ticket._id,
      type: "ticket:assigned",
      message: `${ticket.ticketNumber} was assigned to ${worker.name}`,
    });

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("createdBy", "name email")
      .populate("assignedWorker", "name email category");

    return res.json({
      success: true,
      message: previousWorker
        ? "Worker reassigned successfully"
        : "Worker assigned successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    next(error);
  }
}

// Reassign worker
async function reassignWorker(req, res, next) {
  req.body.workerId = req.body.workerId || req.body.newWorkerId;
  return assignWorker(req, res, next);
}

// List all assignments
async function listAssignments(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = {
      assignedWorker: { $exists: true, $ne: null },
    };

    if (req.query.status) filter.status = req.query.status;

    const [assignments, total] = await Promise.all([
      Ticket.find(filter)
        .populate("createdBy", "name email")
        .populate("assignedWorker", "name email category")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      assignments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

// Create assignment
async function createAssignment(req, res, next) {
  console.log("🔥 CREATE ASSIGNMENT ROUTE HIT");
  try {
    const { ticketId, workerId } = req.body;

    if (!ticketId || !workerId) {
      return res.status(400).json({
        message: "Ticket ID and Worker ID are required",
      });
    }

    if (!isValidId(ticketId) || !isValidId(workerId)) {
      return res.status(400).json({
        message: "Invalid ticket ID or worker ID",
      });
    }

    req.params.id = ticketId;
    req.body.workerId = workerId;

    return assignWorker(req, res, next);
  } catch (error) {
    next(error);
  }
}

// Update ticket priority
async function updatePriority(req, res, next) {
  try {
    const { priority } = req.body;

    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: "Invalid ticket priority",
        allowedPriorities: PRIORITIES,
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const fromPriority = ticket.priority;

    if (fromPriority === priority) {
      return res.json({ message: "Ticket already has this priority", ticket });
    }

    ticket.priority = priority;
    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      actor: req.user.userId,
      action: "admin-priority-update",
      metadata: { fromPriority, toPriority: priority },
    });

    await audit(req.user.userId, "update-ticket-priority", {
      targetType: "Ticket",
      targetId: ticket.id,
      metadata: { fromPriority, toPriority: priority },
    });

    return res.json({
      message: "Ticket priority updated successfully",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

// Update ticket status
async function updateTicketStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid ticket status",
        allowedStatuses: STATUSES,
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const fromStatus = ticket.status;

    if (fromStatus === status) {
      return res.json({
        message: "Ticket already has this status",
        ticket,
      });
    }

    ticket.status = status;

    if (status === "Resolved" && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    if (status === "Closed" && !ticket.confirmedAt) {
      ticket.confirmedAt = new Date();
    }

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      actor: req.user.userId,
      action: "admin-status-update",
      fromStatus,
      toStatus: status,
      metadata: { source: "admin-panel" },
    });

    await audit(req.user.userId, "update-ticket-status", {
      targetType: "Ticket",
      targetId: ticket.id,
      metadata: { fromStatus, toStatus: status },
    });

    return res.json({
      message: "Ticket status updated successfully",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

// List users
async function listUsers(req, res, next) {
  try {
    const users = await User.find({ role: "user" })
      .select("-password -resetPasswordToken")
      .sort({ createdAt: -1 });

    return res.json({ users });
  } catch (error) {
    next(error);
  }
}

// Update user status
async function updateUserStatus(req, res, next) {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "user" },
      { isActive },
      { returnDocument: "after", runValidators: true }
    ).select("-password -resetPasswordToken");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await audit(req.user.userId, "user-status", {
      targetType: "User",
      targetId: user.id,
      metadata: { isActive },
    });

    return res.json({ message: "User status updated", user });
  } catch (error) {
    next(error);
  }
}

// List workers
async function listWorkers(req, res, next) {
  try {
    const workers = await User.find({ role: "worker" })
      .select("-password -resetPasswordToken")
      .sort({ createdAt: -1 });

    return res.json({ workers });
  } catch (error) {
    next(error);
  }
}

// Get worker status
async function updateWorkerStatus(req, res, next) {
  try {
    const updates = {};

    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      updates.isActive = req.body.isActive;
    }

    if (req.body.isApproved !== undefined) {
      if (typeof req.body.isApproved !== "boolean") {
        return res.status(400).json({ message: "isApproved must be a boolean" });
      }
      updates.isApproved = req.body.isApproved;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        message: "Provide isActive or isApproved to update",
      });
    }

    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid worker ID" });
    }

    const worker = await User.findOneAndUpdate(
      { _id: req.params.id, role: "worker" },
      updates,
      { returnDocument: "after", runValidators: true }
    ).select("-password -resetPasswordToken");

    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    await audit(req.user.userId, "worker-status", {
      targetType: "User",
      targetId: worker.id,
      metadata: updates,
    });

    return res.json({ message: "Worker status updated", worker });
  } catch (error) {
    next(error);
  }
}

// Reports
async function reports(req, res, next) {
  try {
    const tickets = await Ticket.find();
    const workers = await User.find({ role: "worker" }).select("name category");
    const reviews = await Review.find();

    const workload = workers.map((worker) => {
      const jobs = tickets.filter(
        (ticket) => ticket.assignedWorker?.toString() === worker.id
      );

      const completed = jobs.filter((job) =>
        ["Resolved", "Closed"].includes(job.status)
      ).length;

      const workerReviews = reviews.filter(
        (review) => review.worker?.toString() === worker.id
      );

      return {
        worker: worker.name,
        category: worker.category,
        assigned: jobs.length,
        completed,
        completionRate: jobs.length
          ? Number(((completed / jobs.length) * 100).toFixed(1))
          : 0,
        rating: workerReviews.length
          ? Number(
              (
                workerReviews.reduce((sum, review) => sum + review.rating, 0) /
                workerReviews.length
              ).toFixed(1)
            )
          : 0,
      };
    });

    return res.json({
      generatedAt: new Date(),
      ticketCount: tickets.length,
      workload,
    });
  } catch (error) {
    next(error);
  }
}

// Get activity logs
async function activityLogs(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.action) filter.action = req.query.action;
    if (req.query.targetType) filter.targetType = req.query.targetType;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actor", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
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
};
