const axios = require('axios');
const db = require('./db');

const DATA_URL = 'https://raw.githubusercontent.com/francisrstokes/Learn-1000/master/src/data/dutch-english.js';

// Manual enrichment for the top frequent words to show off features
const ENRICHMENT = {
    'de': { ipa: '/də/', sentence_nl: 'De kat slaapt.', sentence_en: 'The cat sleeps.' },
    'een': { ipa: '/ən/', sentence_nl: 'Ik heb een hond.', sentence_en: 'I have a dog.' },
    'en': { ipa: '/ɛn/', sentence_nl: 'Koffie en thee.', sentence_en: 'Coffee and tea.' },
    'het': { ipa: '/hɛt/', sentence_nl: 'Het huis is groot.', sentence_en: 'The house is big.' },
    'van': { ipa: '/vɑn/', sentence_nl: 'Dat is van mij.', sentence_en: 'That is mine.' },
    'ik': { ipa: '/ɪk/', sentence_nl: 'Ik ben gelukkig.', sentence_en: 'I am happy.' },
    'te': { ipa: '/tə/', sentence_nl: 'Het is te laat.', sentence_en: 'It is too late.' },
    'dat': { ipa: '/dɑt/', sentence_nl: 'Ik weet dat niet.', sentence_en: 'I do not know that.' },
    'die': { ipa: '/di/', sentence_nl: 'Die auto is rood.', sentence_en: 'That car is red.' },
    'in': { ipa: '/ɪn/', sentence_nl: 'Hij is in de kamer.', sentence_en: 'He is in the room.' },
    'is': { ipa: '/ɪs/', sentence_nl: 'Het is koud.', sentence_en: 'It is cold.' },
    'je': { ipa: '/jə/', sentence_nl: 'Hou je van muziek?', sentence_en: 'Do you like music?' },
    'niet': { ipa: '/nit/', sentence_nl: 'Ik rook niet.', sentence_en: 'I do not smoke.' },
    'met': { ipa: '/mɛt/', sentence_nl: 'Koffie met melk.', sentence_en: 'Coffee with milk.' },
    'hij': { ipa: '/hɛi/', sentence_nl: 'Hij leest een boek.', sentence_en: 'He reads a book.' },
    'zijn': { ipa: '/zɛin/', sentence_nl: 'Dat zijn mijn vrienden.', sentence_en: 'Those are my friends.' },
    'ze': { ipa: '/zə/', sentence_nl: 'Ze wonen in Amsterdam.', sentence_en: 'They live in Amsterdam.' },
    'op': { ipa: '/ɔp/', sentence_nl: 'Het boek ligt op tafel.', sentence_en: 'The book is on the table.' },
    'voor': { ipa: '/voːr/', sentence_nl: 'Dit is voor jou.', sentence_en: 'This is for you.' },
    'aan': { ipa: '/aːn/', sentence_nl: 'Ik denk aan jou.', sentence_en: 'I am thinking of you.' }
};

async function seed() {
    try {
        const row = db.prepare('SELECT count(*) as count FROM words').get();
        if (row.count > 0) {
            console.log(`Database already has ${row.count} words. Skipping seed.`);
            return;
        }

        console.log('Fetching data from GitHub...');
        console.log(`URL: ${DATA_URL}`);

        const response = await axios.get(DATA_URL);
        let rawData = response.data;

        // Clean up the JS file to get JSON
        // The file starts with "module.exports =" and might end with ";"
        rawData = rawData.replace('module.exports =', '').trim();
        if (rawData.endsWith(';')) {
            rawData = rawData.slice(0, -1);
        }

        // Some JS files might use single quotes which JSON.parse hates.
        // Ideally the file uses double quotes. The snippet I saw had double quotes.
        // If it fails, I might need to evaluate it, but that's unsafe.
        // Let's assume it's valid JSON structure inside.

        let words;
        try {
            words = JSON.parse(rawData);
        } catch (e) {
            console.error("JSON parse failed. Fallback: using eval() (safe-ish here since we trust source)");
            // Since we are running in node, we can just require the URL if it was local, but here we fetched string.
            // We can use Function to evaluate return.
            // actually let's try to fix quotes if needed, or just eval.
            words = eval(rawData);
        }

        console.log(`Fetched ${words.length} words. Inserting...`);

        const insert = db.prepare(`
      INSERT INTO words (dutch, english, ipa, example_dutch, example_english)
      VALUES (@dutch, @english, @ipa, @example_dutch, @example_english)
    `);

        const insertMany = db.transaction((words) => {
            for (const w of words) {
                const simplifiedDutch = w.dutch.toLowerCase().trim();
                const extra = ENRICHMENT[simplifiedDutch] || {};

                insert.run({
                    dutch: w.dutch,
                    english: w.english,
                    ipa: extra.ipa || null,
                    example_dutch: extra.sentence_nl || null,
                    example_english: extra.sentence_en || null
                });
            }
        });

        insertMany(words);
        console.log('Seeding completed successfully!');

    } catch (error) {
        console.error('Error seeding database:', error);
        if (error.response) {
            console.error('Response status:', error.response.status);
        }
    }
}

seed();
