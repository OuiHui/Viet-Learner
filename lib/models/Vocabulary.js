const mongoose = require('mongoose');

const VocabularySchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  definition: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  contextSentence: {
    type: String,
    required: true,
    trim: true
  },
  contextTranslation: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  dateLearned: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.models.Vocabulary || mongoose.model('Vocabulary', VocabularySchema);
