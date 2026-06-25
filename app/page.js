'use client';

import React, { useState, useEffect } from 'react';
import DashboardView from '../components/DashboardView';
import ReadingLoungeView from '../components/ReadingLoungeView';
import FlashcardsView from '../components/FlashcardsView';
import DictionaryView from '../components/DictionaryView';
import TranslatorView from '../components/TranslatorView';

export default function AppHome() {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [progress, setProgress] = useState({ streak: 0, articlesRead: [] });
  const [flashcards, setFlashcards] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load all user metrics and database items
  const loadAllData = async () => {
    try {
      const [progRes, vocabRes, cardsRes, catsRes] = await Promise.all([
        fetch('/api/progress'),
        fetch('/api/vocabulary'),
        fetch('/api/flashcards'),
        fetch('/api/categories'),
      ]);

      if (progRes.ok && vocabRes.ok && cardsRes.ok && catsRes.ok) {
        const [prog, vocab, cards, cats] = await Promise.all([
          progRes.json(),
          vocabRes.json(),
          cardsRes.json(),
          catsRes.json(),
        ]);

        setProgress(prog);
        setVocabulary(vocab);
        setFlashcards(cards);
        setCategories(cats.map((c) => c.name));
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Perform active check-in on mount, then reload metrics
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await fetch('/api/progress/active', { method: 'POST' });
      } catch (err) {
        console.error('Active check-in failed:', err);
      }
      await loadAllData();
    };
    initializeApp();
  }, []);

  const handleMarkAsRead = async (articleId) => {
    try {
      const res = await fetch('/api/progress/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      if (res.ok) {
        const updatedProg = await res.json();
        setProgress(updatedProg);
      }
    } catch (err) {
      console.error('Could not log article read progress:', err);
    }
  };

  const handleNavigate = (viewId) => {
    setActiveView(viewId);
    setSidebarOpen(false);
  };

  // Render view-specific headers dynamically
  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard';
      case 'reading':
        return 'Reading Lounge';
      case 'flashcards':
        return 'Flashcard Decks';
      case 'dictionary':
        return 'Context Vocab';
      case 'translator':
        return 'English Translator';
      default:
        return 'Learn Vietnamese';
    }
  };

  const getViewSubtitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Study recommendations & streak overview';
      case 'reading':
        return 'Learn words directly from real context sentences';
      case 'flashcards':
        return 'Customized flashcard decks filtered by category';
      case 'dictionary':
        return 'Manage and search your saved vocabulary';
      case 'translator':
        return 'Translate English words & compare Northern and Southern dialects';
      default:
        return 'Learn from Context, not in Isolation';
    }
  };

  const savedWordList = vocabulary.map((v) => v.word.toLowerCase());

  return (
    <div className="app-container">
      {/* Mobile view header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItem: 'center', gap: '8px' }}>
          <div className="logo-icon">V</div>
          <div className="logo-text">Viet Learner</div>
        </div>
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          &#9776;
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-icon">V</div>
          <div className="logo-text">Viet Learner</div>
        </div>

        <nav className="sidebar-nav">
          <div
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
          >
            <span>📊 Dashboard</span>
          </div>
          <div
            className={`nav-item ${activeView === 'reading' ? 'active' : ''}`}
            onClick={() => handleNavigate('reading')}
          >
            <span>📚 Reading Lounge</span>
          </div>
          <div
            className={`nav-item ${activeView === 'flashcards' ? 'active' : ''}`}
            onClick={() => handleNavigate('flashcards')}
          >
            <span>🎴 Flashcard Decks</span>
          </div>
          <div
            className={`nav-item ${activeView === 'dictionary' ? 'active' : ''}`}
            onClick={() => handleNavigate('dictionary')}
          >
            <span>📖 Context Vocab</span>
          </div>
          <div
            className={`nav-item ${activeView === 'translator' ? 'active' : ''}`}
            onClick={() => handleNavigate('translator')}
          >
            <span>🌐 Translator</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="streak-pill">
            <span>🔥</span> <span>{progress.streak}</span> Day Streak
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        <header className="content-header">
          <div>
            <h1 className="page-title">{getViewTitle()}</h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {getViewSubtitle()}
            </div>
          </div>
        </header>

        <div className="content-body">
          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '60%',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
              }}
            >
              Loading Viet Learner modules...
            </div>
          ) : (
            <>
              {activeView === 'dashboard' && (
                <DashboardView
                  progress={progress}
                  vocabCount={vocabulary.length}
                  flashcardCount={flashcards.length}
                  onNavigate={handleNavigate}
                />
              )}
              {activeView === 'reading' && (
                <ReadingLoungeView
                  savedWords={savedWordList}
                  onVocabSaved={loadAllData}
                  onMarkAsRead={handleMarkAsRead}
                />
              )}
              {activeView === 'flashcards' && (
                <FlashcardsView
                  flashcards={flashcards}
                  categories={categories}
                  onFlashcardsChange={loadAllData}
                />
              )}
              {activeView === 'dictionary' && (
                <DictionaryView vocabulary={vocabulary} onVocabDeleted={loadAllData} />
              )}
              {activeView === 'translator' && (
                <TranslatorView
                  savedWords={savedWordList}
                  categories={categories}
                  onVocabSaved={loadAllData}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
