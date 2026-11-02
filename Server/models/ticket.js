const mongoose = require("mongoose");
const {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
} = require("../utils/constants");

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    workerLocation: {
  latitude: {
    type: Number,
    min: -90,
    max: 90,
  },
  longitude: {
    type: Number,
    min: -180,
    max: 180,
  },
  updatedAt: Date,
},

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
    },

    priority: {
      type: String,
      enum: PRIORITIES,
      default: "Medium",
    },

    status: {
      type: String,
      enum: STATUSES,
      default: "Open",
    },

    location: {
      address: {
        type: String,
        required: true,
        trim: true,
      },

      geo: {
        type: {
          type: String,
          enum: ["Point"],
          required: true,
        },

        coordinates: {
          type: [Number],
          required: true,

          validate: {
            validator(coordinates) {
              return (
                Array.isArray(coordinates) &&
                coordinates.length === 2 &&
                coordinates.every(Number.isFinite) &&
                coordinates[0] >= -180 &&
                coordinates[0] <= 180 &&
                coordinates[1] >= -90 &&
                coordinates[1] <= 90
              );
            },

            message:
              "Coordinates must be [longitude, latitude].",
          },
        },
      },
    },

    attachments: [
      {
        url: String,
        filename: String,
        mimeType: String,
      },
    ],

    assignedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    acceptedAt: Date,
    startedAt: Date,
    resolvedAt: Date,
    confirmedAt: Date,

    resolutionNotes: {
      type: String,
      trim: true,
    },

    completionEvidence: [
      {
        url: String,
        filename: String,
        mimeType: String,
      },
    ],

    ignoredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    slaAssignBy: Date,
    slaResolveBy: Date,

    isOverdue: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Existing query indexes
ticketSchema.index({
  createdBy: 1,
  createdAt: -1,
});

ticketSchema.index({
  assignedWorker: 1,
  status: 1,
});

ticketSchema.index({
  status: 1,
  category: 1,
  priority: 1,
});

// Required for $near queries on ticket locations
ticketSchema.index({
  "location.geo": "2dsphere",
});

module.exports = mongoose.model("Ticket", ticketSchema);
