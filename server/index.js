const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/words', require('./routes/words_routes'));
app.use('/api/progress', require('./routes/progress_routes'));
app.use('/api/speaking/profile', require('./routes/speaking_profile_routes'));
app.use('/api/speaking/topics', require('./routes/speaking_topics_routes'));
app.use('/api/speaking/qa', require('./routes/speaking_qa_routes'));
app.use('/api/speaking/progress', require('./routes/speaking_progress_routes'));

// Health check
app.get('/', (req, res) => {
    res.send('Dutch Learning App API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
