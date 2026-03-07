const db = require('./db');

function seed() {
  // Check if speaking_topics already has data
  const existing = db.prepare('SELECT count(*) as count FROM speaking_topics').get();
  if (existing.count > 0) {
    console.log(`Speaking topics already seeded (${existing.count} topics found). Skipping.`);
    return;
  }

  console.log('Seeding speaking topics...');

  const insertTopic = db.prepare(`
    INSERT INTO speaking_topics (slug, name, description, icon, sort_order)
    VALUES (@slug, @name, @description, @icon, @sort_order)
  `);

  const insertQA = db.prepare(`
    INSERT INTO speaking_qa (
      topic_id, sort_order, question_en, question_nl, question_phonetic,
      answer_en, answer_nl, answer_phonetic, grammar_notes, common_mistakes,
      is_personalized
    ) VALUES (
      @topic_id, @sort_order, @question_en, @question_nl, @question_phonetic,
      @answer_en, @answer_nl, @answer_phonetic, @grammar_notes, @common_mistakes,
      @is_personalized
    )
  `);

  // ─── Topic definitions ───────────────────────────────────────────────

  const topics = [
    {
      slug: 'about-myself',
      name: 'Over Mezelf (About Myself)',
      description: 'Introduce yourself, talk about your background, and share personal information',
      icon: 'User',
      sort_order: 1,
      questions: [
        {
          sort_order: 1,
          question_en: 'What is your name?',
          question_nl: 'Hoe heet je?',
          question_phonetic: 'hoo hayt yuh',
          answer_en: 'My name is [name].',
          answer_nl: 'Mijn naam is [naam].',
          answer_phonetic: 'mayn nahm is [naam]',
          grammar_notes: "'Ik heet' uses the verb 'heten' (to be called). Both 'Ik heet...' and 'Mijn naam is...' work for introductions.",
          common_mistakes: "Don't say 'Ik ben [naam]' for formal introductions - use 'Ik heet' or 'Mijn naam is'.",
          is_personalized: 1
        },
        {
          sort_order: 2,
          question_en: 'How old are you?',
          question_nl: 'Hoe oud ben je?',
          question_phonetic: 'hoo owt ben yuh',
          answer_en: 'I am [age] years old.',
          answer_nl: 'Ik ben [leeftijd] jaar oud.',
          answer_phonetic: 'ik ben [leeftijd] yahr owt',
          grammar_notes: "'Ik ben...jaar oud' - 'zijn' (to be) + age + 'jaar oud'. The word 'oud' is essential.",
          common_mistakes: "Don't forget 'oud' at the end - 'Ik ben 30 jaar' sounds incomplete.",
          is_personalized: 1
        },
        {
          sort_order: 3,
          question_en: 'Where do you live?',
          question_nl: 'Waar woon je?',
          question_phonetic: 'wahr wohn yuh',
          answer_en: 'I live in [city].',
          answer_nl: 'Ik woon in [stad].',
          answer_phonetic: 'ik wohn in [stad]',
          grammar_notes: "'Wonen' means to live/reside somewhere. Use 'in' for cities.",
          common_mistakes: "Don't confuse 'wonen' (to reside) with 'leven' (to be alive). Say 'Ik woon in Amsterdam', not 'Ik leef in Amsterdam'.",
          is_personalized: 1
        },
        {
          sort_order: 4,
          question_en: 'Where are you from?',
          question_nl: 'Waar kom je vandaan?',
          question_phonetic: 'wahr kom yuh van-dahn',
          answer_en: 'I come from [country].',
          answer_nl: 'Ik kom uit [land].',
          answer_phonetic: 'ik kom owt [land]',
          grammar_notes: "'Komen uit' means 'to come from'. 'Uit' is used for countries and cities of origin.",
          common_mistakes: "Don't say 'Ik kom van India' - use 'uit' not 'van' for countries of origin.",
          is_personalized: 1
        },
        {
          sort_order: 5,
          question_en: 'What do you do for work?',
          question_nl: 'Wat doe je voor werk?',
          question_phonetic: 'wat doo yuh vohr werk',
          answer_en: 'I work as a [occupation].',
          answer_nl: 'Ik werk als [beroep].',
          answer_phonetic: 'ik werk als [beroep]',
          grammar_notes: "'Werken als' means 'to work as'. For students: 'Ik studeer' (I study).",
          common_mistakes: "Don't say 'Ik ben werk' - use 'Ik werk als...' or 'Ik ben een...' (I am a...).",
          is_personalized: 1
        },
        {
          sort_order: 6,
          question_en: 'Why are you learning Dutch?',
          question_nl: 'Waarom leer je Nederlands?',
          question_phonetic: 'wahr-om layr yuh nay-der-lants',
          answer_en: 'I am learning Dutch because I live in the Netherlands.',
          answer_nl: 'Ik leer Nederlands omdat ik in Nederland woon.',
          answer_phonetic: 'ik layr nay-der-lants om-dat ik in nay-der-lant wohn',
          grammar_notes: "'Omdat' (because) sends the verb to the end of the clause: 'omdat ik...woon'.",
          common_mistakes: "After 'omdat', the verb goes to the END: 'omdat ik in Nederland woon' NOT 'omdat ik woon in Nederland'.",
          is_personalized: 0
        },
        {
          sort_order: 7,
          question_en: 'Do you have any hobbies?',
          question_nl: "Heb je hobby's?",
          question_phonetic: 'heb yuh hob-bees',
          answer_en: 'Yes, I like [hobby].',
          answer_nl: 'Ja, ik [hobby] graag.',
          answer_phonetic: 'yah, ik [hobby] khrahkh',
          grammar_notes: "'Graag' means 'gladly/with pleasure' and is placed after the verb: 'Ik lees graag' (I like reading).",
          common_mistakes: "Don't say 'Ik hou van lezen boeken' - say 'Ik lees graag' or 'Ik hou van lezen'.",
          is_personalized: 1
        },
        {
          sort_order: 8,
          question_en: 'Are you married?',
          question_nl: 'Ben je getrouwd?',
          question_phonetic: 'ben yuh khuh-trowt',
          answer_en: 'Yes, I am married. / No, I am single.',
          answer_nl: 'Ja, ik ben getrouwd. / Nee, ik ben vrijgezel.',
          answer_phonetic: 'yah, ik ben khuh-trowt. / nay, ik ben vray-khuh-zel',
          grammar_notes: "'Getrouwd' is the past participle of 'trouwen' (to marry). 'Vrijgezel' means single.",
          common_mistakes: "Don't say 'Ik ben single' - use the Dutch word 'vrijgezel'.",
          is_personalized: 0
        },
        {
          sort_order: 9,
          question_en: 'How long have you been in the Netherlands?',
          question_nl: 'Hoe lang ben je al in Nederland?',
          question_phonetic: 'hoo lang ben yuh al in nay-der-lant',
          answer_en: 'I have been here for [X] years.',
          answer_nl: 'Ik ben hier al [X] jaar.',
          answer_phonetic: 'ik ben heer al [X] yahr',
          grammar_notes: "'Al' means 'already/for' in time expressions. Dutch uses present tense for ongoing situations: 'Ik ben hier' not 'Ik ben geweest'.",
          common_mistakes: "Don't use past tense - Dutch uses present tense for ongoing durations: 'Ik ben hier al 2 jaar' NOT 'Ik was hier 2 jaar'.",
          is_personalized: 1
        },
        {
          sort_order: 10,
          question_en: 'Can you tell something about yourself?',
          question_nl: 'Kun je iets over jezelf vertellen?',
          question_phonetic: 'kün yuh eets oh-ver yuh-zelf ver-tel-lun',
          answer_en: 'My name is [name]. I am [age] years old. I come from [country] and I live in [city]. I work as [occupation].',
          answer_nl: 'Mijn naam is [naam]. Ik ben [leeftijd] jaar oud. Ik kom uit [land] en ik woon in [stad]. Ik werk als [beroep].',
          answer_phonetic: 'mayn nahm is [naam]. ik ben [leeftijd] yahr owt. ik kom owt [land] en ik wohn in [stad]. ik werk als [beroep]',
          grammar_notes: "This combines multiple simple sentences with 'en' (and). Keep sentences short at A2 level.",
          common_mistakes: "Don't try to use complex sentences. Short, clear sentences are better at A2 level.",
          is_personalized: 1
        }
      ]
    },
    {
      slug: 'family',
      name: 'Familie (Family)',
      description: 'Talk about your family members, relationships, and family activities',
      icon: 'Users',
      sort_order: 2,
      questions: [
        {
          sort_order: 1,
          question_en: 'Do you have brothers or sisters?',
          question_nl: 'Heb je broers of zussen?',
          question_phonetic: 'heb yuh broors of zü-sun',
          answer_en: 'Yes, I have one brother and one sister.',
          answer_nl: 'Ja, ik heb één broer en één zus.',
          answer_phonetic: 'yah, ik heb ayn broor en ayn züs',
          grammar_notes: "'Heb je' (do you have) - 'hebben' is the verb for possession. Broer/broers, zus/zussen are the singular/plural.",
          common_mistakes: "Don't say 'Ik heb een broers' - use 'één broer' (singular) or 'twee broers' (plural).",
          is_personalized: 0
        },
        {
          sort_order: 2,
          question_en: 'How many people are in your family?',
          question_nl: 'Hoeveel personen heeft je gezin?',
          question_phonetic: 'hoo-vayl per-soh-nun hayft yuh khuh-zin',
          answer_en: 'My family has [X] people.',
          answer_nl: 'Mijn gezin heeft [X] personen.',
          answer_phonetic: 'mayn khuh-zin hayft [X] per-soh-nun',
          grammar_notes: "'Gezin' means nuclear family. 'Familie' is extended family. 'Heeft' is the third person of 'hebben'.",
          common_mistakes: "Don't confuse 'gezin' (household family) with 'familie' (all relatives). For counting members, use 'gezin'.",
          is_personalized: 0
        },
        {
          sort_order: 3,
          question_en: 'What does your partner do?',
          question_nl: 'Wat doet je partner?',
          question_phonetic: 'wat doot yuh part-ner',
          answer_en: 'My partner works as a [job].',
          answer_nl: 'Mijn partner werkt als [beroep].',
          answer_phonetic: 'mayn part-ner werkt als [beroep]',
          grammar_notes: "'Werkt' is third person singular of 'werken'. In Dutch, third person adds -t: ik werk, hij/zij werkt.",
          common_mistakes: "Don't forget the -t ending for he/she: 'hij werkt' not 'hij werk'.",
          is_personalized: 0
        },
        {
          sort_order: 4,
          question_en: 'Do you have children?',
          question_nl: 'Heb je kinderen?',
          question_phonetic: 'heb yuh kin-duh-run',
          answer_en: "Yes, I have [X] children. / No, I don't have children.",
          answer_nl: 'Ja, ik heb [X] kinderen. / Nee, ik heb geen kinderen.',
          answer_phonetic: 'yah, ik heb [X] kin-duh-run. / nay, ik heb khayn kin-duh-run',
          grammar_notes: "'Geen' means 'no/not any' and replaces 'een' in negative sentences: 'een kind' becomes 'geen kind'.",
          common_mistakes: "Don't say 'Ik heb niet kinderen' - use 'geen': 'Ik heb geen kinderen'.",
          is_personalized: 0
        },
        {
          sort_order: 5,
          question_en: 'Where does your family live?',
          question_nl: 'Waar woont je familie?',
          question_phonetic: 'wahr wohnt yuh fah-mee-lee',
          answer_en: 'My family lives in [country/city].',
          answer_nl: 'Mijn familie woont in [land/stad].',
          answer_phonetic: 'mayn fah-mee-lee wohnt in [land/stad]',
          grammar_notes: "'Woont' has a -t because 'familie' is third person. Verb conjugation: ik woon, je woont, hij/zij woont.",
          common_mistakes: "Don't forget the -t: 'mijn familie woont' not 'mijn familie woon'.",
          is_personalized: 0
        },
        {
          sort_order: 6,
          question_en: 'Do you see your family often?',
          question_nl: 'Zie je je familie vaak?',
          question_phonetic: 'zee yuh yuh fah-mee-lee vahk',
          answer_en: 'Yes, I see them every week. / No, they live far away.',
          answer_nl: 'Ja, ik zie ze elke week. / Nee, ze wonen ver weg.',
          answer_phonetic: 'yah, ik zee zuh el-kuh wayk. / nay, zuh woh-nun ver wekh',
          grammar_notes: "'Elke' means 'every'. 'Ver weg' means 'far away'. 'Ze' can mean 'they' or 'them'.",
          common_mistakes: "Don't say 'Ik zie hun elke week' - use 'ze' as object pronoun: 'Ik zie ze'.",
          is_personalized: 0
        },
        {
          sort_order: 7,
          question_en: 'What do you do together with your family?',
          question_nl: 'Wat doen jullie samen als familie?',
          question_phonetic: 'wat doon yü-lee sah-mun als fah-mee-lee',
          answer_en: 'We eat together and go for walks.',
          answer_nl: 'We eten samen en gaan wandelen.',
          answer_phonetic: 'wuh ay-tun sah-mun en khahn wan-duh-lun',
          grammar_notes: "'Gaan wandelen' is a common construction: gaan + infinitive means 'to go do something'.",
          common_mistakes: "Don't say 'We gaan wandeling' - use the infinitive: 'gaan wandelen'.",
          is_personalized: 0
        },
        {
          sort_order: 8,
          question_en: 'Tell me about your parents.',
          question_nl: 'Vertel me over je ouders.',
          question_phonetic: 'ver-tel muh oh-ver yuh ow-ders',
          answer_en: 'My father is [age] and my mother is [age]. They live in [city].',
          answer_nl: 'Mijn vader is [leeftijd] en mijn moeder is [leeftijd]. Ze wonen in [stad].',
          answer_phonetic: 'mayn fah-der is [leeftijd] en mayn moo-der is [leeftijd]. zuh woh-nun in [stad]',
          grammar_notes: "'Vader' (father), 'moeder' (mother). Informal: 'papa', 'mama'. 'Ouders' means parents.",
          common_mistakes: "Don't say 'mijn ouders woont' - 'ouders' is plural, so use 'wonen': 'mijn ouders wonen'.",
          is_personalized: 0
        },
        {
          sort_order: 9,
          question_en: 'Do you miss your family?',
          question_nl: 'Mis je je familie?',
          question_phonetic: 'mis yuh yuh fah-mee-lee',
          answer_en: 'Yes, I miss them sometimes, but we call often.',
          answer_nl: 'Ja, ik mis ze soms, maar we bellen vaak.',
          answer_phonetic: 'yah, ik mis zuh soms, mahr wuh bel-lun vahk',
          grammar_notes: "'Maar' means 'but'. 'Soms' means 'sometimes'. 'Bellen' means 'to call (phone)'.",
          common_mistakes: "Don't say 'we telefoon vaak' - use the verb 'bellen' for making phone calls.",
          is_personalized: 0
        },
        {
          sort_order: 10,
          question_en: 'Who is the most important person in your family?',
          question_nl: 'Wie is de belangrijkste persoon in je familie?',
          question_phonetic: 'wee is duh buh-lang-rayk-stuh per-sohn in yuh fah-mee-lee',
          answer_en: 'For me, my [relation] is the most important.',
          answer_nl: 'Voor mij is mijn [relatie] het belangrijkst.',
          answer_phonetic: 'vohr may is mayn [relatie] het buh-lang-raykst',
          grammar_notes: "'Het belangrijkst' is the superlative of 'belangrijk' (important). 'Voor mij' means 'for me'.",
          common_mistakes: "Don't say 'de meest belangrijk' - use the superlative form: 'het belangrijkst'.",
          is_personalized: 0
        }
      ]
    },
    {
      slug: 'work-study',
      name: 'Werk en Studie (Work & Study)',
      description: 'Discuss your job, education, and professional life',
      icon: 'Briefcase',
      sort_order: 3,
      questions: [
        {
          sort_order: 1,
          question_en: 'What is your job?',
          question_nl: 'Wat is je beroep?',
          question_phonetic: 'wat is yuh buh-roop',
          answer_en: 'I am a [job title].',
          answer_nl: 'Ik ben [beroep].',
          answer_phonetic: 'ik ben [beroep]',
          grammar_notes: "For professions, Dutch often drops the article: 'Ik ben leraar' not 'Ik ben een leraar' (though both are acceptable).",
          common_mistakes: "The article 'een' is optional with professions: 'Ik ben arts' or 'Ik ben een arts' - both are correct.",
          is_personalized: 0
        },
        {
          sort_order: 2,
          question_en: 'Where do you work?',
          question_nl: 'Waar werk je?',
          question_phonetic: 'wahr werk yuh',
          answer_en: 'I work at [company/place].',
          answer_nl: 'Ik werk bij [bedrijf/plek].',
          answer_phonetic: 'ik werk bay [bedrijf/plek]',
          grammar_notes: "'Bij' means 'at' for workplaces: 'bij een bedrijf' (at a company), 'bij een ziekenhuis' (at a hospital).",
          common_mistakes: "Don't say 'Ik werk in een bedrijf' for a company - use 'bij': 'Ik werk bij een bedrijf'.",
          is_personalized: 0
        },
        {
          sort_order: 3,
          question_en: 'Do you like your work?',
          question_nl: 'Vind je je werk leuk?',
          question_phonetic: 'vint yuh yuh werk luk',
          answer_en: 'Yes, I find my work interesting.',
          answer_nl: 'Ja, ik vind mijn werk interessant.',
          answer_phonetic: 'yah, ik vint mayn werk in-tuh-reh-sant',
          grammar_notes: "'Vinden' means 'to find/think'. 'Ik vind het leuk' = I like it. 'Leuk' = fun/nice, 'interessant' = interesting.",
          common_mistakes: "Don't say 'Ik hou van mijn werk' for liking work - 'Ik vind mijn werk leuk' is more natural.",
          is_personalized: 0
        },
        {
          sort_order: 4,
          question_en: 'What time do you start work?',
          question_nl: 'Hoe laat begin je met werken?',
          question_phonetic: 'hoo laht buh-khin yuh met wer-kun',
          answer_en: 'I start at nine o\'clock.',
          answer_nl: 'Ik begin om negen uur.',
          answer_phonetic: 'ik buh-khin om nay-khun ür',
          grammar_notes: "'Om' + time means 'at' a specific time. 'Uur' means 'hour/o'clock'.",
          common_mistakes: "Don't forget 'om' before the time: 'om negen uur' not just 'negen uur' when saying when you start.",
          is_personalized: 0
        },
        {
          sort_order: 5,
          question_en: 'How do you travel to work?',
          question_nl: 'Hoe ga je naar je werk?',
          question_phonetic: 'hoo khah yuh nahr yuh werk',
          answer_en: 'I go by [transport].',
          answer_nl: 'Ik ga met de [vervoer].',
          answer_phonetic: 'ik khah met duh [vervoer]',
          grammar_notes: "'Met de' + transport: 'met de trein' (by train), 'met de bus' (by bus), 'met de fiets' (by bike). Exception: 'te voet' (on foot).",
          common_mistakes: "Don't say 'bij de trein' - use 'met de trein' for transportation.",
          is_personalized: 0
        },
        {
          sort_order: 6,
          question_en: 'What did you study?',
          question_nl: 'Wat heb je gestudeerd?',
          question_phonetic: 'wat heb yuh khuh-stü-dayrt',
          answer_en: 'I studied [subject].',
          answer_nl: 'Ik heb [vak] gestudeerd.',
          answer_phonetic: 'ik heb [vak] khuh-stü-dayrt',
          grammar_notes: "Perfect tense: 'heb' + past participle at end. 'Gestudeerd' = studied. Past participles often start with 'ge-'.",
          common_mistakes: "Word order in perfect tense: 'Ik heb informatica gestudeerd' - participle goes at the END.",
          is_personalized: 0
        },
        {
          sort_order: 7,
          question_en: 'Do you work full-time or part-time?',
          question_nl: 'Werk je fulltime of parttime?',
          question_phonetic: 'werk yuh ful-taym of part-taym',
          answer_en: 'I work full-time, five days a week.',
          answer_nl: 'Ik werk fulltime, vijf dagen per week.',
          answer_phonetic: 'ik werk ful-taym, vayf dah-khun per wayk',
          grammar_notes: "'Fulltime' and 'parttime' are used as-is in Dutch (borrowed from English). 'Per week' means 'per week'.",
          common_mistakes: "Don't say 'hele tijd' for full-time - use 'fulltime' (it's a common Dutch word borrowed from English).",
          is_personalized: 0
        },
        {
          sort_order: 8,
          question_en: 'What do you want to do in the future?',
          question_nl: 'Wat wil je in de toekomst doen?',
          question_phonetic: 'wat wil yuh in duh too-komst doon',
          answer_en: 'I want to [goal].',
          answer_nl: 'Ik wil [doel].',
          answer_phonetic: 'ik wil [doel]',
          grammar_notes: "'Willen' (to want) + infinitive at end: 'Ik wil een eigen bedrijf beginnen' (I want to start my own business).",
          common_mistakes: "Don't say 'Ik wil beginnen een bedrijf' - infinitive goes at the END: 'Ik wil een bedrijf beginnen'.",
          is_personalized: 0
        },
        {
          sort_order: 9,
          question_en: 'Do you work with colleagues?',
          question_nl: "Werk je met collega's?",
          question_phonetic: 'werk yuh met kol-lay-khahs',
          answer_en: 'Yes, I have nice colleagues.',
          answer_nl: "Ja, ik heb leuke collega's.",
          answer_phonetic: 'yah, ik heb lü-kuh kol-lay-khahs',
          grammar_notes: "'Leuk' becomes 'leuke' before a noun (adjective inflection). Most adjectives add -e before nouns.",
          common_mistakes: "Don't forget the -e ending on adjectives before nouns: 'leuke collega's' not 'leuk collega's'.",
          is_personalized: 0
        },
        {
          sort_order: 10,
          question_en: 'What is the most difficult thing about your work?',
          question_nl: 'Wat is het moeilijkste van je werk?',
          question_phonetic: 'wat is het moo-ee-luk-stuh van yuh werk',
          answer_en: 'The most difficult thing is [challenge].',
          answer_nl: 'Het moeilijkste is [uitdaging].',
          answer_phonetic: 'het moo-ee-luk-stuh is [uitdaging]',
          grammar_notes: "'Het moeilijkste' is superlative of 'moeilijk' (difficult). 'Van' means 'of/about' here.",
          common_mistakes: "Don't say 'de meest moeilijk' - use superlative form: 'het moeilijkste'.",
          is_personalized: 0
        }
      ]
    },
    {
      slug: 'daily-routine',
      name: 'Dagelijkse Routine (Daily Routine)',
      description: 'Describe your daily schedule, habits, and regular activities',
      icon: 'Clock',
      sort_order: 4,
      questions: [
        {
          sort_order: 1,
          question_en: 'What time do you wake up?',
          question_nl: 'Hoe laat word je wakker?',
          question_phonetic: 'hoo laht wort yuh wak-ker',
          answer_en: 'I wake up at seven o\'clock.',
          answer_nl: 'Ik word om zeven uur wakker.',
          answer_phonetic: 'ik wort om zay-vun ür wak-ker',
          grammar_notes: "'Wakker worden' is a separable verb: 'Ik word wakker'. In main clauses, the prefix separates to the end.",
          common_mistakes: "Don't say 'Ik wakker word' - separable verbs split: 'Ik word...wakker'.",
          is_personalized: 0
        },
        {
          sort_order: 2,
          question_en: 'What do you eat for breakfast?',
          question_nl: 'Wat eet je als ontbijt?',
          question_phonetic: 'wat ayt yuh als ont-bayt',
          answer_en: 'I eat bread with cheese.',
          answer_nl: 'Ik eet brood met kaas.',
          answer_phonetic: 'ik ayt broht met kahs',
          grammar_notes: "'Als' here means 'as/for'. 'Brood met kaas' (bread with cheese) is a very typical Dutch breakfast.",
          common_mistakes: "Don't say 'voor ontbijt' - use 'als ontbijt' for 'for breakfast'.",
          is_personalized: 0
        },
        {
          sort_order: 3,
          question_en: 'How do you go to work?',
          question_nl: 'Hoe ga je naar je werk?',
          question_phonetic: 'hoo khah yuh nahr yuh werk',
          answer_en: 'I cycle to work.',
          answer_nl: 'Ik fiets naar mijn werk.',
          answer_phonetic: 'ik feets nahr mayn werk',
          grammar_notes: "'Fietsen' means 'to cycle'. The Netherlands is famous for cycling - 'Ik fiets naar...' is very common.",
          common_mistakes: "Don't say 'Ik rijd fiets' - 'fietsen' is already the verb: 'Ik fiets naar mijn werk'.",
          is_personalized: 0
        },
        {
          sort_order: 4,
          question_en: 'What do you do in the evening?',
          question_nl: "Wat doe je 's avonds?",
          question_phonetic: 'wat doo yuh sah-vonts',
          answer_en: 'In the evening I cook dinner and watch TV.',
          answer_nl: "Ik kook 's avonds het avondeten en kijk TV.",
          answer_phonetic: 'ik kohk sah-vonts het ah-vont-ay-tun en kayk tay-vay',
          grammar_notes: "'s avonds' means 'in the evening' (contraction of 'des avonds'). Same pattern: 's morgens, 's middags.",
          common_mistakes: "Don't say 'in de avond' - use ''s avonds' for habitual evening activities.",
          is_personalized: 0
        },
        {
          sort_order: 5,
          question_en: 'What time do you go to bed?',
          question_nl: 'Hoe laat ga je naar bed?',
          question_phonetic: 'hoo laht khah yuh nahr bet',
          answer_en: 'I go to bed at eleven o\'clock.',
          answer_nl: 'Ik ga om elf uur naar bed.',
          answer_phonetic: 'ik khah om elf ür nahr bet',
          grammar_notes: "'Naar bed gaan' means 'to go to bed'. Time expression ('om elf uur') comes before 'naar bed'.",
          common_mistakes: "Word order: 'Ik ga om elf uur naar bed' - time before place in Dutch.",
          is_personalized: 0
        },
        {
          sort_order: 6,
          question_en: 'Do you exercise?',
          question_nl: 'Sport je?',
          question_phonetic: 'sport yuh',
          answer_en: 'Yes, I exercise three times a week.',
          answer_nl: 'Ja, ik sport drie keer per week.',
          answer_phonetic: 'yah, ik sport dree kayr per wayk',
          grammar_notes: "'Sporten' means to exercise/do sports. 'Keer' means 'times': 'drie keer' (three times).",
          common_mistakes: "Don't say 'Ik doe sport' - just use the verb: 'Ik sport'.",
          is_personalized: 0
        },
        {
          sort_order: 7,
          question_en: 'What do you do on the weekend?',
          question_nl: 'Wat doe je in het weekend?',
          question_phonetic: 'wat doo yuh in het week-ent',
          answer_en: 'On the weekend I relax and see friends.',
          answer_nl: 'In het weekend ontspan ik en zie ik vrienden.',
          answer_phonetic: 'in het week-ent ont-span ik en zee ik vreen-dun',
          grammar_notes: "Inversion: when a sentence starts with a time expression, verb and subject switch: 'In het weekend ontspan ik' not 'ik ontspan'.",
          common_mistakes: "Don't forget inversion: 'In het weekend ontspan IK' not 'In het weekend ik ontspan'.",
          is_personalized: 0
        },
        {
          sort_order: 8,
          question_en: 'Do you cook every day?',
          question_nl: 'Kook je elke dag?',
          question_phonetic: 'kohk yuh el-kuh dakh',
          answer_en: 'Yes, I cook every day. / No, sometimes I order food.',
          answer_nl: 'Ja, ik kook elke dag. / Nee, soms bestel ik eten.',
          answer_phonetic: 'yah, ik kohk el-kuh dakh. / nay, soms buh-stel ik ay-tun',
          grammar_notes: "'Bestellen' means to order. After 'soms' (sometimes), there's inversion: 'soms bestel ik'.",
          common_mistakes: "Don't say 'soms ik bestel' - after adverbs like 'soms', inversion is required: 'soms bestel ik'.",
          is_personalized: 0
        },
        {
          sort_order: 9,
          question_en: 'How often do you clean your house?',
          question_nl: 'Hoe vaak maak je je huis schoon?',
          question_phonetic: 'hoo vahk mahk yuh yuh hows skhohn',
          answer_en: 'I clean my house once a week.',
          answer_nl: 'Ik maak mijn huis één keer per week schoon.',
          answer_phonetic: 'ik mahk mayn hows ayn kayr per wayk skhohn',
          grammar_notes: "'Schoonmaken' is a separable verb: 'Ik maak...schoon'. 'Één keer per week' = once a week.",
          common_mistakes: "Don't say 'Ik schoonmaak' - it splits: 'Ik maak het huis schoon'.",
          is_personalized: 0
        },
        {
          sort_order: 10,
          question_en: 'What is your favorite part of the day?',
          question_nl: 'Wat is je favoriete deel van de dag?',
          question_phonetic: 'wat is yuh fah-voh-ree-tuh dayl van duh dakh',
          answer_en: 'I like the morning the most because it is quiet.',
          answer_nl: 'Ik vind de ochtend het fijnst omdat het rustig is.',
          answer_phonetic: 'ik vint duh okh-tent het faynst om-dat het rüs-tikh is',
          grammar_notes: "'Het fijnst' is superlative of 'fijn' (nice). 'Omdat' sends verb to end: 'omdat het rustig is'.",
          common_mistakes: "Remember: after 'omdat', verb goes to the end: 'omdat het rustig IS'.",
          is_personalized: 0
        }
      ]
    },
    {
      slug: 'hobbies',
      name: "Hobby's (Hobbies)",
      description: 'Discuss your hobbies, interests, and leisure activities',
      icon: 'Heart',
      sort_order: 5,
      questions: [
        {
          sort_order: 1,
          question_en: 'What do you do in your free time?',
          question_nl: 'Wat doe je in je vrije tijd?',
          question_phonetic: 'wat doo yuh in yuh vray-uh tayt',
          answer_en: 'In my free time I like to [hobby].',
          answer_nl: 'In mijn vrije tijd [hobby] ik graag.',
          answer_phonetic: 'in mayn vray-uh tayt [hobby] ik khrahkh',
          grammar_notes: "'Vrije tijd' = free time. 'Graag' means 'gladly' and shows you like doing something.",
          common_mistakes: "Don't forget inversion when starting with time: 'In mijn vrije tijd LEES ik graag' not 'ik lees graag'.",
          is_personalized: 1
        },
        {
          sort_order: 2,
          question_en: 'Do you like reading?',
          question_nl: 'Lees je graag?',
          question_phonetic: 'lays yuh khrahkh',
          answer_en: 'Yes, I like reading books.',
          answer_nl: 'Ja, ik lees graag boeken.',
          answer_phonetic: 'yah, ik lays khrahkh boo-kun',
          grammar_notes: "'Graag' + verb = to like doing: 'Ik lees graag' (I like reading). 'Boeken' is plural of 'boek'.",
          common_mistakes: "Don't say 'Ik leuk lezen' - use 'graag': 'Ik lees graag' or 'Ik vind lezen leuk'.",
          is_personalized: 0
        },
        {
          sort_order: 3,
          question_en: 'Do you play a sport?',
          question_nl: 'Doe je aan sport?',
          question_phonetic: 'doo yuh ahn sport',
          answer_en: 'Yes, I play [sport].',
          answer_nl: 'Ja, ik [sport].',
          answer_phonetic: 'yah, ik [sport]',
          grammar_notes: "'Aan sport doen' means to do/play sport. For specific sports: 'Ik voetbal' (I play football), 'Ik zwem' (I swim).",
          common_mistakes: "Don't say 'Ik speel voetbal' - in Dutch, many sports are verbs: 'Ik voetbal', 'Ik tennis'.",
          is_personalized: 0
        },
        {
          sort_order: 4,
          question_en: 'Do you like music?',
          question_nl: 'Hou je van muziek?',
          question_phonetic: 'how yuh van mü-zeek',
          answer_en: 'Yes, I like listening to music.',
          answer_nl: 'Ja, ik luister graag naar muziek.',
          answer_phonetic: 'yah, ik lüs-ter khrahkh nahr mü-zeek',
          grammar_notes: "'Luisteren naar' means 'to listen to'. 'Houden van' means 'to love/like' (stronger than 'graag').",
          common_mistakes: "Don't forget 'naar' with luisteren: 'luisteren NAAR muziek' not 'luisteren muziek'.",
          is_personalized: 0
        },
        {
          sort_order: 5,
          question_en: 'Do you like to travel?',
          question_nl: 'Reis je graag?',
          question_phonetic: 'rays yuh khrahkh',
          answer_en: 'Yes, I like to travel. Last year I went to [place].',
          answer_nl: 'Ja, ik reis graag. Vorig jaar ben ik naar [plek] geweest.',
          answer_phonetic: 'yah, ik rays khrahkh. voh-rikh yahr ben ik nahr [plek] khuh-wayst',
          grammar_notes: "'Vorig jaar' = last year. 'Ben geweest' = have been (perfect tense with 'zijn' for movement verbs).",
          common_mistakes: "Movement verbs use 'zijn' not 'hebben' in perfect tense: 'Ik BEN geweest' not 'Ik HEB geweest'.",
          is_personalized: 0
        },
        {
          sort_order: 6,
          question_en: 'Do you like cooking?',
          question_nl: 'Kook je graag?',
          question_phonetic: 'kohk yuh khrahkh',
          answer_en: 'Yes, I like cooking [cuisine] food.',
          answer_nl: 'Ja, ik kook graag [keuken] eten.',
          answer_phonetic: 'yah, ik kohk khrahkh [keuken] ay-tun',
          grammar_notes: "'Koken' means to cook. 'Eten' means food/eating. 'Ik kook graag Indiaas eten' = I like cooking Indian food.",
          common_mistakes: "Don't say 'Ik hou van koken eten' - say 'Ik kook graag' or 'Ik hou van koken'.",
          is_personalized: 0
        },
        {
          sort_order: 7,
          question_en: 'What is your favorite hobby?',
          question_nl: 'Wat is je favoriete hobby?',
          question_phonetic: 'wat is yuh fah-voh-ree-tuh hob-bee',
          answer_en: 'My favorite hobby is [hobby].',
          answer_nl: 'Mijn favoriete hobby is [hobby].',
          answer_phonetic: 'mayn fah-voh-ree-tuh hob-bee is [hobby]',
          grammar_notes: "'Favoriete' is the adjective form of 'favoriet'. Adjectives before nouns get -e ending.",
          common_mistakes: "Don't say 'mijn favoriet hobby' - add -e before the noun: 'mijn favoriete hobby'.",
          is_personalized: 1
        },
        {
          sort_order: 8,
          question_en: 'Do you watch TV or Netflix?',
          question_nl: 'Kijk je TV of Netflix?',
          question_phonetic: 'kayk yuh tay-vay of net-fliks',
          answer_en: 'Yes, I watch series in the evening.',
          answer_nl: "Ja, ik kijk 's avonds series.",
          answer_phonetic: 'yah, ik kayk sah-vonts say-rees',
          grammar_notes: "'Kijken' means to watch/look. 'Series' is the same word in Dutch. ''s avonds' = in the evening.",
          common_mistakes: "Don't say 'Ik zie TV' - use 'kijken': 'Ik kijk TV'.",
          is_personalized: 0
        },
        {
          sort_order: 9,
          question_en: 'Do you have pets?',
          question_nl: 'Heb je huisdieren?',
          question_phonetic: 'heb yuh hows-dee-run',
          answer_en: "Yes, I have a [pet]. / No, I don't have pets.",
          answer_nl: 'Ja, ik heb een [huisdier]. / Nee, ik heb geen huisdieren.',
          answer_phonetic: 'yah, ik heb un [huisdier]. / nay, ik heb khayn hows-dee-run',
          grammar_notes: "'Huisdieren' = pets (literally 'house animals'). 'Geen' for negative: 'geen huisdieren'.",
          common_mistakes: "Don't say 'Ik heb niet huisdieren' - use 'geen': 'Ik heb geen huisdieren'.",
          is_personalized: 0
        },
        {
          sort_order: 10,
          question_en: 'Would you like to learn a new hobby?',
          question_nl: 'Wil je een nieuwe hobby leren?',
          question_phonetic: 'wil yuh un nee-wuh hob-bee lay-run',
          answer_en: 'Yes, I would like to learn [hobby].',
          answer_nl: 'Ja, ik wil graag [hobby] leren.',
          answer_phonetic: 'yah, ik wil khrahkh [hobby] lay-run',
          grammar_notes: "'Willen' + infinitive: 'Ik wil leren'. Adding 'graag' makes it polite: 'Ik wil graag...leren'.",
          common_mistakes: "Don't put the infinitive right after 'wil': 'Ik wil graag fotografie LEREN' - infinitive at the end.",
          is_personalized: 0
        }
      ]
    },
    // Topic shells only (no Q&As)
    {
      slug: 'shopping',
      name: 'Winkelen (Shopping)',
      description: 'Talk about shopping, buying things, and asking prices',
      icon: 'ShoppingBag',
      sort_order: 6,
      questions: []
    },
    {
      slug: 'health',
      name: 'Gezondheid (Health)',
      description: 'Discuss health, visiting the doctor, and how you feel',
      icon: 'HeartPulse',
      sort_order: 7,
      questions: []
    },
    {
      slug: 'weather',
      name: 'Het Weer (Weather)',
      description: 'Talk about the weather and seasons in the Netherlands',
      icon: 'Cloud',
      sort_order: 8,
      questions: []
    },
    {
      slug: 'travel',
      name: 'Reizen (Travel)',
      description: 'Discuss travel plans, directions, and transportation',
      icon: 'Plane',
      sort_order: 9,
      questions: []
    },
    {
      slug: 'food-drink',
      name: 'Eten en Drinken (Food & Drink)',
      description: 'Talk about food, restaurants, and Dutch cuisine',
      icon: 'UtensilsCrossed',
      sort_order: 10,
      questions: []
    }
  ];

  // ─── Run everything in a single transaction ─────────────────────────

  let totalTopics = 0;
  let totalQuestions = 0;

  const seedAll = db.transaction(() => {
    for (const topic of topics) {
      const result = insertTopic.run({
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        icon: topic.icon,
        sort_order: topic.sort_order
      });

      const topicId = result.lastInsertRowid;

      for (const q of topic.questions) {
        insertQA.run({
          topic_id: topicId,
          sort_order: q.sort_order,
          question_en: q.question_en,
          question_nl: q.question_nl,
          question_phonetic: q.question_phonetic,
          answer_en: q.answer_en,
          answer_nl: q.answer_nl,
          answer_phonetic: q.answer_phonetic,
          grammar_notes: q.grammar_notes,
          common_mistakes: q.common_mistakes,
          is_personalized: q.is_personalized
        });
      }

      const qCount = topic.questions.length;
      totalQuestions += qCount;
      totalTopics++;

      if (qCount > 0) {
        console.log(`  Added topic: ${topic.name} with ${qCount} questions`);
      } else {
        console.log(`  Added topic: ${topic.name} (shell only, no questions)`);
      }
    }
  });

  seedAll();

  console.log(`\nDone! Seeded ${totalTopics} topics with ${totalQuestions} total questions.`);
}

seed();
