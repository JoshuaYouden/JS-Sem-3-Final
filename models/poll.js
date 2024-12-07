const mongoose = require("mongoose");
const { create } = require("./user");

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: [
    {
      answer: {
        type: String,
        required: true,
      },
      votes: {
        type: Number,
        default: 0,
      },
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Poll = mongoose.model("Poll", pollSchema);

module.exports = Poll;
