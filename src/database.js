const mongoose = require("mongoose");
const config = require("./config");

const sessionSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    step: { type: Number, default: 0 },
    data: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now, expires: 3600 },
});

const scriptSchema = new mongoose.Schema({
    publisherId: String,
    publisherTag: String,
    publisherAvatar: String,
    name: String,
    description: String,
    types: [String],
    payment: String,
    price: String,
    mediaUrls: [String],
    fileUrl: String,
    fileName: String,
    messageId: String,
    reviewMessageId: String,
    channelId: String,
    status: { type: String, default: 'pending' },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    likedBy: [String],
    dislikedBy: [String],
    createdAt: { type: Date, default: Date.now },
});

const ticketSchema = new mongoose.Schema({
    ticketId: String,
    channelId: String,
    buyerId: String,
    sellerId: String,
    scriptId: String,
    closed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

const Session = mongoose.model("Session", sessionSchema);
const Script = mongoose.model("Script", scriptSchema);
const Ticket = mongoose.model("Ticket", ticketSchema);

async function connect() {
    await mongoose.connect(config.MONGODB_URI);
    console.log("Connected to MongoDB");
}

module.exports = { connect, Session, Script, Ticket };
