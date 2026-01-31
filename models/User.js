const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },

  // goal
  goal: String,
  deadline: String,
  time: String,
  style: String,

  // progression
  points: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  streak: { type: Number, default: 0 },
  lastAction: String,

  // daily tracking
  lastTaskDate: Date,
  taskCompletedToday: { type: Boolean, default: false },

  timezone: { type: String, default: 'Asia/Tashkent' },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
