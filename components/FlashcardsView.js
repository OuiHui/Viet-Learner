'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';

export default function FlashcardsView({
  flashcards,
  categories,
  onFlashcardsChange,
  setFlashcards,
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [showContextOnly, setShowContextOnly] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Quizlet unified layout states
  const [studyMode, setStudyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [practiceCards, setPracticeCards] = useState([]);

  // Modals state
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isEditCardOpen, setIsEditCardOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Bulk import states
  const [importCategory, setImportCategory] = useState('General');
  const [importListText, setImportListText] = useState('');
  const [importingState, setImportingState] = useState(false);
  const [importResultMsg, setImportResultMsg] = useState({ type: '', text: '' });

  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const deleteTimeoutRef = useRef(null);

  // Form states
  const [newCatName, setNewCatName] = useState('');
  const [newCard, setNewCard] = useState({
    word: '',
    definition: '',
    category: 'General',
    example: '',
    translation: '',
  });
  const [editingCard, setEditingCard] = useState({
    _id: '',
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

  const audioRef = useRef(null);

  // Cleanup delete timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  // Compute cards for list view
  const listCards = useMemo(() => {
    let cards = [...flashcards];
    if (activeCategory === 'Starred') {
      cards = cards.filter((c) => c.starred);
    } else if (activeCategory !== 'All') {
      cards = cards.filter((c) => c.category === activeCategory);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(
        (c) =>
          c.word.toLowerCase().includes(q) ||
          c.definition.toLowerCase().includes(q) ||
          (c.example && c.example.toLowerCase().includes(q))
      );
    }
    return cards;
  }, [activeCategory, flashcards, searchQuery]);

  // Active card in practice mode
  const activeCard = practiceCards[currentIndex];

  const selectCategory = (cat) => {
    setActiveCategory(cat);
    setStudyMode(false);
    setSearchQuery('');
  };

  const startPractice = (shouldShuffle = false) => {
    let cards = [...listCards];
    if (shouldShuffle) {
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    setPracticeCards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setStudyMode(true);
  };

  const navigateCard = (direction, e) => {
    if (e) e.stopPropagation();
    if (practiceCards.length <= 1) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        let nextIndex = prev + direction;
        if (nextIndex < 0) nextIndex = practiceCards.length - 1;
        if (nextIndex >= practiceCards.length) nextIndex = 0;
        return nextIndex;
      });
    }, 150); // small delay to match flip transition
  };

  const shuffleDeck = () => {
    if (practiceCards.length <= 1) return;
    setIsFlipped(false);
    setTimeout(() => {
      setPracticeCards((prev) => {
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

  // Speaker text-to-speech helper
  const speakText = (text, e) => {
    if (e) e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audioUrl = `/api/translate/tts?q=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch((err) => {
      console.warn('Google TTS failed, falling back to Web Speech synthesis:', err);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find((v) => v.lang.startsWith('vi'));
        if (viVoice) {
          utterance.voice = viVoice;
        }
        window.speechSynthesis.speak(utterance);
      }
    });
  };

  const toggleStar = async (cardId, e) => {
    if (e) e.stopPropagation();
    const card = flashcards.find((c) => c._id === cardId);
    if (!card) return;
    const updatedStarred = !card.starred;

    // Optimistic UI update
    setFlashcards((prev) =>
      prev.map((c) => (c._id === cardId ? { ...c, starred: updatedStarred } : c))
    );
    setPracticeCards((prev) =>
      prev.map((c) => (c._id === cardId ? { ...c, starred: updatedStarred } : c))
    );

    try {
      const res = await fetch(`/api/flashcards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: card.word,
          definition: card.definition,
          category: card.category,
          example: card.example || '',
          translation: card.translation || '',
          starred: updatedStarred,
        }),
      });
      if (!res.ok) {
        // Revert
        setFlashcards((prev) =>
          prev.map((c) => (c._id === cardId ? { ...c, starred: !updatedStarred } : c))
        );
        setPracticeCards((prev) =>
          prev.map((c) => (c._id === cardId ? { ...c, starred: !updatedStarred } : c))
        );
        const err = await res.json();
        alert(err.error || 'Failed to update star status');
      } else {
        onFlashcardsChange(); // trigger background sync
      }
    } catch (err) {
      setFlashcards((prev) =>
        prev.map((c) => (c._id === cardId ? { ...c, starred: !updatedStarred } : c))
      );
      setPracticeCards((prev) =>
        prev.map((c) => (c._id === cardId ? { ...c, starred: !updatedStarred } : c))
      );
      alert('Failed to update star status: ' + err.message);
    }
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

      const backupCards = [...flashcards];
      // Optimistic delete
      setFlashcards(prev => prev.filter(c => c._id !== cardId));
      setPracticeCards(prev => prev.filter(c => c._id !== cardId));

      try {
        const res = await fetch(`/api/flashcards/${cardId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          onFlashcardsChange();
        } else {
          setFlashcards(backupCards);
          const err = await res.json();
          alert(err.error || 'Failed to delete card');
        }
      } catch (err) {
        setFlashcards(backupCards);
        alert('Failed to delete card: ' + err.message);
      }
    } else {
      setConfirmingDeleteId(cardId);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      deleteTimeoutRef.current = setTimeout(() => {
        setConfirmingDeleteId(null);
      }, 15000);
    }
  };

  const handleEditCardClick = (card, e) => {
    if (e) e.stopPropagation();
    setConfirmingDeleteId(null);
    setEditingCard({
      _id: card._id,
      word: card.word,
      definition: card.definition,
      category: card.category || 'General',
      example: card.example || '',
      translation: card.translation || '',
    });
    setIsEditCardOpen(true);
  };

  const translateField = async (sourceField, targetField, sourceLang, targetLang, isEdit = false) => {
    const targetObj = isEdit ? editingCard : newCard;
    const textToTranslate = targetObj[sourceField];
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
        if (isEdit) {
          setEditingCard((prev) => ({
            ...prev,
            [targetField]: data.translation
          }));
        } else {
          setNewCard((prev) => ({
            ...prev,
            [targetField]: data.translation
          }));
        }
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
          category: (activeCategory !== 'All' && activeCategory !== 'Starred') ? activeCategory : 'General',
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

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importListText.trim() || !importCategory.trim()) return;
    setImportingState(true);
    setImportResultMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/flashcards/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: importCategory, listText: importListText }),
      });
      if (res.ok) {
        const data = await res.json();
        setImportResultMsg({
          type: 'success',
          text: `Successfully imported ${data.count} terms into deck "${importCategory}"!`
        });
        setImportListText('');
        onFlashcardsChange();
        setTimeout(() => {
          setIsImportOpen(false);
          setImportResultMsg({ type: '', text: '' });
        }, 1500);
      } else {
        const err = await res.json();
        setImportResultMsg({ type: 'error', text: err.error || 'Failed to import cards.' });
      }
    } catch (err) {
      setImportResultMsg({ type: 'error', text: err.message });
    } finally {
      setImportingState(false);
    }
  };

  const handleEditCardSubmit = async (e) => {
    e.preventDefault();
    if (!editingCard.word.trim() || !editingCard.definition.trim() || !editingCard.category) return;

    const backupCards = [...flashcards];
    // Optimistic update
    setFlashcards(prev => prev.map(c => c._id === editingCard._id ? { ...c, ...editingCard } : c));
    setIsEditCardOpen(false);

    try {
      const res = await fetch(`/api/flashcards/${editingCard._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: editingCard.word.trim(),
          definition: editingCard.definition.trim(),
          category: editingCard.category,
          example: editingCard.example.trim(),
          translation: editingCard.translation.trim(),
        }),
      });

      if (res.ok) {
        onFlashcardsChange();
      } else {
        setFlashcards(backupCards);
        const err = await res.json();
        alert(err.error || 'Failed to update flashcard');
      }
    } catch (err) {
      setFlashcards(backupCards);
      alert('Failed to update flashcard: ' + err.message);
    }
  };

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

            <div
              className={`cat-pill ${activeCategory === 'Starred' ? 'active' : ''}`}
              onClick={() => selectCategory('Starred')}
            >
              <span>⭐ Starred Terms</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({flashcards.filter((c) => c.starred).length})</span>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-glass)', margin: '8px 0' }} />

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

        {/* Card study or list interface */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {!studyMode ? (
            /* DECK LIST VIEW */
            <>
              <div className="deck-view-header">
                <div className="deck-info">
                  <h2 className="deck-title">
                    {activeCategory === 'All' ? (
                      <span>📂 All Decks</span>
                    ) : activeCategory === 'Starred' ? (
                      <span>⭐ Starred Terms</span>
                    ) : (
                      <span>🏷️ {activeCategory}</span>
                    )}
                    <span className="deck-count-badge">{listCards.length} terms</span>
                  </h2>
                </div>
                
                <div className="deck-actions">
                  <button
                    className="btn btn-primary"
                    disabled={listCards.length === 0}
                    onClick={() => startPractice(false)}
                  >
                    🎴 Practice Flashcards
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={listCards.length === 0}
                    onClick={() => startPractice(true)}
                  >
                    🔀 Shuffle Practice
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setNewCard((prev) => ({
                        ...prev,
                        category: (activeCategory !== 'All' && activeCategory !== 'Starred') ? activeCategory : 'General'
                      }));
                      setIsAddCardOpen(true);
                    }}
                  >
                    ➕ Add Card
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setImportCategory(
                        (activeCategory !== 'All' && activeCategory !== 'Starred') ? activeCategory : 'General'
                      );
                      setImportListText('');
                      setImportResultMsg({ type: '', text: '' });
                      setIsImportOpen(true);
                    }}
                  >
                    📥 Bulk Import
                  </button>
                </div>
              </div>

              {/* Search tool */}
              <div style={{ marginBottom: '24px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', maxWidth: '480px' }}
                  placeholder="🔍 Search words or definitions in this deck..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {listCards.length === 0 ? (
                <div
                  className="card-glass"
                  style={{
                    width: '100%',
                    minHeight: '260px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎴</span>
                  <p>No cards in this deck view.</p>
                  {activeCategory === 'Starred' ? (
                    <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Star cards in other decks to see them in this playlist!
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Click <strong>Add Card</strong> above or save vocabulary from the Reading Lounge!
                    </p>
                  )}
                </div>
              ) : (
                <div className="quizlet-list-container">
                  {listCards.map((card) => (
                    <div key={card._id} className="quizlet-row-card">
                      <div className="quizlet-card-content">
                        <div className="quizlet-main-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="quizlet-word">{card.word}</span>
                            <button
                              className="btn-audio"
                              style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}
                              onClick={(e) => speakText(card.word, e)}
                            >
                              🔊
                            </button>
                          </div>
                          <span className="quizlet-definition">{card.definition}</span>
                        </div>
                        {card.example && (
                          <div className="quizlet-example-box">
                            <p className="quizlet-sentence">{card.example}</p>
                            <p className="quizlet-translation">{card.translation}</p>
                          </div>
                        )}
                      </div>

                      <div className="quizlet-actions">
                        <button
                          type="button"
                          className={`star-btn ${card.starred ? 'starred' : ''}`}
                          onClick={(e) => toggleStar(card._id, e)}
                          title={card.starred ? 'Unstar term' : 'Star term'}
                        >
                          {card.starred ? '★' : '☆'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={(e) => handleEditCardClick(card, e)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            color: 'var(--color-danger)',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: confirmingDeleteId === card._id ? '700' : '500',
                            animation: confirmingDeleteId === card._id ? 'pulse-danger 1.1s infinite alternate ease-in-out' : 'none'
                          }}
                          onClick={(e) => handleDeleteCardClick(card._id, e)}
                        >
                          {confirmingDeleteId === card._id ? '⚠️ Confirm?' : '🗑️ Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* PRACTICE DECK VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="study-back-header">
                <button className="btn-back-to-list" onClick={() => setStudyMode(false)}>
                  ⬅️ Back to Deck List
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

              {practiceCards.length === 0 ? (
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
                  }}
                >
                  <p>No cards inside this play queue.</p>
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
                        <button
                          type="button"
                          className={`star-btn study-star-btn ${activeCard?.starred ? 'starred' : ''}`}
                          onClick={(e) => toggleStar(activeCard?._id, e)}
                          title={activeCard?.starred ? 'Unstar term' : 'Star term'}
                        >
                          {activeCard?.starred ? '★' : '☆'}
                        </button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                          <span className="flashcard-word">{activeCard?.word}</span>
                          <button
                            className="btn-audio"
                            style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}
                            onClick={(e) => speakText(activeCard?.word, e)}
                          >
                            🔊
                          </button>
                        </div>
                        <span className="flashcard-pronunciation">
                          [{activeCard?.category}]
                        </span>
                      </div>
                      
                      {/* Back */}
                      <div className="flashcard-back">
                        <button
                          type="button"
                          className={`star-btn study-star-btn ${activeCard?.starred ? 'starred' : ''}`}
                          onClick={(e) => toggleStar(activeCard?._id, e)}
                          title={activeCard?.starred ? 'Unstar term' : 'Star term'}
                        >
                          {activeCard?.starred ? '★' : '☆'}
                        </button>

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
                      disabled={practiceCards.length <= 1}
                    >
                      &larr; Previous
                    </button>
                    <span className="card-counter">
                      {currentIndex + 1} / {practiceCards.length}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => navigateCard(1, e)}
                      disabled={practiceCards.length <= 1}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </>
              )}
            </div>
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

      {/* Edit Flashcard Modal */}
      <div className={`modal-overlay ${isEditCardOpen ? 'open' : ''}`}>
        <div className="modal-content">
          <button className="modal-close" onClick={() => setIsEditCardOpen(false)}>
            &times;
          </button>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>Edit Flashcard</h2>
          <form onSubmit={handleEditCardSubmit}>
            <div className="form-group">
              <label htmlFor="editCardWord" className="form-label">
                Vietnamese Word
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editCardWord"
                  className="form-input"
                  placeholder="e.g. Chào buổi sáng"
                  value={editingCard.word}
                  onChange={(e) => setEditingCard({ ...editingCard, word: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('word', 'definition', 'vi', 'en', true)}
                  disabled={isTranslating.word}
                >
                  {isTranslating.word ? '...' : '✨ to English'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="editCardDef" className="form-label">
                English Translation
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editCardDef"
                  className="form-input"
                  placeholder="e.g. Good morning"
                  value={editingCard.definition}
                  onChange={(e) => setEditingCard({ ...editingCard, definition: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('definition', 'word', 'en', 'vi', true)}
                  disabled={isTranslating.definition}
                >
                  {isTranslating.definition ? '...' : '✨ to Vietnamese'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="editCardCategorySelect" className="form-label">
                Category Deck
              </label>
              <select
                id="editCardCategorySelect"
                className="form-select"
                value={editingCard.category}
                onChange={(e) => setEditingCard({ ...editingCard, category: e.target.value })}
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
              <label htmlFor="editCardExample" className="form-label">
                Example Sentence (Optional)
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editCardExample"
                  className="form-input"
                  placeholder="e.g. Chào buổi sáng cô ạ."
                  value={editingCard.example}
                  onChange={(e) => setEditingCard({ ...editingCard, example: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('example', 'translation', 'vi', 'en', true)}
                  disabled={isTranslating.example}
                >
                  {isTranslating.example ? '...' : '✨ to English'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="editCardTrans" className="form-label">
                Example Translation (Optional)
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editCardTrans"
                  className="form-input"
                  placeholder="e.g. Good morning, ma'am."
                  value={editingCard.translation}
                  onChange={(e) => setEditingCard({ ...editingCard, translation: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('translation', 'example', 'en', 'vi', true)}
                  disabled={isTranslating.translation}
                >
                  {isTranslating.translation ? '...' : '✨ to Vietnamese'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Save Changes
            </button>
          </form>
        </div>
      </div>

      {/* Bulk Import Modal */}
      <div className={`modal-overlay ${isImportOpen ? 'open' : ''}`}>
        <div className="modal-content" style={{ maxWidth: '600px' }}>
          <button className="modal-close" onClick={() => setIsImportOpen(false)}>
            &times;
          </button>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>Bulk Import Vocab Deck</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Paste a list of Vietnamese terms below (one per line, comma-separated, or semicolon-separated).
            Optional: use <code>word : definition | example | translation</code> format for full custom entries.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Quick Templates (Click to fill)
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => {
                  setImportCategory('Numbers');
                  setImportListText('một : one, hai : two, ba : three, bốn : four, năm : five, sáu : six, bảy : seven, tám : eight, chín : nine, mười : ten');
                }}
              >
                🔢 Numbers (1-10)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => {
                  setImportCategory('Colors');
                  setImportListText('đỏ : red, xanh lá : green, xanh dương : blue, vàng : yellow, cam : orange, tím : purple, đen : black, trắng : white');
                }}
              >
                🎨 Colors
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => {
                  setImportCategory('General');
                  setImportListText('táo, chuối, dâu tây, dưa hấu, quả cam, quả dừa');
                }}
              >
                🍎 Fruits (Auto-translate)
              </button>
            </div>
          </div>

          <form onSubmit={handleImportSubmit}>
            <div className="form-group">
              <label htmlFor="importCategorySelect" className="form-label">
                Target Category Deck
              </label>
              <input
                type="text"
                id="importCategorySelect"
                className="form-input"
                placeholder="e.g. Family, Food, Colors..."
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value)}
                required
                disabled={importingState}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="importListText" className="form-label">
                Vocabulary List
              </label>
              <textarea
                id="importListText"
                className="form-input"
                style={{ minHeight: '140px', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                placeholder="chuối&#10;táo&#10;cam&#10;— OR —&#10;đỏ : red&#10;vàng : yellow"
                value={importListText}
                onChange={(e) => setImportListText(e.target.value)}
                required
                disabled={importingState}
              />
            </div>

            {importResultMsg.text && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  background: importResultMsg.type === 'success' ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                  border: importResultMsg.type === 'success' ? '1px solid rgba(46, 213, 115, 0.3)' : '1px solid rgba(255, 71, 87, 0.3)',
                  color: importResultMsg.type === 'success' ? '#2ed573' : '#ff4757',
                }}
              >
                {importResultMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={importingState || !importListText.trim()}
            >
              {importingState ? 'Importing & Translating...' : '📥 Start Bulk Import'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
