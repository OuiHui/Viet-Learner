const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'db.json');

let useLocalDb = false;
let cachedConnection = null;
let connectionAttempted = false;

// Standard seed data
const defaultCategories = ['Family', 'Food', 'Hobbies', 'Travel', 'Common Words', 'Context'];
const seedCards = [
  {
    word: 'Gia đình',
    definition: 'Family',
    category: 'Family',
    example: 'Gia đình tôi có bốn người.',
    translation: 'My family has four people.'
  },
  {
    word: 'Bố mẹ',
    definition: 'Parents',
    category: 'Family',
    example: 'Bố mẹ tôi sống ở Hà Nội.',
    translation: 'My parents live in Hanoi.'
  },
  {
    word: 'Ăn cơm',
    definition: 'To eat a meal / rice',
    category: 'Food',
    example: 'Bạn đã ăn cơm chưa?',
    translation: 'Have you eaten rice yet?'
  },
  {
    word: 'Phở',
    definition: 'Pho (Vietnamese noodle soup)',
    category: 'Food',
    example: 'Tôi thích ăn phở bò vào buổi sáng.',
    translation: 'I like to eat beef pho in the morning.'
  },
  {
    word: 'Du lịch',
    definition: 'To travel / tourism',
    category: 'Travel',
    example: 'Năm sau tôi muốn đi du lịch Việt Nam.',
    translation: 'Next year I want to travel to Vietnam.'
  },
  {
    word: 'Đọc sách',
    definition: 'To read books',
    category: 'Hobbies',
    example: 'Đọc sách giúp tôi học được nhiều điều.',
    translation: 'Reading books helps me learn many things.'
  },
  {
    word: 'Xin chào',
    definition: 'Hello / Greetings',
    category: 'Common Words',
    example: 'Xin chào! Rất vui được gặp bạn.',
    translation: 'Hello! Nice to meet you.'
  },
  {
    word: 'Cảm ơn',
    definition: 'Thank you',
    category: 'Common Words',
    example: 'Cảm ơn bạn đã giúp đỡ tôi.',
    translation: 'Thank you for helping me.'
  }
];

let localData = {
  categories: defaultCategories.map(name => ({ name })),
  flashcards: seedCards.map((c, i) => ({ _id: `fc_${i}`, ...c })),
  vocabulary: [],
  articles: [],
  progress: {
    userId: 'default_user',
    streak: 0,
    lastActive: null,
    articlesRead: [],
    listeningSeconds: 0
  }
};

// Helper to load db.json
function loadLocal() {
  if (fs.existsSync(DB_FILE)) {
    try {
      localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      console.error('Failed to parse db.json, using defaults', err);
    }
  } else {
    saveLocal();
  }
}

function saveLocal() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localData, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write db.json', err);
  }
}

// Initial local load
loadLocal();

// Mongoose models
const CategoryModel = require('./models/Category');
const FlashcardModel = require('./models/Flashcard');
const VocabularyModel = require('./models/Vocabulary');
const ProgressModel = require('./models/Progress');
const ArticleModel = require('./models/Article');


const db = {
  async connect(uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/viet-learner') {
    if (cachedConnection !== null) {
      return cachedConnection;
    }

    if (connectionAttempted && useLocalDb) {
      return null;
    }

    connectionAttempted = true;

    try {
      console.log('Attempting MongoDB connection at:', uri);
      mongoose.set('bufferCommands', false);
      const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      
      // If connection process started but readyState is not yet 1 (connected), wait for it
      if (mongoose.connection.readyState !== 1) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Mongoose connection readyState timeout')), 2000);
          mongoose.connection.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });
          mongoose.connection.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      console.log('Connected to MongoDB successfully.');
      useLocalDb = false;
      cachedConnection = conn;
      await this.seedMongo();
      return conn;
    } catch (err) {
      console.warn('MongoDB connection failed. Falling back to local db.json storage:', err.message);
      useLocalDb = true;
      cachedConnection = null;
      return null;
    }
  },

  isLocal() {
    return useLocalDb;
  },

  async seedMongo() {
    try {
      // Seed Categories
      const catCount = await CategoryModel.countDocuments();
      if (catCount === 0) {
        for (const name of defaultCategories) {
          await CategoryModel.create({ name }).catch(() => {});
        }
      }

      // Seed Flashcards
      const cardCount = await FlashcardModel.countDocuments();
      if (cardCount === 0) {
        for (const card of seedCards) {
          await FlashcardModel.create(card).catch(() => {});
        }
      }

      // Seed default progress
      const progCount = await ProgressModel.countDocuments();
      if (progCount === 0) {
        await ProgressModel.create({
          userId: 'default_user',
          streak: 0,
          articlesRead: [],
          listeningSeconds: 0
        });
      }
    } catch (err) {
      console.error('Failed to seed MongoDB:', err);
      throw err; // Rethrow to trigger local DB fallback
    }
  },

  // --- CATEGORIES ---
  async getCategories() {
    if (useLocalDb) {
      return localData.categories;
    }
    return CategoryModel.find().sort({ name: 1 });
  },

  async createCategory(name) {
    if (useLocalDb) {
      if (localData.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Category already exists');
      }
      const newCat = { name };
      localData.categories.push(newCat);
      saveLocal();
      return newCat;
    }
    const newCat = new CategoryModel({ name });
    return newCat.save();
  },

  async deleteCategory(name) {
    if (useLocalDb) {
      localData.categories = localData.categories.filter(c => c.name.toLowerCase() !== name.toLowerCase());
      localData.flashcards.forEach(c => {
        if (c.category.toLowerCase() === name.toLowerCase()) {
          c.category = 'General';
        }
      });
      saveLocal();
      return { message: 'Category deleted' };
    }
    await CategoryModel.findOneAndDelete({ name });
    await FlashcardModel.updateMany({ category: name }, { category: 'General' });
    return { message: 'Category deleted' };
  },

  // --- FLASHCARDS ---
  async getFlashcards() {
    if (useLocalDb) {
      return localData.flashcards;
    }
    return FlashcardModel.find().sort({ createdAt: -1 });
  },

  async createFlashcard(cardData) {
    if (useLocalDb) {
      const { word, definition, category, example, translation } = cardData;
      if (localData.flashcards.some(c => c.word.toLowerCase() === word.toLowerCase() && c.category.toLowerCase() === category.toLowerCase())) {
        throw new Error('Word already exists in this category');
      }
      const newCard = {
        _id: 'fc_' + Date.now() + Math.random().toString(36).substr(2, 5),
        word,
        definition,
        category,
        example: example || '',
        translation: translation || '',
        starred: false,
        createdAt: new Date().toISOString()
      };
      localData.flashcards.push(newCard);
      saveLocal();
      return newCard;
    }
    const newCard = new FlashcardModel(cardData);
    return newCard.save();
  },

  async deleteFlashcard(id) {
    if (useLocalDb) {
      const card = localData.flashcards.find(c => c._id === id);
      if (card && card.category === 'Context') {
        localData.vocabulary = localData.vocabulary.filter(v => v.word.toLowerCase() !== card.word.toLowerCase());
      }
      localData.flashcards = localData.flashcards.filter(c => c._id !== id);
      saveLocal();
      return { message: 'Flashcard deleted' };
    }
    const card = await FlashcardModel.findById(id);
    if (card && card.category === 'Context') {
      await VocabularyModel.findOneAndDelete({ word: card.word });
    }
    return FlashcardModel.findByIdAndDelete(id);
  },

  async updateFlashcard(id, cardData) {
    if (useLocalDb) {
      const index = localData.flashcards.findIndex(c => c._id === id);
      if (index === -1) {
        throw new Error('Flashcard not found');
      }
      const { word, definition, category, example, translation, starred } = cardData;
      const original = localData.flashcards[index];
      const checkWord = word !== undefined ? word.trim() : original.word;
      const checkCat = category !== undefined ? category : original.category;
      
      if (
        checkWord.toLowerCase() !== original.word.toLowerCase() ||
        checkCat.toLowerCase() !== original.category.toLowerCase()
      ) {
        if (
          localData.flashcards.some(
            c =>
              c._id !== id &&
              c.word.toLowerCase() === checkWord.toLowerCase() &&
              c.category.toLowerCase() === checkCat.toLowerCase()
          )
        ) {
          throw new Error('Word already exists in this category');
        }
      }

      localData.flashcards[index] = {
        ...original,
        word: checkWord,
        definition: definition !== undefined ? definition.trim() : original.definition,
        category: checkCat,
        example: example !== undefined ? example.trim() : original.example,
        translation: translation !== undefined ? translation.trim() : original.translation,
        starred: starred !== undefined ? starred : (original.starred || false),
        updatedAt: new Date().toISOString()
      };
      saveLocal();
      return localData.flashcards[index];
    }
    return FlashcardModel.findByIdAndUpdate(
      id,
      { $set: cardData },
      { new: true, runValidators: true }
    );
  },



  // --- VOCABULARY IN CONTEXT ---
  async getVocabulary() {
    if (useLocalDb) {
      return localData.vocabulary;
    }
    return VocabularyModel.find().sort({ dateLearned: -1 });
  },

  async createVocabulary(vocabData) {
    const { word, definition, category, contextSentence, contextTranslation, source } = vocabData;
    
    if (useLocalDb) {
      // Upsert Vocabulary
      let vocabItem = localData.vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
      if (vocabItem) {
        vocabItem.definition = definition;
        vocabItem.category = category || vocabItem.category;
        vocabItem.contextSentence = contextSentence;
        vocabItem.contextTranslation = contextTranslation;
        vocabItem.source = source;
        vocabItem.dateLearned = new Date().toISOString();
      } else {
        vocabItem = {
          _id: 'v_' + Date.now() + Math.random().toString(36).substr(2, 5),
          word,
          definition,
          category: category || 'General',
          contextSentence,
          contextTranslation,
          source,
          dateLearned: new Date().toISOString()
        };
        localData.vocabulary.push(vocabItem);
      }

      // Ensure 'Context' category exists in local decks
      if (!localData.categories.some(c => c.name.toLowerCase() === 'context')) {
        localData.categories.push({ name: 'Context' });
      }

      // Upsert Flashcard context
      let flashcard = localData.flashcards.find(c => c.word.toLowerCase() === word.toLowerCase() && c.category === 'Context');
      if (flashcard) {
        flashcard.definition = definition;
        flashcard.example = contextSentence;
        flashcard.translation = contextTranslation;
      } else {
        flashcard = {
          _id: 'fc_' + Date.now() + Math.random().toString(36).substr(2, 5),
          word,
          definition,
          category: 'Context',
          example: contextSentence,
          translation: contextTranslation,
          createdAt: new Date().toISOString()
        };
        localData.flashcards.push(flashcard);
      }

      saveLocal();
      return { vocabItem, flashcard };
    }

    // MongoDB connection mode
    let vocabItem = await VocabularyModel.findOne({ word });
    if (vocabItem) {
      vocabItem.definition = definition;
      vocabItem.category = category || vocabItem.category;
      vocabItem.contextSentence = contextSentence;
      vocabItem.contextTranslation = contextTranslation;
      vocabItem.source = source;
      vocabItem.dateLearned = Date.now();
      await vocabItem.save();
    } else {
      vocabItem = new VocabularyModel({
        word,
        definition,
        category: category || 'General',
        contextSentence,
        contextTranslation,
        source
      });
      await vocabItem.save();
    }

    // Ensure category 'Context'
    let contextCat = await CategoryModel.findOne({ name: 'Context' });
    if (!contextCat) {
      await CategoryModel.create({ name: 'Context' }).catch(() => {});
    }

    // Upsert flashcard
    let flashcardItem = await FlashcardModel.findOne({ word, category: 'Context' });
    if (flashcardItem) {
      flashcardItem.definition = definition;
      flashcardItem.example = contextSentence;
      flashcardItem.translation = contextTranslation;
      await flashcardItem.save();
    } else {
      flashcardItem = new FlashcardModel({
        word,
        definition,
        category: 'Context',
        example: contextSentence,
        translation: contextTranslation
      });
      await flashcardItem.save();
    }

    return { vocabItem, flashcardItem };
  },

  async deleteVocabulary(id) {
    if (useLocalDb) {
      const vocabItem = localData.vocabulary.find(v => v._id === id);
      if (!vocabItem) throw new Error('Vocabulary item not found');
      
      localData.vocabulary = localData.vocabulary.filter(v => v._id !== id);
      localData.flashcards = localData.flashcards.filter(c => !(c.word.toLowerCase() === vocabItem.word.toLowerCase() && c.category === 'Context'));
      saveLocal();
      return { message: 'Vocabulary item deleted' };
    }

    const vocabItem = await VocabularyModel.findByIdAndDelete(id);
    if (!vocabItem) throw new Error('Vocabulary item not found');
    await FlashcardModel.findOneAndDelete({ word: vocabItem.word, category: 'Context' });
    return { message: 'Vocabulary item deleted' };
  },

  async updateVocabulary(id, vocabData) {
    const { word, definition, category, contextSentence, contextTranslation, source } = vocabData;
    if (useLocalDb) {
      const index = localData.vocabulary.findIndex(v => v._id === id);
      if (index === -1) {
        throw new Error('Vocabulary item not found');
      }
      const original = localData.vocabulary[index];
      const checkWord = word !== undefined ? word.trim() : original.word;

      if (checkWord.toLowerCase() !== original.word.toLowerCase()) {
        if (localData.vocabulary.some(v => v._id !== id && v.word.toLowerCase() === checkWord.toLowerCase())) {
          throw new Error('Word already exists in vocabulary');
        }
      }

      localData.vocabulary[index] = {
        ...original,
        word: checkWord,
        definition: definition !== undefined ? definition.trim() : original.definition,
        category: category !== undefined ? category : original.category,
        contextSentence: contextSentence !== undefined ? contextSentence.trim() : original.contextSentence,
        contextTranslation: contextTranslation !== undefined ? contextTranslation.trim() : original.contextTranslation,
        source: source !== undefined ? source.trim() : original.source,
      };
      
      // Sync corresponding Context Flashcard if it exists
      let flashcard = localData.flashcards.find(c => c.word.toLowerCase() === original.word.toLowerCase() && c.category === 'Context');
      if (flashcard) {
        flashcard.word = checkWord;
        flashcard.definition = definition !== undefined ? definition.trim() : flashcard.definition;
        flashcard.example = contextSentence !== undefined ? contextSentence.trim() : flashcard.example;
        flashcard.translation = contextTranslation !== undefined ? contextTranslation.trim() : flashcard.translation;
      }

      saveLocal();
      return localData.vocabulary[index];
    }

    const updatedVocab = await VocabularyModel.findByIdAndUpdate(
      id,
      { $set: vocabData },
      { new: true, runValidators: true }
    );
    if (!updatedVocab) {
      throw new Error('Vocabulary item not found');
    }

    // Sync corresponding Context Flashcard if it exists
    await FlashcardModel.findOneAndUpdate(
      { word: updatedVocab.word, category: 'Context' },
      {
        $set: {
          word: updatedVocab.word,
          definition: updatedVocab.definition,
          example: updatedVocab.contextSentence,
          translation: updatedVocab.contextTranslation
        }
      }
    );

    return updatedVocab;
  },


  // --- PROGRESS ---
  async getProgress() {
    if (useLocalDb) {
      return localData.progress;
    }
    let prog = await ProgressModel.findOne({ userId: 'default_user' });
    if (!prog) {
      prog = new ProgressModel({ userId: 'default_user' });
      await prog.save();
    }
    return prog;
  },

  async saveProgress(progData) {
    if (useLocalDb) {
      localData.progress = { ...localData.progress, ...progData };
      saveLocal();
      return localData.progress;
    }
    return ProgressModel.findOneAndUpdate(
      { userId: 'default_user' },
      { $set: progData },
      { new: true, upsert: true }
    );
  },

  // --- ARTICLES ---
  async getArticles() {
    if (useLocalDb) {
      return localData.articles || [];
    }
    return ArticleModel.find().sort({ createdAt: -1 });
  },

  async createArticle(articleData) {
    if (useLocalDb) {
      if (!localData.articles) {
        localData.articles = [];
      }
      const newArticle = {
        _id: 'art_' + Date.now() + Math.random().toString(36).substr(2, 5),
        id: 'art_' + Date.now() + Math.random().toString(36).substr(2, 5),
        title: articleData.title,
        level: articleData.level,
        sentences: articleData.sentences,
        source: articleData.source || 'Manual',
        createdAt: new Date().toISOString()
      };
      localData.articles.push(newArticle);
      saveLocal();
      return newArticle;
    }
    const newArticle = new ArticleModel(articleData);
    return newArticle.save();
  }
};

module.exports = db;
