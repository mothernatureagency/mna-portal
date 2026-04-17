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
  | 'creator-coach';

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

export function getStudentAgent(id: string): StudentAgent | undefined {
  return STUDENT_AGENTS.find((a) => a.id === id);
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
