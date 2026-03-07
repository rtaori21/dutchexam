const Database = require('better-sqlite3');
const path = require('path');

// Initialize DB
const dbPath = path.resolve(__dirname, 'dutch_app.db');
const db = new Database(dbPath);

// Create Tables
const schema = `
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dutch TEXT NOT NULL,
    english TEXT NOT NULL,
    ipa TEXT,
    example_dutch TEXT,
    example_english TEXT,
    category TEXT DEFAULT 'general'
  );

  CREATE TABLE IF NOT EXISTS progress (
    word_id INTEGER PRIMARY KEY,
    box INTEGER DEFAULT 0, -- 0: New, 1: Learning, 5: Mastered
    next_review INTEGER DEFAULT 0, -- Timestamp
    mastered INTEGER DEFAULT 0,
    FOREIGN KEY (word_id) REFERENCES words (id)
  );

  CREATE TABLE IF NOT EXISTS speaking_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'MessageCircle',
    sort_order INTEGER DEFAULT 0,
    is_custom INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS speaking_qa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    question_en TEXT NOT NULL,
    question_nl TEXT,
    question_phonetic TEXT,
    answer_en TEXT,
    answer_nl TEXT,
    answer_phonetic TEXT,
    grammar_notes TEXT,
    common_mistakes TEXT,
    is_personalized INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    FOREIGN KEY (topic_id) REFERENCES speaking_topics(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS speaking_progress (
    qa_id INTEGER PRIMARY KEY,
    confidence INTEGER DEFAULT 0,
    times_practiced INTEGER DEFAULT 0,
    last_practiced INTEGER,
    next_review INTEGER DEFAULT 0,
    FOREIGN KEY (qa_id) REFERENCES speaking_qa(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    age TEXT,
    city TEXT,
    country TEXT DEFAULT 'Nederland',
    occupation TEXT,
    family_description TEXT,
    hobbies TEXT,
    languages TEXT,
    study_reason TEXT,
    daily_routine TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS user_profile_custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
    field_value TEXT,
    UNIQUE(field_name)
  );
`;

db.exec(schema);

module.exports = db;
