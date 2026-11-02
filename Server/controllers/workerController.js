
const Ticket = require("../models/ticket");
const Activity = require("../models/activity");
const Review = require("../models/review");

const {
  acceptTicketAtomically,
  getTodayCount,
  workerMatchesCategory,
  nearbyFilter,
} = require("../services/assignmentService");

const {
  notify,
  emitToUser,
} = require("../services/notificationService");

const {
  DAILY_ACCEPTANCE_LIMIT,
} = require("../utils/constants");

function fileMeta(req, files) {
  return (files || []).map((file) => ({
    url: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
    filename: file.originalname,
    mimeType: file.mimetype,
  }));
}

/**
 * Get tickets that match the worker's skills and location.
 */
async function availableTickets(req, res, next) {
  try {
    const worker = req.authUser;

    if (
      !worker ||
      worker.role !== "worker" ||
      !worker.isActive ||
      !worker.isApproved
    ) {
      return res.status(403).json({
        message: "Your worker account is not eligible to explore tickets",
      });
    }

    const category = worker.category;
    const skills = worker.skills || [];

    const matchValues = [
      ...new Set(
        [category, ...skills]
          .filter(Boolean)
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];

    if (!matchValues.length) {
      return res.json({ tickets: [] });
    }

    const geo = nearbyFilter(worker);

    const filter = {
      status: { $in: ["Open", "Reopened"] },
      assignedWorker: null,
      ignoredBy: { $ne: worker._id },
      category: { $in: matchValues },
      ...geo,
    };

    const tickets = await Ticket.find(filter)
      .populate("createdBy", "name address")
      .sort({ priority: -1, createdAt: -1 })
      .limit(50);

    return res.json({ tickets });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept a ticket using the existing atomic assignment service.
 */
async function acceptTicket(req, res, next) {
  try {
    const ticket = await acceptTicketAtomically(
      req.params.id,
      req.authUser
    );

    if (!ticket) {
      return res.status(409).json({
        message: "This ticket is no longer available.",
      });
    }

    await Activity.create({
      ticket: ticket._id,
      actor: req.user.userId,
      action: "accepted",
      fromStatus: "Open",
      toStatus: "Assigned",
    });

    await notify(req, {
      recipient: ticket.createdBy,
      ticket: ticket._id,
      type: "ticket:assigned",
      message: `${ticket.ticketNumber} has been assigned to a worker.`,
    });

    emitToUser(
      req,
      String(ticket.createdBy._id || ticket.createdBy),
      "ticket:assigned",
      ticket
    );

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("createdBy", "name phone address")
      .populate("assignedWorker", "name phone category");

    return res.json({
      message: "Ticket accepted",
      ticket: populatedTicket,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Ignore a ticket while it is still available.
 */
async function ignoreTicket(req, res, next) {
  try {
    const workerId = req.user.userId;
    const ticketId = req.params.id;

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: ticketId,
        status: { $in: ["Open", "Reopened"] },
        assignedWorker: null,
      },
      {
        $addToSet: { ignoredBy: workerId },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!ticket) {
      return res.status(409).json({
        message:
          "This ticket is no longer available. It may have been assigned already.",
      });
    }

    return res.status(200).json({
      message: "Ticket ignored successfully",
      ticketId: ticket._id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get jobs assigned to the logged-in worker.
 */
async function myJobs(req, res, next) {
  try {
    const tickets = await Ticket.find({
      assignedWorker: req.user.userId,
    })
      .populate("createdBy", "name phone address")
      .sort({ updatedAt: -1 });

    return res.json({ tickets });
  } catch (error) {
    next(error);
  }
}

/**
 * Start a job and notify the ticket owner in real time.
 */
async function startJob(req, res, next) {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedWorker: req.user.userId,
        status: "Assigned",
      },
      {
        $set: {
          status: "In Progress",
          startedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!ticket) {
      return res.status(409).json({
        message: "Job cannot be started in its current state",
      });
    }

    await Activity.create({
      ticket: ticket._id,
      actor: req.user.userId,
      action: "started",
      fromStatus: "Assigned",
      toStatus: "In Progress",
    });

    await notify(req, {
      recipient: ticket.createdBy,
      ticket: ticket._id,
      type: "ticket:status-updated",
      message: `Work started on ${ticket.ticketNumber}`,
    });

    // Refresh the owner's TicketDetails page without a manual reload.
    const io = req.app.get("io");

    if (io) {
      io.to(`user:${String(ticket.createdBy)}`).emit(
        "ticket:status-updated",
        { ticket }
      );
    }

    return res.json({
      message: "Job started",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save work notes.
 */
async function addWorkNotes(req, res, next) {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      assignedWorker: req.user.userId,
    });

    if (!ticket) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    ticket.resolutionNotes =
      req.body.notes || ticket.resolutionNotes;

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      actor: req.user.userId,
      action: "notes-updated",
      metadata: {
        notes: req.body.notes,
      },
    });

    return res.json({
      message: "Notes saved",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update worker GPS location during an in-progress job.
 */
async function updateWorkerLocation(req, res, next) {
  try {
    const { latitude, longitude } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude === null ||
      longitude === null ||
      latitude === "" ||
      longitude === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        message: "Valid latitude and longitude are required.",
      });
    }

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedWorker: req.user.userId,
        status: "In Progress",
      },
      {
        $set: {
          "workerLocation.latitude": lat,
          "workerLocation.longitude": lng,
          "workerLocation.updatedAt": new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select(
      "_id createdBy assignedWorker status workerLocation"
    );

    if (!ticket) {
      return res.status(409).json({
        message:
          "Location tracking is only allowed for your in-progress job.",
      });
    }

    const locationPayload = {
      ticketId: String(ticket._id),
      latitude: ticket.workerLocation.latitude,
      longitude: ticket.workerLocation.longitude,
      updatedAt: ticket.workerLocation.updatedAt,
    };

    // Broadcast only to clients authorized to join this ticket's room.
    const io = req.app.get("io");

    if (io) {
      io.to(`ticket:${String(ticket._id)}`).emit(
        "worker:location",
        locationPayload
      );
    }

    return res.json({
      message: "Worker location updated",
      location: locationPayload,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark an assigned job as resolved.
 */
async function resolveJob(req, res, next) {
  try {
    const notes = req.body.resolutionNotes || req.body.notes;

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      assignedWorker: req.user.userId,
      status: { $in: ["Assigned", "In Progress"] },
    });

    if (!ticket) {
      return res.status(409).json({
        message: "You can only resolve your active jobs",
      });
    }

    if (!notes?.trim()) {
      return res.status(400).json({
        message: "Resolution notes are required",
      });
    }

    const fromStatus = ticket.status;

    ticket.status = "Resolved";
    ticket.resolvedAt = new Date();
    ticket.resolutionNotes = notes.trim();

    if (req.files?.length) {
      ticket.completionEvidence = [
        ...(ticket.completionEvidence || []),
        ...fileMeta(req, req.files),
      ];
    }

    ticket.isOverdue = ticket.slaResolveBy
      ? ticket.resolvedAt > ticket.slaResolveBy
      : false;

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      actor: req.user.userId,
      action: "resolved",
      fromStatus,
      toStatus: "Resolved",
    });

    await notify(req, {
      recipient: ticket.createdBy,
      ticket: ticket._id,
      type: "ticket:resolved",
      message: `${ticket.ticketNumber} has been marked resolved. Please confirm the repair.`,
    });

    emitToUser(
      req,
      String(ticket.createdBy),
      "ticket:resolved",
      ticket
    );

    return res.json({
      message: "Job resolved",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Worker dashboard statistics.
 */
async function myStats(req, res, next) {
  try {
    const workerId = req.user.userId;

    const jobs = await Ticket.find({
      assignedWorker: workerId,
    });

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const assigned = jobs.filter((job) =>
      ["Assigned", "In Progress"].includes(job.status)
    ).length;

    const inProgress = jobs.filter(
      (job) => job.status === "In Progress"
    ).length;

    const resolvedToday = jobs.filter(
      (job) => job.resolvedAt && job.resolvedAt >= start
    ).length;

    const reviews = await Review.find({
      worker: workerId,
    });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : 0;

    return res.json({
      assigned,
      inProgress,
      resolvedToday,
      completed: jobs.filter((job) =>
        ["Resolved", "Closed"].includes(job.status)
      ).length,
      avgRating: Number(avgRating.toFixed(1)),
      reviewCount: reviews.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Daily ticket acceptance limit.
 */
async function myAcceptanceLimit(req, res, next) {
  try {
    const used = await getTodayCount(req.user.userId);
    const limit =
      req.authUser.dailyLimit || DAILY_ACCEPTANCE_LIMIT;

    return res.json({
      used,
      limit,
      remaining: Math.max(limit - used, 0),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  availableTickets,
  acceptTicket,
  ignoreTicket,
  myJobs,
  startJob,
  addWorkNotes,
  updateWorkerLocation,
  resolveJob,
  myStats,
  myAcceptanceLimit,
  workerMatchesCategory,
};
