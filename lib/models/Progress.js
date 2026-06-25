const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: 'default_user',
    unique: true
  },
  streak: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: null
  },
  articlesRead: {
    type: [String],
    default: []
  },
  listeningSeconds: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.models.Progress || mongoose.model('Progress', ProgressSchema);
