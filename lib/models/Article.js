const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  level: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  sentences: [{
    text: {
      type: String,
      required: true,
      trim: true
    },
    translation: {
      type: String,
      required: true,
      trim: true
    }
  }],
  source: {
    type: String,
    default: 'Manual',
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.models.Article || mongoose.model('Article', ArticleSchema);
