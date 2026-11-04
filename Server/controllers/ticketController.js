
const mongoose = require("mongoose");

const Ticket = require("../models/ticket");
const Comment = require("../models/comment");
const Activity = require("../models/activity");
const Review = require("../models/review");
const User = require("../models/user");

const { generateTicketNumber } = require("../utils/ticketNumber");

const {
  notify,
  emitToUser,
} = require("../services/notificationService");

const {
  CATEGORIES,
  PRIORITIES,
  slaDeadlines,
  normalizeCategory,
} = require("../utils/constants");

function fileMeta(req, files) {
  return (files || []).map((file) => ({
    url: file.path?.startsWith("https://")
      ? file.path
      : `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
    filename: file.originalname,
    mimeType: file.mimetype,
  }));
}

async function recordActivity(ticketId, actor, action, extras = {}) {
  return Activity.create({
    ticket: ticketId,
    actor,
    action,
    ...extras,
  });
}

function canAccessTicket(ticket, user) {
  const createdBy =
    ticket.createdBy?._id?.toString() ||
    ticket.createdBy?.toString();

  const assigned =
    ticket.assignedWorker?._id?.toString() ||
    ticket.assignedWorker?.toString();

  if (user.role === "admin") return true;

  if (user.role === "user") {
    return createdBy === user.userId;
  }

  if (user.role === "worker") {
    return (
      assigned === user.userId ||
      ["Open", "Reopened"].includes(ticket.status)
    );
  }

  return false;
}

// CREATE TICKET
async function createTicket(req, res, next) {
  try {
    const {
      title,
      description,
      category,
      priority,
      latitude,
      longitude,
    } = req.body;

    const rawLocation = req.body.location;

    const address =
      (typeof rawLocation === "object" && rawLocation?.address) ||
      req.body.address ||
      (typeof rawLocation === "string" ? rawLocation : "");

    const latValue = latitude ?? rawLocation?.latitude;
    const lngValue = longitude ?? rawLocation?.longitude;

    if (
      !title?.trim() ||
      !description?.trim() ||
      !category ||
      !address?.trim()
    ) {
      return res.status(400).json({
        message:
          "Title, description, category, and location address are required.",
      });
    }

    const lat = Number(latValue);
    const lng = Number(lngValue);

    if (
      latValue === undefined ||
      latValue === "" ||
      lngValue === undefined ||
      lngValue === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        message:
          "Please select a valid location with latitude and longitude.",
      });
    }

    const normalized = normalizeCategory(category);

    if (!CATEGORIES.includes(normalized)) {
      return res.status(400).json({
        message: "Invalid category",
      });
    }

    const selectedPriority = PRIORITIES.includes(priority)
      ? priority
      : "Medium";

    const ticketLocation = {
      address: address.trim(),
      geo: {
        type: "Point",
        coordinates: [lng, lat],
      },
    };

    const ticket = await Ticket.create({
      ticketNumber: await generateTicketNumber(),
      createdBy: req.user.userId,
      title: title.trim(),
      description: description.trim(),
      category: normalized,
      priority: selectedPriority,
      status: "Open",
      location: ticketLocation,
      attachments: fileMeta(req, req.files),
      ...slaDeadlines(selectedPriority),
    });

    await recordActivity(
      ticket._id,
      req.user.userId,
      "created",
      { toStatus: "Open" }
    );

    const matchingWorkers = await User.find({
      role: "worker",
      isActive: true,
      isApproved: true,
      $or: [
        { category: normalized },
        { skills: normalized },
      ],
    }).select("_id");

    await Promise.all(
      matchingWorkers.map((worker) =>
        notify(req, {
          recipient: worker._id,
          ticket: ticket._id,
          type: "ticket:new",
          message: `New ${normalized} ticket: ${ticket.title}`,
        })
      )
    );

    // Notify matching workers in real time.
    const io = req.app.get("io");

    if (io) {
      matchingWorkers.forEach((worker) => {
        io.to(`user:${worker._id}`).emit("ticket:created", {
          ticket,
        });
      });
    }

    return res.status(201).json({
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

// GET USER TICKETS
async function myTickets(req, res, next) {
  try {
    const { status, category, priority } = req.query;

    const filter = {
      createdBy: req.user.userId,
    };

    if (status) filter.status = status;
    if (category) filter.category = normalizeCategory(category);
    if (priority) filter.priority = priority;

    const tickets = await Ticket.find(filter)
      .populate("assignedWorker", "name email phone category")
      .sort({ createdAt: -1 });

    const stats = {
      open: tickets.filter((t) =>
        ["Open", "Reopened"].includes(t.status)
      ).length,

      inProgress: tickets.filter((t) =>
        ["Assigned", "In Progress"].includes(t.status)
      ).length,

      resolved: tickets.filter(
        (t) => t.status === "Resolved"
      ).length,

      closed: tickets.filter(
        (t) => t.status === "Closed"
      ).length,

      urgent: tickets.filter((t) =>
        ["Urgent", "High"].includes(t.priority)
      ).length,
    };

    res.json({ tickets, stats });
  } catch (error) {
    next(error);
  }
}

// GET TICKET DETAILS
async function getTicket(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid ticket id",
      });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate("createdBy", "name email phone address")
      .populate(
        "assignedWorker",
        "name email phone category skills"
      );

    if (!ticket || !canAccessTicket(ticket, req.user)) {
      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    const [comments, history, review] = await Promise.all([
      Comment.find({ ticket: ticket._id })
        .populate("author", "name role")
        .sort({ createdAt: 1 }),

      Activity.find({ ticket: ticket._id })
        .populate("actor", "name role")
        .sort({ createdAt: 1 }),

      Review.findOne({ ticket: ticket._id }),
    ]);

    res.json({
      ticket,
      comments,
      history,
      review,
    });
  } catch (error) {
    next(error);
  }
}

// UPDATE TICKET
async function updateTicket(req, res, next) {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (
      !ticket ||
      ticket.createdBy.toString() !== req.user.userId
    ) {
      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    if (!["Open", "Reopened"].includes(ticket.status)) {
      return res.status(409).json({
        message: "Only open tickets can be edited",
      });
    }

    const allowed = ["title", "description", "priority"];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        ticket[key] = req.body[key];
      }
    });

    if (
      req.body.category &&
      CATEGORIES.includes(normalizeCategory(req.body.category))
    ) {
      ticket.category = normalizeCategory(req.body.category);
    }

    // Keep address and coordinates synchronized.
    const rawLocation = req.body.location;

    const newAddress =
      (typeof rawLocation === "object" && rawLocation?.address) ??
      req.body.address;

    const newLat =
      req.body.latitude ??
      (typeof rawLocation === "object"
        ? rawLocation?.latitude
        : undefined);

    const newLng =
      req.body.longitude ??
      (typeof rawLocation === "object"
        ? rawLocation?.longitude
        : undefined);

    const locationWasProvided =
      newAddress !== undefined ||
      newLat !== undefined ||
      newLng !== undefined;

    if (locationWasProvided) {
      if (
        typeof newAddress !== "string" ||
        !newAddress.trim() ||
        newLat === undefined ||
        newLat === "" ||
        newLng === undefined ||
        newLng === ""
      ) {
        return res.status(400).json({
          message:
            "Address, latitude, and longitude are required together.",
        });
      }

      const lat = Number(newLat);
      const lng = Number(newLng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return res.status(400).json({
          message: "Invalid location coordinates.",
        });
      }

      ticket.location.address = newAddress.trim();

      ticket.location.geo = {
        type: "Point",
        coordinates: [lng, lat],
      };
    }

    await ticket.save();

    res.json({
      message: "Ticket updated",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

// ADD COMMENT
async function addComment(req, res, next) {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket || !canAccessTicket(ticket, req.user)) {
      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    if (!req.body.body?.trim()) {
      return res.status(400).json({
        message: "Comment body is required",
      });
    }

    const comment = await Comment.create({
      ticket: ticket._id,
      author: req.user.userId,
      body: req.body.body.trim(),
    });

    await comment.populate("author", "name role");

    await recordActivity(
      ticket._id,
      req.user.userId,
      "commented"
    );

    const recipients = new Set([
      ticket.createdBy.toString(),
      ticket.assignedWorker?.toString(),
    ].filter(Boolean));

    recipients.delete(req.user.userId);

    await Promise.all(
      [...recipients].map((id) =>
        notify(req, {
          recipient: id,
          ticket: ticket._id,
          type: "ticket:comment",
          message: `New comment on ${ticket.ticketNumber}`,
        })
      )
    );

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
}

// GET TICKET HISTORY
async function getHistory(req, res, next) {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket || !canAccessTicket(ticket, req.user)) {
      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    const history = await Activity.find({
      ticket: ticket._id,
    })
      .populate("actor", "name role")
      .sort({ createdAt: 1 });

    res.json({ history });
  } catch (error) {
    next(error);
  }
}

// CONFIRM RESOLUTION
async function confirmResolution(req, res, next) {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      createdBy: req.user.userId,
      status: "Resolved",
    });

    if (!ticket) {
      return res.status(404).json({
        message: "Resolved ticket not found",
      });
    }

    const fromStatus = ticket.status;

    ticket.status = "Closed";
    ticket.confirmedAt = new Date();

    await ticket.save();

    await recordActivity(
      ticket._id,
      req.user.userId,
      "confirmed",
      {
        fromStatus,
        toStatus: "Closed",
      }
    );

    if (ticket.assignedWorker) {
      await notify(req, {
        recipient: ticket.assignedWorker,
        ticket: ticket._id,
        type: "ticket:closed",
        message: `${ticket.ticketNumber} was confirmed and closed`,
      });
    }

    emitToUser(
      req,
      req.user.userId,
      "ticket:status-updated",
      ticket
    );

    res.json({
      message: "Repair confirmed",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

// REOPEN TICKET
async function reopenTicket(req, res, next) {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      createdBy: req.user.userId,
      status: { $in: ["Resolved", "Closed"] },
    });

    if (!ticket) {
      return res.status(404).json({
        message: "Ticket cannot be reopened",
      });
    }

    const fromStatus = ticket.status;

    ticket.status = "Reopened";
    ticket.assignedWorker = null;
    ticket.acceptedAt = undefined;
    ticket.startedAt = undefined;
    ticket.resolvedAt = undefined;
    ticket.confirmedAt = undefined;
    ticket.resolutionNotes = undefined;

    await ticket.save();

    await recordActivity(
      ticket._id,
      req.user.userId,
      "reopened",
      {
        fromStatus,
        toStatus: "Reopened",
        metadata: {
          reason: req.body.reason,
        },
      }
    );

    res.json({
      message: "Ticket reopened",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

// SUBMIT REVIEW
async function submitReview(req, res, next) {
  try {
    const { rating, feedback } = req.body;

    const ticket = await Ticket.findOne({
      _id: req.params.id,
      createdBy: req.user.userId,
      status: { $in: ["Resolved", "Closed"] },
    });

    if (!ticket || !ticket.assignedWorker) {
      return res.status(400).json({
        message:
          "Reviews are only allowed after a completed repair",
      });
    }

    if (
      !Number.isInteger(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 5
    ) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5",
      });
    }

    const review = await Review.create({
      ticket: ticket._id,
      reviewer: req.user.userId,
      worker: ticket.assignedWorker,
      rating: Number(rating),
      feedback,
    });

    await recordActivity(
      ticket._id,
      req.user.userId,
      "reviewed",
      {
        metadata: {
          rating: Number(rating),
        },
      }
    );

    res.status(201).json({
      message: "Review submitted",
      review,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You already reviewed this ticket",
      });
    }

    next(error);
  }
}

module.exports = {
  createTicket,
  myTickets,
  getTicket,
  updateTicket,
  addComment,
  getHistory,
  confirmResolution,
  reopenTicket,
  submitReview,
};
