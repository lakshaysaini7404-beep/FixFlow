const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 1000,
  },
});

const Counter =
  mongoose.models.Counter ||
  mongoose.model("Counter", counterSchema);

async function generateTicketNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: "ticketNumber" },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return `FF${counter.seq}`;
}

module.exports = { generateTicketNumber };