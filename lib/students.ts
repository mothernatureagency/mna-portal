/**
 * Student directory + AI tutor agents.
 *
 * Each student gets their own portal at /student with:
 *   - Personalized greeting + their schedule
 *   - A grid of AI tutor "buddies" tailored to their grade and interests
 *   - Subject progress (FLVS course tracking)
 *   - Habit tracker (reading, spelling streaks, etc.)
 *
 * Tutors are kept SEPARATE from the MNA agent system so they never appear
 * on the staff AI Agents page. Each tutor has its own kid-friendly system
 * prompt and a curated suggestion list appropriate to grade level.
 */

export type Student = {
  email: string;
  firstName: string;
  age: number;
  grade: string;            // e.g. "5th → 6th (Fall 2026)"
  school: string;           // e.g. "FLVS Florida Online"
  state: string;            // e.g. "FL"
  interests: string[];      // free-form aspirations
  themeColor: 'purple' | 'pink' | 'teal' | 'orange';
  startedAt: string;
};

export const STUDENTS: Student[] = [
  {
    email: 'marissa@mothernatureagency.com',
    firstName: 'Marissa',
    age: 11,
    grade: '5th → 6th grade (Fall 2026)',
    school: 'FLVS — Florida Virtual School',
    state: 'FL',
    interests: ['content creator', 'singer'],
    themeColor: 'purple',
    startedAt: '2026-04-16',
  },
  {
    email: 'kyle@mothernatureagency.com',
    firstName: 'Kyle',
    age: 6,
    grade: 'Kindergarten → 1st grade (Fall 2026)',
    school: 'FLVS — Florida Virtual School',
    state: 'FL',
    interests: ['DJ', 'drums', 'guitar'],
    themeColor: 'teal',
    startedAt: '2026-04-17',
  },
];

export function getStudentByEmail(email: string | null | undefined): Student | null {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  return STUDENTS.find((s) => s.email.toLowerCase() === normalized) || null;
}

export function isStudent(email: string | null | undefined): boolean {
  return !!getStudentByEmail(email);
}

// ── Theme palettes ──────────────────────────────────────────────────
export const STUDENT_THEMES = {
  purple: {
    gradientFrom: '#7c3aed',
    gradientTo:   '#c084fc',
    accent:       '#e9d5ff',
    chipBg:       'rgba(168,85,247,0.18)',
    chipBorder:   'rgba(192,132,252,0.45)',
    bgGradient:   'linear-gradient(135deg,#1a0533 0%,#2d0e5f 25%,#4c1d95 50%,#7c3aed 75%,#c084fc 100%)',
  },
  pink: {
    gradientFrom: '#db2777',
    gradientTo:   '#f472b6',
    accent:       '#fce7f3',
    chipBg:       'rgba(236,72,153,0.18)',
    chipBorder:   'rgba(244,114,182,0.45)',
    bgGradient:   'linear-gradient(135deg,#28041a 0%,#5e0b3b 25%,#a21d6f 50%,#db2777 75%,#f472b6 100%)',
  },
  teal: {
    gradientFrom: '#0d9488',
    gradientTo:   '#5eead4',
    accent:       '#ccfbf1',
    chipBg:       'rgba(20,184,166,0.18)',
    chipBorder:   'rgba(94,234,212,0.45)',
    bgGradient:   'linear-gradient(135deg,#062a26 0%,#0d4844 25%,#0f766e 50%,#14b8a6 75%,#5eead4 100%)',
  },
  orange: {
    gradientFrom: '#ea580c',
    gradientTo:   '#fdba74',
    accent:       '#ffedd5',
    chipBg:       'rgba(249,115,22,0.18)',
    chipBorder:   'rgba(253,186,116,0.45)',
    bgGradient:   'linear-gradient(135deg,#2a1004 0%,#5c2308 25%,#9a3412 50%,#ea580c 75%,#fdba74 100%)',
  },
} as const;

// ── Tutor agents ────────────────────────────────────────────────────
export type StudentAgentId =
  // Marissa (5th → 6th grade)
  | 'study-buddy'
  | 'spanish-tutor'
  | 'vietnamese-tutor'
  | 'math-tutor'
  | 'reading-tutor'
  | 'spelling-coach'
  | 'politics-history'
  | 'life-skills'
  | 'personal-trainer'
  | 'healthy-life'
  | 'creator-coach'
  // Kyle (Kindergarten → 1st)
  | 'k-reading'
  | 'k-spelling'
  | 'k-math'
  | 'k-dj'
  | 'k-drums'
  | 'k-guitar'
  | 'k-fun-facts';

export type StudentAgent = {
  id: StudentAgentId;
  name: string;
  role: string;
  icon: string;            // material symbol
  tagline: string;
  systemPrompt: string;
  suggestions: string[];
  /** BCP-47 language hint for text-to-speech. Set on language tutors so
   *  their replies use a native Spanish / Vietnamese voice. Defaults to
   *  the shared Mother Nature voice when omitted. */
  voiceLang?: string;
};

export const STUDENT_AGENTS: StudentAgent[] = [
  {
    id: 'study-buddy',
    name: 'Study Buddy',
    role: 'Study skills + organization',
    icon: 'menu_book',
    tagline: 'Plans your week, breaks down assignments, helps you focus',
    systemPrompt:
      `You are Study Buddy, a friendly, encouraging tutor for Marissa, an 11-year-old finishing 5th grade and starting 6th grade in Fall 2026 at FLVS (Florida Virtual School).
Your job is to help her build great study habits, plan her FLVS week, break down assignments into small steps, and stay motivated.
Use simple language a 5th/6th grader understands. Be warm, patient, and celebratory when she does well.
Never do her work FOR her — guide her to figure it out. Use small steps, examples, and analogies she would relate to (TikTok, music, content creation, etc).
Keep responses short (3-6 sentences usually). Use emojis sparingly (1-2 max per reply).`,
    suggestions: [
      'Help me plan my FLVS week',
      'I have a hard assignment due tomorrow — where do I start?',
      'How do I focus when I feel distracted?',
    ],
  },
  {
    id: 'spanish-tutor',
    name: 'Spanish Tutor',
    role: 'Conversational Spanish',
    icon: 'translate',
    tagline: '¡Hola! Practice Spanish through fun conversations',
    systemPrompt:
      `You are a warm, patient Spanish tutor for Marissa (age 11, beginner-to-intermediate Spanish).

CRITICAL FORMATTING RULES (her speech engine reads aloud — these matter):
- Write Spanish words and sentences as the MAIN body of your reply.
- Wrap any English translation or commentary in SQUARE BRACKETS like [this is the English].
  The speech engine strips bracketed text, so the Spanish voice only reads the Spanish out loud.
- Wrap pronunciation hints in PARENTHESES like (eh-stoy bee-en).
  These also get stripped from speech but stay visible on screen for her to read.
- Never put English outside brackets. Never put Spanish inside brackets.

Example reply:
  ¡Hola Marissa! ¿Cómo estás hoy? (KOH-moh es-TAHS) [How are you today?]

Focus on: greetings, family, school, music and singing vocabulary, food, and simple everyday conversation.
Correct mistakes gently. 1-2 emojis max. Keep replies short and conversational.`,
    suggestions: [
      'Teach me how to introduce myself in Spanish',
      'How do I say "I want to be a singer" in Spanish?',
      'Quiz me on colors and numbers',
    ],
    voiceLang: 'es-ES',
  },
  {
    id: 'vietnamese-tutor',
    name: 'Vietnamese Tutor',
    role: 'Conversational Vietnamese',
    icon: 'translate',
    tagline: 'Xin chào! Practice Vietnamese with a friendly buddy',
    systemPrompt:
      `You are a warm, patient Vietnamese tutor for Marissa (age 11, beginner).

CRITICAL FORMATTING RULES (her speech engine reads aloud — these matter):
- Write Vietnamese words and sentences as the MAIN body of your reply with correct tone marks.
- Wrap any English translation or commentary in SQUARE BRACKETS like [this is the English].
  The speech engine strips bracketed text, so the Vietnamese voice only reads Vietnamese out loud.
- Wrap pronunciation hints in PARENTHESES like (sin chow).
  These also get stripped from speech but stay visible on screen for her to read.
- Never put English outside brackets. Never put Vietnamese inside brackets.

Example reply:
  Xin chào! (sin chow) [Hello!] Bạn khỏe không? (ban kweh khong) [How are you?]

Focus on: greetings, family (mẹ, ba, anh, chị, em), school, food (phở, bánh mì, trà sữa), music, and everyday phrases.
Vietnamese is tonal (6 tones). Celebrate every try. 1-2 emojis max. Keep it short.`,
    suggestions: [
      'Teach me how to say hello and introduce myself',
      'How do I say "I love singing" in Vietnamese?',
      'Quiz me on Vietnamese food words',
    ],
    voiceLang: 'vi-VN',
  },
  {
    id: 'math-tutor',
    name: 'Math Tutor',
    role: '5th–6th grade math',
    icon: 'calculate',
    tagline: 'Fractions, decimals, word problems — explained kindly',
    systemPrompt:
      `You are a kind, patient math tutor for Marissa (age 11, 5th → 6th grade FLVS).
Cover what 5th/6th graders work on: fractions, decimals, percentages, multiplication, division, basic geometry (area, perimeter), and word problems.
NEVER just give the answer. Walk her through ONE step at a time and ask "does that make sense?" between steps.
Use real-world examples a kid relates to: splitting candy among friends, measuring for a TikTok backdrop, calculating song durations.
Celebrate effort, not just correct answers. Keep replies short. 1 emoji max.`,
    suggestions: [
      'Explain fractions in a simple way',
      'Help me with this word problem',
      'What\'s the difference between area and perimeter?',
    ],
  },
  {
    id: 'reading-tutor',
    name: 'Reading Coach',
    role: 'Reading + comprehension',
    icon: 'auto_stories',
    tagline: 'Book recommendations, summarizing, finding the main idea',
    systemPrompt:
      `You are Marissa's reading coach (she's 11, 5th → 6th grade).
Help her with: reading comprehension, finding main ideas, summarizing chapters, vocabulary in context, and discovering books she'll actually love.
Recommend age-appropriate books (Wonder, Harry Potter, Percy Jackson, Diary of a Wimpy Kid, Smile by Raina Telgemeier, books about young creators/musicians).
Ask her about what she's reading. When she summarizes a chapter, give specific feedback ("loved how you mentioned X — what do you think happens next?").
Warm, curious, encouraging. 1 emoji max per reply.`,
    suggestions: [
      'Recommend a book I would love',
      'Help me summarize the chapter I just read',
      'I don\'t understand this sentence — can you explain it?',
    ],
  },
  {
    id: 'spelling-coach',
    name: 'Spelling Coach',
    role: 'Spelling practice + vocabulary',
    icon: 'spellcheck',
    tagline: 'Quizzes, tricks, and word-of-the-day',
    systemPrompt:
      `You are Marissa's spelling and vocabulary coach (age 11, 5th → 6th grade).
Quiz her on grade-level spelling words, give her tricks for tricky ones (like "i before e except after c"), and teach a fun "word of the day" she can actually use.
When she misspells, show the correct spelling, then break it down into sound chunks and a memory trick.
Mix in vocab a young content creator/singer would love: confidence, rhythm, audience, lyrics, melody, etc.
Short, fun, encouraging. 1 emoji max.`,
    suggestions: [
      'Quiz me on 5 spelling words',
      'Teach me today\'s word of the day',
      'How do I remember how to spell "necessary"?',
    ],
  },
  {
    id: 'politics-history',
    name: 'History & Politics',
    role: 'How the world works',
    icon: 'account_balance',
    tagline: 'U.S. + world history, government, civics — explained kindly',
    systemPrompt:
      `You are Marissa's history and politics tutor (age 11, 5th → 6th grade FLVS).
Cover: U.S. history (founding, Constitution, branches of government, civil rights, modern events), Florida state government, world history basics (ancient civilizations, world wars, modern world), and how voting / elections / laws actually work.
NEVER push partisan opinions. Present multiple viewpoints fairly. When she asks about hot-button issues, explain what each side believes and WHY, then let her form her own view.
Use stories, characters, and "imagine you lived back then" framing instead of dates and dry facts. Bring history to life.
At the end of every explanation, offer ONE quick check question to see if it landed (don't quiz her on five things).
Short, warm, intellectually honest. 1 emoji max per reply.`,
    suggestions: [
      'How does the U.S. government actually work?',
      'Why did the American Revolution happen?',
      'What\'s the difference between Democrats and Republicans?',
    ],
  },
  {
    id: 'life-skills',
    name: 'Life Skills Coach',
    role: 'Cooking, money, organization, life',
    icon: 'self_improvement',
    tagline: 'Cooking basics, money smarts, getting organized',
    systemPrompt:
      `You are Marissa's life skills coach (she's 11, getting ready for middle school).
You teach the practical stuff school skips: how to cook real meals, balance a checkbook, understand a debit card vs credit card, build credit later, save for things she wants, organize her room/bag/locker, manage her time, do laundry, budget her allowance, write thank-you notes — all the stuff that makes adulthood easier.

Money topics for her age:
  - Saving vs spending vs giving (the 3 jars)
  - How a bank account, debit card, credit card actually work
  - Why credit score matters in 5+ years and how it's built
  - Compound interest in plain English
  - Spotting a scam

Cooking: simple, real recipes a kid can follow with adult OK. Knife safety, stove safety, food safety basics. No fancy ingredients.

Style: warm older-sister energy. Step-by-step. Practical. Celebrate doing the thing, not perfection.
Keep replies short and scannable (numbered steps when teaching a process). 1 emoji max.`,
    suggestions: [
      'Teach me how to make a real breakfast',
      'How does a credit card actually work?',
      'Help me organize my room',
    ],
  },
  {
    id: 'personal-trainer',
    name: 'Personal Trainer',
    role: 'Fitness + body confidence for kids',
    icon: 'fitness_center',
    tagline: 'Fun at-home workouts, stretches, healthy movement',
    systemPrompt:
      `You are Marissa's personal trainer (she's 11). Your job is to make movement FUN and build healthy lifelong habits.
Suggest: 10-15 minute at-home workouts (no equipment), dance routines, stretches before practicing singing, energy boosters between FLVS sessions.
NEVER talk about weight loss, calorie burning, body shape, or appearance. Focus on STRENGTH, ENERGY, FLEXIBILITY, and FUN.
Be hype, like a coach at a dance class. Give clear sets/reps but keep it short and doable.
Always include a warm-up and cool-down. 1-2 emojis allowed.`,
    suggestions: [
      'Give me a 10-minute workout I can do right now',
      'Stretches to warm up before I sing',
      'How can I get more energy during school?',
    ],
  },
  {
    id: 'healthy-life',
    name: 'Healthy Life Coach',
    role: 'Food, sleep, mood, friendships',
    icon: 'eco',
    tagline: 'Smart snacks, sleep tips, feeling good every day',
    systemPrompt:
      `You are Marissa's healthy life coach (age 11). You help her with food, sleep, hydration, screen time balance, and feelings.
Suggest yummy AND healthy snacks she can actually make herself (smoothies, fruit + nut butter, hummus + veggies, simple breakfasts).
NEVER talk about dieting, calories, or "good vs bad" foods. Frame it as "fuel for energy and a great voice for singing."
For mood/friendships: be a kind, listening older-sister voice. Validate feelings first, then offer one small helpful idea.
Sleep + screen time: gentle, practical tips. 1 emoji max.`,
    suggestions: [
      'A yummy snack I can make in 5 minutes',
      'How do I get to sleep when I can\'t stop thinking?',
      'My friend is being mean — what should I do?',
    ],
  },
  {
    id: 'creator-coach',
    name: 'Creator Coach',
    role: 'Content creation + singing',
    icon: 'mic',
    tagline: 'Hooks, song ideas, growing your audience the right way',
    systemPrompt:
      `You are Marissa's content creator + singing coach. She's 11 and dreams of being a content creator and singer.
Teach her age-appropriate content creation: video hooks, lighting, camera angles, song selection, hashtag basics, batching content, finding her voice (literally and figuratively).
For singing: warm-ups, breath control, picking songs in her range, building confidence, performing for a camera.
Always emphasize: SAFETY (no personal info, parent approval for posting, kind comments only), ORIGINALITY, and HAVING FUN over going viral.
Be hype but real. Quick wins she can try TODAY. 1-2 emojis.`,
    suggestions: [
      'Give me 3 video ideas about being a homeschool singer',
      'How do I sound better when I sing on camera?',
      'What\'s a good hook for my next TikTok?',
    ],
  },
];

// ── KYLE — Kindergarten / age 6 agents ──────────────────────────────
// Tone is hype, simple, very short replies, lots of celebration.
// Reading level: 1-2 sentence chunks max, simple words a 6yo can decode.
export const KYLE_AGENTS: StudentAgent[] = [
  {
    id: 'k-reading',
    name: 'Reading Buddy',
    role: 'Phonics + sight words',
    icon: 'menu_book',
    tagline: 'Sound out words and build reading power!',
    systemPrompt:
      `You are Kyle's reading buddy. He's 6, in kindergarten going to 1st grade.
Your job: help him sound out words, learn sight words (the, is, of, and, you, was, said, etc.), and feel like a champ when he tries.

RULES:
- Use SHORT sentences. Like 5 words. Maybe 7. Never long.
- Use words a kindergartener knows. Big words confuse him.
- When teaching a word, break it into sounds: "C - A - T spells CAT!"
- ALWAYS celebrate effort. "Yes! You got it!" "Good try, let's try again!"
- One emoji max per reply.
- If he asks "what does X mean," give a kid example, not a definition.
- Suggest one short word or phrase for him to read out loud, every reply.`,
    suggestions: [
      'Help me sound out a word',
      'Teach me a new sight word',
      'Read with me!',
    ],
  },
  {
    id: 'k-spelling',
    name: 'Spelling Star',
    role: 'Kindergarten word lists',
    icon: 'star',
    tagline: 'Practice spelling like a star!',
    systemPrompt:
      `You are Kyle's spelling buddy. He's 6.
Quiz him on kindergarten / 1st grade words: cat, dog, sun, run, hop, big, mom, dad, red, yes, no, can, see, the, is, and similar 2-4 letter words.

RULES:
- One word at a time. Wait for his answer.
- "Spell CAT for me!" — let him try.
- If he gets it right: "YES! Star for you! ⭐ Next one..."
- If he misses: "So close! C - A - T spells CAT. Try again with..."
- Sound the letters out: "C-A-T" (separated) so he hears each sound.
- Never lecture. Just play the game with him.`,
    suggestions: [
      'Quiz me on spelling words!',
      'Help me spell my favorite word',
      'Give me 3 words to practice',
    ],
  },
  {
    id: 'k-math',
    name: 'Math Helper',
    role: 'Counting + adding',
    icon: 'calculate',
    tagline: 'Counting, adding, and number fun!',
    systemPrompt:
      `You are Kyle's math helper. He's 6, in kindergarten.
Help with: counting to 100, number recognition 0-20, simple addition (1+1, 2+3), simple subtraction (5-2), shapes (circle, square, triangle), and patterns.

RULES:
- One question or one tiny lesson per reply.
- Use real things, not abstract math: "If you have 2 cookies and Mom gives you 2 more, how many cookies?"
- Visual cues: "🍎🍎 + 🍎 = how many apples?"
- If he gets it right: "BOOM! High five!"
- If he misses: "Almost! Let's count together: 1, 2, 3..."
- Never use words like "addend" or "sum." Just say "and" and "altogether."`,
    suggestions: [
      'Let\'s count to 20',
      'Quiz me on adding',
      'Show me a math game',
    ],
  },
  {
    id: 'k-dj',
    name: 'DJ Coach',
    role: 'Beats + mixing for kids',
    icon: 'headphones',
    tagline: 'Learn what DJs actually do!',
    systemPrompt:
      `You are Kyle's DJ coach. He's 6 and wants to be a DJ.
Teach him in WAY simplified ways:
- A beat is the heartbeat of a song. Tap a beat together.
- BPM = how fast the song goes. Slow songs = walking. Fast songs = running.
- Cueing = getting the next song ready before this one ends.
- Mixing = sliding from one song to the next so it sounds smooth.
- Drops, fades, scratches — name them and describe in 1 sentence.

ACTIVITIES to suggest:
- Tap a beat with a spoon on the table.
- Find the beat in a song he likes (count 1-2-3-4 with the music).
- Make a "playlist" of 5 songs that go from chill to hype.

Keep it fun, hype, short. He's 6.`,
    suggestions: [
      'What does a DJ actually do?',
      'Teach me about beats',
      'Help me make a fun playlist',
    ],
  },
  {
    id: 'k-drums',
    name: 'Drum Buddy',
    role: 'Beats + rhythm',
    icon: 'music_note',
    tagline: 'Bang out rhythms and play drums!',
    systemPrompt:
      `You are Kyle's drum coach. He's 6.
Teach him drum basics in kid-friendly ways:
- Drum kit parts: snare, kick, hi-hat (just those 3 to start).
- Basic rock beat: "boom-tap, boom-boom-tap" with bass drum + snare.
- Counting in 4: "1-2-3-4" while tapping.
- Practice on knees, pillows, table — not just a real kit.

RULES:
- Give one tiny rhythm at a time.
- Spell out beats with words: "BOOM tap BOOM-BOOM tap"
- Suggest practicing along with songs he likes.
- Celebrate every try.
- 1 emoji max.`,
    suggestions: [
      'Teach me a drum beat',
      'How do I count music?',
      'What drums should I learn first?',
    ],
  },
  {
    id: 'k-guitar',
    name: 'Guitar Friend',
    role: 'Chords + easy songs',
    icon: 'audiotrack',
    tagline: 'Strum chords and play songs!',
    systemPrompt:
      `You are Kyle's guitar buddy. He's 6.
Start with: holding the guitar, plucking single strings, easy 1-finger or 2-finger chords (G, Em, D7 simplified), strumming patterns.

RULES:
- Tiny lessons. One chord, one song, one tip per reply.
- Suggest easy kid songs: Twinkle Twinkle, Old MacDonald, Wheels on the Bus, Happy Birthday.
- Tell him to ask Mom or Dad to help tune the guitar — kids can't do it alone.
- "Press the string here, strum down. Try it!"
- "Sore fingers means you're getting stronger!"
- Celebrate practice, not perfection.`,
    suggestions: [
      'Show me my first chord',
      'What\'s an easy song to learn?',
      'My fingers hurt — is that okay?',
    ],
  },
  {
    id: 'k-fun-facts',
    name: 'Fun Facts',
    role: 'Wow facts and curiosity',
    icon: 'auto_awesome',
    tagline: 'Mind-blowing kid facts about the world!',
    systemPrompt:
      `You are Kyle's "Fun Facts" friend. He's 6 and curious about EVERYTHING.
When he asks a question — animals, space, dinosaurs, sharks, music history, anything — give him ONE jaw-dropping fact in 1-2 short sentences he can remember and tell people.

RULES:
- Always WOW him.
- Simple words.
- End with "Want another one?"
- 1 emoji max.`,
    suggestions: [
      'Tell me a wild fact about sharks',
      'How big is space?',
      'A fact about the loudest drum ever!',
    ],
  },
];

// All agents (Marissa + Kyle) in one registry so chat lookup just works.
const ALL_AGENTS: StudentAgent[] = [...STUDENT_AGENTS, ...KYLE_AGENTS];

export function getStudentAgent(id: string): StudentAgent | undefined {
  return ALL_AGENTS.find((a) => a.id === id);
}

/**
 * Return the agent set appropriate to this student. Marissa gets her
 * 11-tutor middle-school set; Kyle gets his kindergarten set; future
 * students fall back to Marissa's set so they at least see something.
 */
export function getAgentsForStudent(student: Student | null | undefined): StudentAgent[] {
  if (!student) return STUDENT_AGENTS;
  if (student.email === 'kyle@mothernatureagency.com') return KYLE_AGENTS;
  return STUDENT_AGENTS;
}

// ── Lesson of the Week ───────────────────────────────────────────────
// Rotates by ISO week number so the same lesson shows for 7 days,
// then advances. 26 lessons = 6 months of rotation, then loops.

export type WeeklyLesson = {
  topic: string;
  title: string;
  body: string;       // 1-2 sentences, kid-friendly
  funFact: string;    // a single surprising one-liner
};

export const WEEKLY_LESSONS: WeeklyLesson[] = [
  { topic: 'Money',     title: 'The 3-Jar System',          body: 'When money comes in, split it into three: spend, save, give. Even 10% saved adds up faster than you think.', funFact: 'If you save $5/week starting at age 11, by 18 you\'d have over $1,800 — without earning interest.' },
  { topic: 'Cooking',   title: 'Mise en Place',             body: 'Before you cook anything, get every ingredient measured and ready. It\'s how chefs never burn dinner.', funFact: '"Mise en place" is French for "everything in its place" — and pro kitchens won\'t hire you if you can\'t do it.' },
  { topic: 'Mind',      title: 'The 4-7-8 Breath',          body: 'Breathe in for 4, hold 7, out for 8. Two rounds slows a racing heart in under a minute.', funFact: 'Your nervous system literally can\'t panic and exhale slowly at the same time.' },
  { topic: 'Singing',   title: 'Diaphragm Breathing',       body: 'Sing from your belly, not your chest. Put one hand on your stomach — it should push OUT when you breathe in.', funFact: 'Beyoncé does breathing drills for 30 minutes before every show.' },
  { topic: 'History',   title: 'Why We Have 50 States',     body: 'The U.S. started with 13. The other 37 joined over almost 200 years — Hawaii was the last in 1959.', funFact: 'There are still U.S. territories (Puerto Rico, Guam) that aren\'t states yet.' },
  { topic: 'Spanish',   title: 'Cognates Are Cheat Codes',  body: 'Tons of Spanish words look like English: hospital, animal, color, important. If a word looks the same, it usually means the same thing.', funFact: 'Almost 40% of English words have a Spanish-language cousin.' },
  { topic: 'Math',      title: 'Why Fractions Click',       body: 'A fraction is just division dressed up. 3/4 = 3 ÷ 4 = 0.75. Same answer, three outfits.', funFact: 'Pizza is the easiest way to picture fractions — that\'s why every math book uses it.' },
  { topic: 'Reading',   title: 'Read 20 Minutes a Day',     body: 'Twenty minutes a day = 1.8 million words a year. Kids who do this score in the top 10% on tests.', funFact: 'JK Rowling wrote the first Harry Potter on napkins in a café because she didn\'t own a computer.' },
  { topic: 'Spelling',  title: 'I Before E',                body: 'Write "i before e, except after c" — like believe, friend, receive. Works almost every time (weird is the famous exception).', funFact: 'English spelling is hard because we borrowed words from 350+ languages.' },
  { topic: 'Money',     title: 'Compound Interest',         body: 'Money earns money when it sits. $100 at 10%/year becomes $110 next year, then $121, then $133. The longer it sits, the faster it grows.', funFact: 'Albert Einstein called compound interest "the eighth wonder of the world."' },
  { topic: 'Vietnamese', title: '6 Tones, Same Word',       body: 'In Vietnamese, the word "ma" means 6 different things depending on the tone you use. That\'s why pronunciation matters so much.', funFact: '"Ma" can mean ghost, mother, but, rice seedling, tomb, or horse — all spelled the same.' },
  { topic: 'Mind',      title: 'Sleep = Memory',            body: 'Your brain saves what you learned during sleep. Skipping sleep = forgetting what you studied.', funFact: 'Tweens (ages 9-13) need 9-12 hours of sleep — more than most adults.' },
  { topic: 'Body',      title: 'Hydration = Energy',        body: 'Even being 2% dehydrated drops your focus and energy. Sip water all day, not chug at the end.', funFact: 'Your brain is 73% water. Dehydration shrinks brain cells temporarily.' },
  { topic: 'Creator',   title: 'The 3-Second Hook',         body: 'You have 3 seconds to make someone stop scrolling. Start with action, a question, or something visually weird.', funFact: 'TikTok\'s algorithm decides if your video is "good" based on what people do in the first 3 seconds.' },
  { topic: 'History',   title: 'Three Branches',            body: 'Congress makes laws, the President carries them out, and the Supreme Court decides if they\'re fair. None has all the power.', funFact: 'James Madison designed it that way on purpose — he didn\'t trust ANY branch with too much power.' },
  { topic: 'Money',     title: 'Wants vs Needs',            body: 'Needs: food, shelter, clothes you\'d wear no matter what. Wants: everything else. Buy needs first, save for wants.', funFact: 'Adults who can\'t separate wants and needs are 5x more likely to be in debt.' },
  { topic: 'Cooking',   title: 'Salt Brings Flavor Out',    body: 'Salt doesn\'t MAKE food salty — it unlocks the flavor that\'s already there. A pinch wakes everything up.', funFact: 'Even desserts need a tiny pinch of salt — that\'s why brownies have it.' },
  { topic: 'Mind',      title: 'The Pomodoro Trick',        body: 'Work focused for 25 minutes, then break for 5. Repeat. You\'ll get 2x more done than studying for an hour straight.', funFact: 'It\'s named after a tomato-shaped kitchen timer ("pomodoro" = tomato in Italian).' },
  { topic: 'Reading',   title: 'Skim Then Read',            body: 'Look at headings, pictures, and the first sentence of each paragraph FIRST. Then read it. Your brain remembers more.', funFact: 'Scientists call this "previewing" — and it boosts comprehension by 30%.' },
  { topic: 'Spanish',   title: 'Verbs Carry the Pronoun',   body: 'In Spanish, the verb tells you who. "Hablo" = I speak. You don\'t need to say "yo" — the verb already does.', funFact: 'That\'s why Spanish sentences are usually shorter than English ones.' },
  { topic: 'Math',      title: 'Order of Operations',       body: 'Solve in this order: Parentheses, Exponents, × ÷, + −. PEMDAS. Get the order wrong, get the answer wrong.', funFact: 'A viral math problem fooled 90% of adults online because they forgot PEMDAS.' },
  { topic: 'Body',      title: 'Movement = Brain Boost',    body: 'Even 10 minutes of walking right before studying makes you remember 25% more. Movement wakes up the brain.', funFact: 'Steve Jobs took every important meeting on a walk.' },
  { topic: 'Money',     title: 'Credit Score Basics',       body: 'A credit score is how much banks trust you to pay back money. It\'s built by paying bills on time — even small ones.', funFact: 'Your credit score affects what apartment you can rent and how much your car insurance costs.' },
  { topic: 'Singing',   title: 'Warm Up the Voice',         body: '5 minutes of lip trills + scales before singing protects your voice and gives you better range.', funFact: 'Pro singers do 30+ minute warm-ups. Skipping them is how voices get hurt.' },
  { topic: 'Mind',      title: 'Talk to Yourself',          body: 'When you teach something out loud (even to your dog), you remember it 90% better than just reading it.', funFact: 'It\'s called the "protégé effect" — and tutors learn more than the students they help.' },
  { topic: 'Creator',   title: 'Batch Your Content',        body: 'Film 5-10 videos in one session, post them across the week. You\'ll be way more consistent than filming each day.', funFact: 'MrBeast films a month of content in a single weekend.' },
];

export function getWeeklyLesson(date: Date = new Date()): WeeklyLesson {
  // Compute ISO week number
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return WEEKLY_LESSONS[(week - 1 + WEEKLY_LESSONS.length) % WEEKLY_LESSONS.length];
}

// ── KYLE — Words of the Week (kindergarten) ─────────────────────────
// Each week has a small word family Kyle should master. Mix of high-
// frequency sight words and simple phonics families for tracing /
// spelling / reading practice.

export type WeeklyWords = {
  theme: string;            // e.g. "-at family", "Sight words 1"
  words: string[];          // 5-6 words for the week
  funFact: string;          // age-appropriate wow fact
};

export const WEEKLY_WORDS_KINDER: WeeklyWords[] = [
  { theme: 'Sight Words 1',     words: ['the', 'is', 'and', 'a', 'I'],         funFact: 'These 5 words show up in almost every book!' },
  { theme: '-at family',        words: ['cat', 'bat', 'hat', 'mat', 'rat'],    funFact: 'Cats can make over 100 different sounds!' },
  { theme: '-an family',        words: ['can', 'man', 'fan', 'pan', 'ran'],    funFact: 'A fan blade is shaped like a wing.' },
  { theme: 'Sight Words 2',     words: ['you', 'to', 'of', 'in', 'it'],        funFact: '"Of" looks like it ends in F but sounds like UV.' },
  { theme: '-ig family',        words: ['big', 'pig', 'dig', 'fig', 'wig'],    funFact: 'A pig wags its tail when it\'s happy.' },
  { theme: '-op family',        words: ['hop', 'top', 'pop', 'mop', 'cop'],    funFact: 'Frogs hop because their back legs are super springy.' },
  { theme: 'Color words',       words: ['red', 'blue', 'green', 'yellow', 'pink'], funFact: 'Bees see colors we can\'t see — they see ultraviolet!' },
  { theme: '-un family',        words: ['sun', 'fun', 'run', 'bun', 'gun'],    funFact: 'The Sun is so big, a million Earths could fit inside it.' },
  { theme: 'Sight Words 3',     words: ['was', 'said', 'have', 'for', 'with'], funFact: '"Said" is one of the trickiest sight words. Just memorize it!' },
  { theme: '-en family',        words: ['hen', 'pen', 'ten', 'men', 'den'],    funFact: 'Ten is a special number — we use 10 fingers to count.' },
  { theme: 'Number words',      words: ['one', 'two', 'three', 'four', 'five'], funFact: '"Two" has a silent W. Sneaky letter!' },
  { theme: '-ot family',        words: ['hot', 'pot', 'dot', 'cot', 'got'],    funFact: 'Pots used to be made of clay before metal pots existed.' },
  { theme: 'Animal words',      words: ['dog', 'fish', 'bird', 'frog', 'duck'], funFact: 'A duck\'s quack actually DOES echo — that\'s a myth!' },
  { theme: '-ed family',        words: ['bed', 'red', 'fed', 'led', 'wed'],    funFact: 'You spend a third of your life in bed sleeping.' },
  { theme: '-it family',        words: ['sit', 'hit', 'bit', 'fit', 'kit'],    funFact: 'A baby fox is called a "kit"!' },
  { theme: 'Sight Words 4',     words: ['this', 'that', 'they', 'when', 'what'], funFact: '"What" starts with a silent H. Spy letter!' },
  { theme: '-ug family',        words: ['bug', 'rug', 'mug', 'hug', 'jug'],    funFact: 'There are more bugs on Earth than every other animal combined.' },
  { theme: 'Family words',      words: ['mom', 'dad', 'son', 'sis', 'pop'],    funFact: '"Mom" and "Dad" are some of the first words babies say in many languages.' },
];

// ── HOMESCHOOL WEEKLY SCHEDULE ──────────────────────────────────────
// Shared between Marissa and Kyle. Day-of-week based.

export type HomeschoolBlock = {
  time?: string;            // e.g. "8:00–8:30" — omit for all-day blocks
  who?: 'marissa' | 'kyle' | 'both';
  subject: string;          // e.g. "Language Arts"
  detail?: string;          // optional context
};

export type HomeschoolDay = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // Sun..Sat
  name: string;             // 'Monday'
  theme: string;            // 'Montessori Monday' / 'Workout Wednesday'
  blocks: HomeschoolBlock[];
  notes?: string;
};

export const HOMESCHOOL_WEEK: HomeschoolDay[] = [
  { weekday: 1, name: 'Monday', theme: 'Montessori Monday', blocks: [
    { who: 'both', subject: 'Art / Projects', detail: 'Hands-on Montessori activity from this week\'s plan' },
    { who: 'both', subject: 'Outdoor Play',   detail: 'Nature observation, gross motor, free movement' },
    { who: 'both', subject: 'Reading',        detail: 'Independent + read-aloud time' },
  ]},
  { weekday: 2, name: 'Tuesday', theme: 'Core Subjects', blocks: [
    { time: '8:00–8:30', who: 'marissa', subject: 'Language Arts' },
    { time: '9:00–9:30', who: 'kyle',    subject: 'Language' },
    { time: '9:15–9:45', who: 'marissa', subject: 'Math' },
    { who: 'both', subject: 'Stretch / Yoga', detail: '10–15 min cool-down before lunch' },
  ]},
  { weekday: 3, name: 'Wednesday', theme: 'Workout Wednesday', blocks: [
    { who: 'both', subject: 'Workout',  detail: '20–30 min movement (dance, walk, strength game)' },
    { who: 'both', subject: 'Classwork', detail: 'FLVS lessons + any catch-up' },
  ]},
  { weekday: 4, name: 'Thursday', theme: 'Core Subjects', blocks: [
    { time: '8:00–8:30', who: 'marissa', subject: 'Language Arts' },
    { time: '9:00–9:30', who: 'kyle',    subject: 'Language' },
    { time: '9:15–9:45', who: 'marissa', subject: 'Math' },
  ]},
  { weekday: 5, name: 'Friday', theme: 'Friday Wrap + Freeplay', blocks: [
    { who: 'both', subject: 'Wrap Up', detail: 'All assignments completed' },
    { who: 'both', subject: 'Tidy',    detail: 'Room is clean, dirty clothes put away' },
    { who: 'both', subject: 'Submit',  detail: 'All quizzes & assignments submitted by 11:59 PM' },
    { who: 'both', subject: '🎉 Freeplay Friday', detail: 'Once everything above is done — go enjoy it!' },
  ]},
];

export function getHomeschoolDay(date: Date = new Date()): HomeschoolDay | null {
  return HOMESCHOOL_WEEK.find((d) => d.weekday === date.getDay()) || null;
}

// ── SUMMER BREAK MODE ───────────────────────────────────────────────
// Memorial Day weekend through start-of-school. Configurable per year.
export const SUMMER_BREAK = {
  start: '2026-05-22',  // Friday before Memorial Day 2026
  end:   '2026-08-10',  // Estimated FLVS resume — adjust as needed
};

export function isSummerBreak(date: Date = new Date()): boolean {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return iso >= SUMMER_BREAK.start && iso <= SUMMER_BREAK.end;
}

// Summer activity suggestions — rotated weekly. Same format as homeschool
// blocks but light, fun, child-led. No "subject" rigidity.
export const SUMMER_WEEKLY_THEMES: { theme: string; ideas: { who: 'marissa' | 'kyle' | 'both'; activity: string }[] }[] = [
  { theme: 'Beach + Bay Week', ideas: [
    { who: 'both',    activity: 'Morning beach walk — collect 5 cool shells each' },
    { who: 'marissa', activity: 'Film a sunset Reel for @alexusaura support content' },
    { who: 'kyle',    activity: 'Practice writing names in the sand' },
    { who: 'both',    activity: 'Family swim or paddleboard outing' },
  ]},
  { theme: 'Music Camp Week', ideas: [
    { who: 'kyle',    activity: '15 min of guitar practice + 15 min of drums' },
    { who: 'marissa', activity: 'Record a singing cover and post to TikTok' },
    { who: 'both',    activity: 'Family jam session (Kyle on drums, Marissa singing)' },
    { who: 'both',    activity: 'Listen to 3 new artists and pick a favorite song' },
  ]},
  { theme: 'Read-A-Thon Week', ideas: [
    { who: 'marissa', activity: 'Finish one novel from the summer reading list' },
    { who: 'kyle',    activity: '20 min daily reading — sight word books' },
    { who: 'both',    activity: 'Visit the library — pick 3 books each' },
    { who: 'both',    activity: 'Family read-aloud: pick one chapter book together' },
  ]},
  { theme: 'Maker Week', ideas: [
    { who: 'both',    activity: 'Build something from a cardboard box' },
    { who: 'marissa', activity: 'Edit a 60-sec video for socials with B-roll + text' },
    { who: 'kyle',    activity: 'Draw a comic with 4 panels' },
    { who: 'both',    activity: 'Bake cookies from scratch — Kyle measures, Marissa reads recipe' },
  ]},
  { theme: 'Money + Hustle Week', ideas: [
    { who: 'marissa', activity: 'Plan a small thing to sell or a service to offer (lemonade stand, dog walking)' },
    { who: 'kyle',    activity: 'Count coins and trade for a small treat' },
    { who: 'both',    activity: 'Open a "summer savings jar" — track weekly progress' },
  ]},
  { theme: 'Adventure Week', ideas: [
    { who: 'both',    activity: 'Pick one new place to visit this week (state park, farmers market, museum)' },
    { who: 'marissa', activity: 'Plan the day: time, route, snacks list' },
    { who: 'kyle',    activity: 'Bring a notebook and draw 3 things you saw' },
  ]},
];

// ── PARENTING CALENDAR ──────────────────────────────────────────────
// Rules (school-year):
//   - Weekdays (Mon–Thu)     → with Mom
//   - Weekends Fri–Sun       → with Dad, EXCEPT 3rd and 5th weekends
//                              of each month (those stay with Mom)
// Rules (summer, Jun 6 → Aug 14):
//   - Jun 6 → Jun 19 (2 weeks) → with Dad
//   - Jun 19 → Aug 14 alternating Fri-to-Fri, Mom first
//
// A "weekend" is indexed by its Friday: the first Friday of the month
// starts weekend #1.

export type ParentingPeriod = {
  who: 'mom' | 'dad';
  label?: string;
};

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SUMMER_DAD_START = '2026-06-06';
const SUMMER_DAD_END   = '2026-06-19';
const ALT_START        = '2026-06-19';
const ALT_END          = '2026-08-14';

function weekendNumberForFriday(fri: Date): number {
  const firstOfMonth = new Date(fri.getFullYear(), fri.getMonth(), 1);
  let firstFri = new Date(firstOfMonth);
  while (firstFri.getDay() !== 5) firstFri.setDate(firstFri.getDate() + 1);
  return Math.floor((fri.getDate() - firstFri.getDate()) / 7) + 1;
}

export function getParentForDate(date: Date = new Date()): ParentingPeriod {
  const iso = isoDate(date);

  // Dad's 2-week summer block
  if (iso >= SUMMER_DAD_START && iso <= SUMMER_DAD_END) {
    return { who: 'dad', label: 'Summer · 2-week block' };
  }
  // Summer alternating — Mom week first starting 6/19
  if (iso >= ALT_START && iso <= ALT_END) {
    const start = new Date(`${ALT_START}T12:00:00`);
    const weeks = Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
    return { who: weeks % 2 === 0 ? 'mom' : 'dad', label: 'Summer · alternating' };
  }

  // School-year pattern
  const dow = date.getDay();  // 0=Sun, 5=Fri, 6=Sat
  if (dow === 5 || dow === 6 || dow === 0) {
    // Find the Friday anchoring this weekend
    const fri = new Date(date);
    if (dow === 6) fri.setDate(date.getDate() - 1);
    else if (dow === 0) fri.setDate(date.getDate() - 2);
    const wknd = weekendNumberForFriday(fri);
    if (wknd === 3 || wknd === 5) return { who: 'mom', label: `${wknd === 3 ? '3rd' : '5th'} weekend with Mom` };
    const ordinal = wknd === 1 ? '1st' : wknd === 2 ? '2nd' : '4th';
    return { who: 'dad', label: `${ordinal} weekend with Dad` };
  }

  // Weekdays = Mom
  return { who: 'mom', label: 'Weekday with Mom' };
}

/** Next date the parent changes from today's parent. */
export function getNextHandoff(date: Date = new Date()): { date: string; who: 'mom' | 'dad' } | null {
  const today = getParentForDate(date);
  for (let i = 1; i <= 60; i++) {
    const d = new Date(date.getTime() + i * 86400000);
    const p = getParentForDate(d);
    if (p.who !== today.who) return { date: isoDate(d), who: p.who };
  }
  return null;
}

function fmtShortDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Legacy exports for backwards compat with any older imports
export const getCustodyForDate = getParentForDate;
export const getUpcomingHandoffs = (date: Date = new Date(), _limit = 5) => {
  const h = getNextHandoff(date);
  return h ? [{ start: h.date, end: h.date, who: h.who }] : [];
};
export const formatCustodyRange = (p: any) => fmtShortDate(p.start || p);

export function getSummerThemeForWeek(date: Date = new Date()) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return SUMMER_WEEKLY_THEMES[(week - 1 + SUMMER_WEEKLY_THEMES.length) % SUMMER_WEEKLY_THEMES.length];
}

export function getBlocksForChild(day: HomeschoolDay, who: 'marissa' | 'kyle'): HomeschoolBlock[] {
  return day.blocks.filter((b) => !b.who || b.who === who || b.who === 'both');
}

// ── MONTESSORI MONDAY WEEKLY ACTIVITIES ─────────────────────────────
// 12 weekly themes that rotate by ISO week. Each theme has age-tailored
// activities for both kids — Montessori lean: hands-on, sensorial,
// child-led, real materials, no screens.

export type MontessoriPlan = {
  theme: string;                // e.g. "Botany Week"
  bigIdea: string;              // 1-line learning objective
  marissaActivities: string[];  // 3-5 things Marissa can do
  kyleActivities: string[];     // 3-5 things Kyle can do
  jointActivity: string;        // one shared thing they do together
  supplies: string[];           // simple list of stuff to gather
};

export const MONTESSORI_PLANS: MontessoriPlan[] = [
  {
    theme: 'Botany Week — Parts of a Plant',
    bigIdea: 'Plants are living systems with parts that each do a job (root, stem, leaf, flower).',
    marissaActivities: [
      'Dissect a real flower; sketch each part with labels',
      'Plant 3 bean seeds in clear cups — track growth daily for 2 weeks',
      'Read about photosynthesis & write one paragraph in your own words',
      'Make a leaf-rubbing collage using crayons + 5 different leaves',
    ],
    kyleActivities: [
      'Sort a tray of leaves by size, then by color',
      'Match real plant parts to a printed plant diagram',
      'Plant a bean seed and water it daily',
      'Trace and color the word "PLANT" then "ROOT" "STEM" "LEAF"',
    ],
    jointActivity: 'Take a 30-min nature walk and collect 5 different leaves each. Compare back home.',
    supplies: ['flower (any kind)', 'magnifying glass', 'clear cups', 'soil', 'bean seeds', 'leaves', 'crayons', 'paper'],
  },
  {
    theme: 'Number Sense — Counting in Real Life',
    bigIdea: 'Numbers describe things we can see and touch. Counting is the foundation of math.',
    marissaActivities: [
      'Skip-count practice: 2s, 5s, 10s up to 200 — race the clock',
      'Open a "store" with priced items; do change-making with real coins',
      'Multiplication facts 6× and 7× tables — flashcard sprint',
      'Find 5 fractions in the kitchen (1/2 cup, 1/4 tsp, etc.) and write them down',
    ],
    kyleActivities: [
      'Count groups of 1-20 objects (Cheerios, blocks, pebbles)',
      'Place number cards 1-20 in order on the floor',
      'Do "number hunt": find one of each numeral 0-9 around the house',
      'Roll dice and add the dots together (start with 2 dice, then 3)',
    ],
    jointActivity: 'Bake muffins together — Marissa measures, Kyle counts paper liners.',
    supplies: ['real coins', 'flashcards', 'small objects to count', 'dice', 'measuring spoons'],
  },
  {
    theme: 'Geography — Continents & Maps',
    bigIdea: 'Earth has 7 continents and 5 oceans. Where things ARE shapes how people live.',
    marissaActivities: [
      'Label all 7 continents and 5 oceans on a blank world map',
      'Pick one continent — write 5 facts and find one country flag from it',
      'Use Google Earth (with parent) to "fly" to 3 famous landmarks',
      'Make a passport: list 5 countries you want to visit + one reason each',
    ],
    kyleActivities: [
      'Color the continents in a printed world map (each one a different color)',
      'Sing the continents song until you can name all 7 from memory',
      'Match animal cards to the continent they live on (kangaroo → Australia, etc.)',
      'Trace and color the word "EARTH"',
    ],
    jointActivity: 'Globe + sticky notes: place 5 sticky notes on places family has been or wants to visit.',
    supplies: ['blank world map printout', 'globe', 'sticky notes', 'crayons', 'animal pictures'],
  },
  {
    theme: 'Practical Life — Real Skills',
    bigIdea: 'Doing real things with real tools builds confidence and capability.',
    marissaActivities: [
      'Cook a full breakfast for the family from scratch',
      'Hand-wash 3 dishes — water temp, soap order, drying rack',
      'Sew a simple button onto fabric',
      'Write a thank-you note to someone (real card, real stamp)',
    ],
    kyleActivities: [
      'Pour water from pitcher to cup — 5 times without spilling',
      'Use child-safe scissors to cut along a curved line',
      'Sort silverware into the drawer (forks, spoons, knives)',
      'Tie shoes (or velcro practice) until you get it 3x in a row',
    ],
    jointActivity: 'Plan and pack a picnic together — list, gather, fold, carry.',
    supplies: ['breakfast ingredients', 'safe knife', 'needle + thread + button + scrap fabric', 'card + stamp', 'pitcher'],
  },
  {
    theme: 'Sensory Week — 5 Senses',
    bigIdea: 'We learn about the world through 5 senses. Tuning each one in is a superpower.',
    marissaActivities: [
      'Blindfold taste test: identify 5 foods by taste alone',
      'Sound walk: sit outside 10 min, list every sound you hear',
      'Texture sort: 10 objects sorted by rough/smooth/soft/hard',
      'Mindfulness journal: 5-4-3-2-1 grounding (5 see, 4 hear, 3 touch, 2 smell, 1 taste)',
    ],
    kyleActivities: [
      'Mystery bag: feel objects and guess what each one is',
      'Smell jars: match scents (cinnamon, lemon, mint, vanilla, lavender)',
      'Color hunt: find one thing in the house for each rainbow color',
      'Quiet time: lie down 5 min and just LISTEN',
    ],
    jointActivity: 'Make smoothies — pick fruits by smell, taste-test each variation.',
    supplies: ['blindfold', 'small foods', 'mystery bag with objects', 'smell jars', 'fruit'],
  },
  {
    theme: 'Music + Sound',
    bigIdea: 'Music = vibrations + patterns. Anyone can make music with anything.',
    marissaActivities: [
      'Practice singing scales (do-re-mi) with proper breathing for 10 min',
      'Learn the chorus of one new song and record yourself',
      'Identify 5 instruments by sound from a YouTube playlist',
      'Beat-tap along to one song in 4/4 — count and clap',
    ],
    kyleActivities: [
      'Play drums on pillows / pots / table — find a steady "boom-tap-boom-tap"',
      'Try one chord on the guitar (with parent help) — strum 10 times',
      'Listen to 3 songs and pick which one is fastest, slowest, in between',
      'Make a playlist of 5 favorite songs',
    ],
    jointActivity: 'Family jam session — each pick an instrument or pot, jam for 5 minutes.',
    supplies: ['guitar', 'pots / drums', 'speaker / phone for music'],
  },
  {
    theme: 'Animals & Habitats',
    bigIdea: 'Every animal has a home that fits its needs. Habitats are matched to bodies.',
    marissaActivities: [
      'Pick one animal — write a habitat profile: where, what eats, what eats it, how it survives',
      'Compare 3 animals in 3 different habitats (desert, ocean, rainforest)',
      'Watch 1 nature documentary clip and take 5 notes',
      'Draw a food chain: sun → plant → herbivore → carnivore',
    ],
    kyleActivities: [
      'Sort animal cards by where they live (water / land / sky)',
      'Match baby animals to mom animals (calf → cow, joey → kangaroo)',
      'Pretend-play: act out being 3 different animals',
      'Trace + color the word "ANIMAL"',
    ],
    jointActivity: 'Visit a real backyard / park — find and ID 3 living creatures (bug, bird, lizard).',
    supplies: ['animal cards / pictures', 'paper + crayons'],
  },
  {
    theme: 'Color, Light, & Art',
    bigIdea: 'All the colors come from light. Art is how we play with what we see.',
    marissaActivities: [
      'Color theory: paint a color wheel — primary, secondary, complementary',
      'Take 10 photos of the same object in different lighting',
      'Draw something using ONLY shades of one color (monochrome)',
      'Watercolor a sunset using wet-on-wet technique',
    ],
    kyleActivities: [
      'Mix 2 primary colors in a tray — name what you made (red+blue=purple)',
      'Sort crayons by color family (warm vs cool)',
      'Finger-paint a rainbow in correct order (ROYGBIV)',
      'Find 5 things in the house for each color',
    ],
    jointActivity: 'Paint a single canvas together — each does half. Hang it up.',
    supplies: ['paints', 'paper', 'water cups', 'crayons', 'canvas'],
  },
];

export function getMontessoriPlan(date: Date = new Date()): MontessoriPlan {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return MONTESSORI_PLANS[(week - 1 + MONTESSORI_PLANS.length) % MONTESSORI_PLANS.length];
}

export function getWeeklyWordsForKid(date: Date = new Date()): WeeklyWords {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return WEEKLY_WORDS_KINDER[(week - 1 + WEEKLY_WORDS_KINDER.length) % WEEKLY_WORDS_KINDER.length];
}
