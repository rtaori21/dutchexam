import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Dictionary from './pages/Dictionary';
import Flashcards from './pages/Flashcards';
import SpeakingHub from './pages/speaking/SpeakingHub';
import SpeakingProfile from './pages/speaking/SpeakingProfile';
import TopicDetail from './pages/speaking/TopicDetail';
import QAEditor from './pages/speaking/QAEditor';
import FlashcardPractice from './pages/speaking/FlashcardPractice';
import ConversationPractice from './pages/speaking/ConversationPractice';
import AudioPractice from './pages/speaking/AudioPractice';
import QABrowser from './pages/speaking/QABrowser';

function App() {
  return (
    <Router>
      <div className="app-shell">
        <Navbar />
        <main className="container" style={{ marginTop: '20px', paddingBottom: '40px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dictionary" element={<Dictionary />} />
            <Route path="/practice" element={<Flashcards />} />
            <Route path="/speaking/qa" element={<QABrowser />} />
            <Route path="/speaking" element={<SpeakingHub />} />
            <Route path="/speaking/profile" element={<SpeakingProfile />} />
            <Route path="/speaking/topic/:topicId" element={<TopicDetail />} />
            <Route path="/speaking/topic/:topicId/edit/:qaId" element={<QAEditor />} />
            <Route path="/speaking/practice/flashcard/:topicId?" element={<FlashcardPractice />} />
            <Route path="/speaking/practice/conversation/:topicId?" element={<ConversationPractice />} />
            <Route path="/speaking/practice/audio/:topicId?" element={<AudioPractice />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
