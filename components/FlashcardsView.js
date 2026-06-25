'use client';

import React, { useState, useEffect } from 'react';

export default function FlashcardsView({
  flashcards,
  categories,
  onFlashcardsChange,
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [showContextOnly, setShowContextOnly] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filteredCards, setFilteredCards] = useState([]);

  // Modals state
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const deleteTimeoutRef = React.useRef(null);

  // Form states
  const [newCatName, setNewCatName] = useState('');
  const [newCard, setNewCard] = useState({
    word: '',
    definition: '',
    category: 'General',
    example: '',
    translation: '',
  });
  const [isTranslating, setIsTranslating] = useState({
    word: false,
    definition: false,
    example: false,
    translation: false,
  });

  // Cleanup delete timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  // Filter cards whenever activeCategory or flashcards change
  useEffect(() => {
    let cards = [...flashcards];
    if (activeCategory !== 'All') {
      cards = cards.filter((c) => c.category === activeCategory);
    }
    setFilteredCards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [activeCategory, flashcards]);

  const selectCategory = (cat) => {
    setActiveCategory(cat);
  };

  const navigateCard = (direction, e) => {
    if (e) e.stopPropagation();
    if (filteredCards.length <= 1) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        let nextIndex = prev + direction;
        if (nextIndex < 0) nextIndex = filteredCards.length - 1;
        if (nextIndex >= filteredCards.length) nextIndex = 0;
        return nextIndex;
      });
    }, 150); // small delay to match flip transition
  };

  const shuffleDeck = () => {
    if (filteredCards.length <= 1) return;
    setIsFlipped(false);
    setTimeout(() => {
      setFilteredCards((prev) => {
        const shuffled = [...prev];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      });
      setCurrentIndex(0);
    }, 150);
  };

  const handleAddCategorySubmit = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      if (res.ok) {
        setNewCatName('');
        setIsAddCatOpen(false);
        onFlashcardsChange(); // update categories lists
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create category');
      }
    } catch (err) {
      alert('Failed to save category: ' + err.message);
    }
  };

  const handleDeleteCategory = async (cat, e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${cat}"? Cards inside will move to General.`)) {
      try {
        const res = await fetch(`/api/categories/${encodeURIComponent(cat)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setActiveCategory('All');
          onFlashcardsChange();
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to delete category');
        }
      } catch (err) {
        alert('Failed to delete category: ' + err.message);
      }
    }
  };

  const handleDeleteCardClick = async (cardId, e) => {
    e.stopPropagation();
    if (confirmingDeleteId === cardId) {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
      setConfirmingDeleteId(null);
      try {
        const res = await fetch(`/api/flashcards/${cardId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          if (filteredCards.length <= 1) {
            setCurrentIndex(0);
          } else if (currentIndex >= filteredCards.length - 1) {
            setCurrentIndex(filteredCards.length - 2);
          }
          onFlashcardsChange();
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to delete card');
        }
      } catch (err) {
        alert('Failed to delete card: ' + err.message);
      }
    } else {
      setConfirmingDeleteId(cardId);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      deleteTimeoutRef.current = setTimeout(() => {
        setConfirmingDeleteId(null);
      }, 3000);
    }
  };

  const translateField = async (sourceField, targetField, sourceLang, targetLang) => {
    const textToTranslate = newCard[sourceField];
    if (!textToTranslate || !textToTranslate.trim()) return;

    setIsTranslating((prev) => ({ ...prev, [sourceField]: true }));
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate.trim(), source: sourceLang, target: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewCard((prev) => ({
          ...prev,
          [targetField]: data.translation
        }));
      }
    } catch (err) {
      console.error('Translation helper failed:', err);
    }
    setIsTranslating((prev) => ({ ...prev, [sourceField]: false }));
  };

  const handleAddCardSubmit = async (e) => {
    e.preventDefault();
    if (!newCard.word.trim() || !newCard.definition.trim() || !newCard.category) return;

    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: newCard.word.trim(),
          definition: newCard.definition.trim(),
          category: newCard.category,
          example: newCard.example.trim(),
          translation: newCard.translation.trim(),
        }),
      });

      if (res.ok) {
        setNewCard({
          word: '',
          definition: '',
          category: activeCategory !== 'All' ? activeCategory : 'General',
          example: '',
          translation: '',
        });
        setIsAddCardOpen(false);
        onFlashcardsChange();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save flashcard');
      }
    } catch (err) {
      alert('Failed to save flashcard: ' + err.message);
    }
  };

  const activeCard = filteredCards[currentIndex];

  // Helper to replace card word in example sentence with blank line
  const blankWordInExample = (exampleText, wordText) => {
    if (!exampleText || !wordText) return exampleText;
    const escaped = wordText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return exampleText.replace(regex, '______');
  };

  return (
    <div className="page-section">
      <div className="flashcards-layout">
        {/* Category filters sidebar */}
        <div className="category-sidebar-wrapper">
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', fontSize: '1.1rem' }}>
            Decks
          </h3>
          <div className="category-sidebar">
            <div
              className={`cat-pill ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => selectCategory('All')}
            >
              <span>📂 All Decks</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({flashcards.length})</span>
            </div>

            {categories.map((cat) => {
              const count = flashcards.filter((c) => c.category === cat).length;
              const isSystem = cat === 'General' || cat === 'Context';
              return (
                <div
                  key={cat}
                  className={`cat-pill ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => selectCategory(cat)}
                >
                  <span>🏷️ {cat}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({count})</span>
                    {!isSystem && (
                      <button
                        className="cat-delete-btn"
                        onClick={(e) => handleDeleteCategory(cat, e)}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '16px' }}
            onClick={() => setIsAddCatOpen(true)}
          >
            ➕ New Category
          </button>
        </div>

        {/* Card study interface */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="flashcard-tools">
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setNewCard(prev => ({
                  ...prev,
                  category: activeCategory !== 'All' ? activeCategory : 'General'
                }));
                setIsAddCardOpen(true);
              }}
            >
              ➕ Add Card
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showContextOnly}
                  onChange={(e) => setShowContextOnly(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Context Blanks
              </label>
              <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={shuffleDeck}>
                🔀 Shuffle
              </button>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div
              className="card-glass"
              style={{
                width: '100%',
                maxWidth: '480px',
                minHeight: '300px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎴</span>
              <p>No cards in this deck yet.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                Click <strong>Add Card</strong> above or save context vocabulary from the Reading Lounge!
              </p>
            </div>
          ) : (
            <>
              {/* Card Container */}
              <div
                className={`flashcard-container ${isFlipped ? 'flipped' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className="flashcard-inner">
                  {/* Front */}
                  <div className="flashcard-front">
                    <span className="flashcard-word">{activeCard?.word}</span>
                    <span className="flashcard-pronunciation">
                      [{activeCard?.category}]
                    </span>
                  </div>
                  {/* Back */}
                  <div className="flashcard-back">
                    <h3 className="flashcard-definition">{activeCard?.definition}</h3>
                    {activeCard?.example && (
                      <div className="flashcard-example-box">
                        <p className="flashcard-example">
                          {showContextOnly
                            ? blankWordInExample(activeCard.example, activeCard.word)
                            : activeCard.example}
                        </p>
                        <p className="flashcard-translation">{activeCard.translation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="deck-controls">
                <button
                  className="btn btn-secondary"
                  onClick={(e) => navigateCard(-1, e)}
                  disabled={filteredCards.length <= 1}
                >
                  &larr; Previous
                </button>
                <span className="card-counter">
                  {currentIndex + 1} / {filteredCards.length}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={(e) => navigateCard(1, e)}
                  disabled={filteredCards.length <= 1}
                >
                  Next &rarr;
                </button>
              </div>

              {activeCard && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      color: 'var(--color-danger)',
                      fontSize: '0.9rem',
                      padding: '6px 12px',
                      fontWeight: confirmingDeleteId === activeCard._id ? '700' : '500',
                      animation: confirmingDeleteId === activeCard._id ? 'pulse-danger 1.1s infinite alternate ease-in-out' : 'none'
                    }}
                    onClick={(e) => handleDeleteCardClick(activeCard._id, e)}
                  >
                    {confirmingDeleteId === activeCard._id ? '⚠️ Confirm Delete?' : '🗑️ Delete Card'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      <div className={`modal-overlay ${isAddCatOpen ? 'open' : ''}`}>
        <div className="modal-content">
          <button className="modal-close" onClick={() => setIsAddCatOpen(false)}>
            &times;
          </button>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>Create New Category</h2>
          <form onSubmit={handleAddCategorySubmit}>
            <div className="form-group">
              <label htmlFor="newCatName" className="form-label">
                Category Name
              </label>
              <input
                type="text"
                id="newCatName"
                className="form-input"
                placeholder="e.g. Hobbies, Business..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Create Category
            </button>
          </form>
        </div>
      </div>

      {/* Add Flashcard Modal */}
      <div className={`modal-overlay ${isAddCardOpen ? 'open' : ''}`}>
        <div className="modal-content">
          <button className="modal-close" onClick={() => setIsAddCardOpen(false)}>
            &times;
          </button>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>Add Custom Flashcard</h2>
          <form onSubmit={handleAddCardSubmit}>
            <div className="form-group">
              <label htmlFor="newCardWord" className="form-label">
                Vietnamese Word
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="newCardWord"
                  className="form-input"
                  placeholder="e.g. Chào buổi sáng"
                  value={newCard.word}
                  onChange={(e) => setNewCard({ ...newCard, word: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('word', 'definition', 'vi', 'en')}
                  disabled={isTranslating.word}
                >
                  {isTranslating.word ? '...' : '✨ to English'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="newCardDef" className="form-label">
                English Translation
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="newCardDef"
                  className="form-input"
                  placeholder="e.g. Good morning"
                  value={newCard.definition}
                  onChange={(e) => setNewCard({ ...newCard, definition: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('definition', 'word', 'en', 'vi')}
                  disabled={isTranslating.definition}
                >
                  {isTranslating.definition ? '...' : '✨ to Vietnamese'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="cardCategorySelect" className="form-label">
                Category Deck
              </label>
              <select
                id="cardCategorySelect"
                className="form-select"
                value={newCard.category}
                onChange={(e) => setNewCard({ ...newCard, category: e.target.value })}
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="newCardExample" className="form-label">
                Example Sentence (Optional)
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="newCardExample"
                  className="form-input"
                  placeholder="e.g. Chào buổi sáng cô ạ."
                  value={newCard.example}
                  onChange={(e) => setNewCard({ ...newCard, example: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('example', 'translation', 'vi', 'en')}
                  disabled={isTranslating.example}
                >
                  {isTranslating.example ? '...' : '✨ to English'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="newCardTrans" className="form-label">
                Example Translation (Optional)
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="newCardTrans"
                  className="form-input"
                  placeholder="e.g. Good morning, ma'am."
                  value={newCard.translation}
                  onChange={(e) => setNewCard({ ...newCard, translation: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('translation', 'example', 'en', 'vi')}
                  disabled={isTranslating.translation}
                >
                  {isTranslating.translation ? '...' : '✨ to Vietnamese'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Save Flashcard
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
