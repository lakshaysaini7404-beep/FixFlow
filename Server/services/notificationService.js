
const Notification = require("../models/notification");

function emitToUser(req, userId, event, payload) {
  const io = req.app.get("io");

  if (!io || !userId) {
    console.error("Socket.IO or recipient missing:", userId);
    return;
  }

  const room = `user:${userId.toString()}`;

  console.log("EMITTING EVENT:", event, "TO:", room);

  io.to(room).emit(event, payload);
}

async function notify(req, { recipient, ticket, type, message }) {
  const notification = await Notification.create({
    recipient,
    ticket,
    type,
    message,
    read: false,
  });

  await notification.populate(
    "ticket",
    "ticketNumber title status"
  );

  emitToUser(
    req,
    recipient,
    "notification:new",
    notification
  );

  console.log("NOTIFICATION CREATED:", notification._id);

  return notification;
}

module.exports = {
  notify,
  emitToUser,
};
