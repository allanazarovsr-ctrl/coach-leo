const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },

  // goal data
  goal: String,
  deadline: String,
  time: String,
  style: String,

  // scheduling
  taskTime: { type: String, default: '10:00' },
  checkInTime: { type: String, default: '22:00' },
  timezone: { type: String, default: 'Asia/Tashkent' },

  // progression
  points: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  streak: { type: Number, default: 0 },
  lastAction: String,

  lastTaskDate: Date,
  taskCompletedToday: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
