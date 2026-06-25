const mongoose = require('mongoose');

const FlashcardSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    trim: true
  },
  definition: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  example: {
    type: String,
    trim: true,
    default: ''
  },
  translation: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

// Ensure compound index for uniqueness within a category
FlashcardSchema.index({ word: 1, category: 1 }, { unique: true });

module.exports = mongoose.models.Flashcard || mongoose.model('Flashcard', FlashcardSchema);
