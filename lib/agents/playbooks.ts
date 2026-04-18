export type PlaybookItem = {
  day: number;          // days offset from launch date
  platform: string;
  content_type: string;
  title: string;
  hook: string;
  cta: string;
  phase: string;
  // Optional full caption, written in client voice.
  // When present, it gets seeded directly into content_calendar.caption
  // so no AI generation is needed and the client voice is preserved exactly.
  caption?: string;
};

export type Playbook = {
  id: string;
  name: string;
  description: string;
  items: PlaybookItem[];
};

// Pinecrest grand reopening — 30 day playbook
export const PINECREST_REOPENING: Playbook = {
  id: 'pinecrest-reopening',
  name: 'Prime IV Pinecrest — Grand Reopening',
  description:
    '30-day launch playbook covering teaser, buildout, founder story, menu reveals, soft open, and grand opening.',
  items: [
    // Phase 1 — Teaser (days 1-7)
    { day: 1, platform: 'Instagram', content_type: 'Reel', title: 'Teaser: Something is coming to Pinecrest', hook: 'Pinecrest, something you\'ve been waiting for is almost here…', cta: 'Follow for the reveal', phase: 'Teaser' },
    { day: 2, platform: 'TikTok', content_type: 'Reel', title: 'Countdown: 30 days', hook: 'In 30 days, Pinecrest gets its premium IV therapy home.', cta: 'Follow to count down with us', phase: 'Teaser' },
    { day: 3, platform: 'Instagram', content_type: 'Story', title: 'Poll: What wellness service do you want most?', hook: 'Help us build the menu you actually want.', cta: 'Vote now', phase: 'Teaser' },
    { day: 4, platform: 'Instagram', content_type: 'Carousel', title: 'What is Prime IV?', hook: '5 reasons IV therapy is the new self-care.', cta: 'Save this post', phase: 'Teaser' },
    { day: 5, platform: 'TikTok', content_type: 'Reel', title: 'POV: You walk into Prime IV Pinecrest', hook: 'POV: You just discovered your new wellness obsession.', cta: 'Follow for opening day', phase: 'Teaser' },
    { day: 6, platform: 'Instagram', content_type: 'Reel', title: 'Meet the space: empty → ready', hook: 'This space is about to transform. Here\'s the before.', cta: 'Watch the transformation', phase: 'Teaser' },
    { day: 7, platform: 'Instagram', content_type: 'Post', title: 'Save the date: Grand Opening', hook: 'Mark your calendars, Pinecrest.', cta: 'Tag a friend you\'re bringing', phase: 'Teaser' },

    // Phase 2 — Buildout / BTS (days 8-14)
    { day: 8, platform: 'TikTok', content_type: 'Reel', title: 'Build-out day 1: Demo', hook: 'Watch us rip out the old and build the new.', cta: 'Follow the buildout', phase: 'Buildout' },
    { day: 9, platform: 'Instagram', content_type: 'Story', title: 'Behind the scenes: picking chairs', hook: 'We tested 12 IV chairs so you don\'t have to.', cta: 'Vote on your favorite', phase: 'Buildout' },
    { day: 10, platform: 'Instagram', content_type: 'Reel', title: 'Meet the founders', hook: 'We\'re Alexus and [partner name], and here\'s why we opened Prime IV Pinecrest.', cta: 'Come meet us opening day', phase: 'Founder Story' },
    { day: 11, platform: 'TikTok', content_type: 'Reel', title: 'My first time getting IV therapy', hook: 'I was nervous. Here\'s what actually happened.', cta: 'Book your first drip', phase: 'Founder Story' },
    { day: 12, platform: 'Instagram', content_type: 'Carousel', title: 'Menu sneak peek', hook: 'The 6 drips that will change your week.', cta: 'Which one are you trying first?', phase: 'Menu Reveal' },
    { day: 13, platform: 'Instagram', content_type: 'Reel', title: 'NAD+ explained in 30s', hook: 'Why NAD+ is the drip everyone is talking about.', cta: 'Save for later', phase: 'Menu Reveal' },
    { day: 14, platform: 'TikTok', content_type: 'Reel', title: 'Myers Cocktail tier list', hook: 'I ranked every IV drip. #1 will surprise you.', cta: 'Follow for the full list', phase: 'Menu Reveal' },

    // Phase 3 — Menu + Offer (days 15-21)
    { day: 15, platform: 'Instagram', content_type: 'Post', title: 'Founding 50 membership drop', hook: 'First 50 members get lifetime pricing. That\'s it.', cta: 'Join the waitlist', phase: 'Offer Drop' },
    { day: 16, platform: 'Instagram', content_type: 'Reel', title: 'How much does IV therapy actually cost?', hook: 'Everyone asks. Here\'s the honest answer.', cta: 'DM us for the price list', phase: 'Offer Drop' },
    { day: 17, platform: 'TikTok', content_type: 'Reel', title: 'Morning-after hangover drip', hook: 'Bachelorette weekend? We got you.', cta: 'Book your group', phase: 'Menu Reveal' },
    { day: 18, platform: 'Instagram', content_type: 'Carousel', title: 'Before & after: Hydration drip', hook: '30 minutes. Look at the difference.', cta: 'Book your first session', phase: 'Menu Reveal' },
    { day: 19, platform: 'Instagram', content_type: 'Story', title: 'AMA with the founders', hook: 'Drop your questions. We\'re answering all of them live.', cta: 'Reply with questions', phase: 'Founder Story' },
    { day: 20, platform: 'TikTok', content_type: 'Reel', title: 'Day-in-the-life: IV nurse', hook: 'What our nurses actually do all day.', cta: 'Meet our team opening day', phase: 'Team' },
    { day: 21, platform: 'Instagram', content_type: 'Reel', title: 'Space reveal: finished', hook: 'From empty box to this. Opening next week.', cta: 'Book grand opening slot', phase: 'Space Reveal' },

    // Phase 4 — Soft Open (days 22-26)
    { day: 22, platform: 'Instagram', content_type: 'Post', title: 'Soft open invite: Founders Club', hook: 'Founders Club gets in first. Are you in?', cta: 'Claim your spot', phase: 'Soft Open' },
    { day: 23, platform: 'TikTok', content_type: 'Reel', title: 'Soft open highlights', hook: 'Our founding members got the first drips. Here\'s what happened.', cta: 'Book your own', phase: 'Soft Open' },
    { day: 24, platform: 'Instagram', content_type: 'Story', title: 'Founder member testimonial', hook: '"I felt amazing for days after." — [member name]', cta: 'Come try it yourself', phase: 'Soft Open' },
    { day: 25, platform: 'Instagram', content_type: 'Reel', title: 'Final prep for Grand Opening', hook: 'T-minus 2 days. Here\'s what we\'re doing to get ready.', cta: 'See you Saturday', phase: 'Soft Open' },
    { day: 26, platform: 'TikTok', content_type: 'Reel', title: 'Grand Opening countdown', hook: '24 hours. Pinecrest, are you ready?', cta: 'RSVP now', phase: 'Soft Open' },

    // Phase 5 — Grand Opening Week (days 27-30)
    { day: 27, platform: 'Instagram', content_type: 'Reel', title: 'WE ARE OPEN', hook: 'Prime IV Pinecrest is officially open.', cta: 'Book your first drip today', phase: 'Grand Opening' },
    { day: 28, platform: 'Instagram', content_type: 'Carousel', title: 'Opening day recap', hook: 'Yesterday was unreal. Thank you, Pinecrest.', cta: 'Tag yourself if you were there', phase: 'Grand Opening' },
    { day: 29, platform: 'TikTok', content_type: 'Reel', title: 'Opening day highlights', hook: 'Our first day in 60 seconds.', cta: 'Come in this week', phase: 'Grand Opening' },
    { day: 30, platform: 'Instagram', content_type: 'Post', title: 'Week 1 thank you', hook: 'Week 1 is in the books. Here\'s what\'s next.', cta: 'Book your next visit', phase: 'Grand Opening' },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// Prime IV Niceville — Spring Reset & Detox 45-day playbook
// Written in the client's approved voice (warm, emoji led, short lines,
// no em dashes, "Reply BOOK" signature CTA, linktr.ee/primeivniceville).
// Built around the new spa video + photo shoot and a Spring Reset Bundle
// (IV drip + NAD+ boost + Glutathione amplifier). Mirrors their recurring
// rituals: After Hours event, Secret Menu, Intro Drip, NAD+ Buy 4 Get 1,
// Share the Love tier 2 two for $200, giveaway post, referral push.
// ─────────────────────────────────────────────────────────────────────
export const NICEVILLE_SPRING_RESET: Playbook = {
  id: 'niceville-spring-reset',
  name: 'Prime IV Niceville — Spring Reset 45 Day',
  description:
    '45 day Spring Reset & Detox plan featuring the new spa shoot, Spring Reset Bundle, After Hours event, giveaway, referral push, and Intro Drip promo. 22 posts across IG and FB in the approved client voice.',
  items: [
    // ── Phase 1 — Spring Tease + Spa Reveal (days 1-7) ───────────────
    {
      day: 1, platform: 'Instagram', content_type: 'Reel', phase: 'Spring Reveal',
      title: 'Spring Reveal Reel — new spa walkthrough',
      hook: 'Step inside your one hour vacation.',
      cta: 'Reply BOOK or tap the link in bio',
      caption:
`✨ Welcome to your one hour vacation 💧

Spring is here and we are opening the doors to something special. Come see our freshly shot spa walkthrough and feel the difference from the moment you step in.

Himalayan salt walls. Zero gravity chairs. Private member room. All the calm your nervous system has been asking for.

📍 Prime IV Hydration & Wellness, Niceville
💧 Reply BOOK to grab your first drip
🔗 linktr.ee/primeivniceville`,
    },
    {
      day: 3, platform: 'Instagram', content_type: 'Carousel', phase: 'Spring Reveal',
      title: 'Spring Reset Bundle teaser carousel',
      hook: 'Reset your body. Refresh your glow. Recharge your energy.',
      cta: 'Stay tuned, bundle drops this week',
      caption:
`🌿 Something fresh is coming to Niceville

This spring we are introducing the Spring Reset Bundle, built to help you feel lighter, clearer, and ready for the season ahead.

✨ Signature IV drip
✨ NAD+ boost for cellular energy
✨ Glutathione for detox and skin glow

One visit. Three benefits. Zero guesswork.

🔗 Save this post and watch your DMs. Bundle drops this week.
linktr.ee/primeivniceville`,
    },
    {
      day: 5, platform: 'Instagram', content_type: 'Reel', phase: 'Spring Reveal',
      title: 'Member room photo reel — salt wall + zero gravity chairs',
      hook: 'This is where your reset begins.',
      cta: 'Reply BOOK to claim your chair',
      caption:
`💧 The member room is waiting for you

Close your eyes. Recline into a zero gravity chair. Let the Himalayan salt wall do its thing while your drip does the rest.

Whether you are here for energy, immunity, recovery, or glow, this is the quiet corner of Niceville where your body gets to reset.

✨ Members enjoy exclusive pricing on add ons
✨ Non members welcome any day

Reply BOOK to claim your chair 💧
linktr.ee/primeivniceville`,
    },
    {
      day: 7, platform: 'Facebook', content_type: 'Post', phase: 'Spring Reveal',
      title: 'FB cross post — spa reveal photo set',
      hook: 'Niceville, your spring reset starts here.',
      cta: 'Book online or call 850 820 4819',
      caption:
`Niceville, meet your new favorite hour of the week.

Prime IV Hydration & Wellness is more than an IV drip. It is a full reset for your body and mind in a calming spa setting built around you.

📍 Locally owned in Niceville
💧 Medical grade IV therapy, NAD+, injections, and peptides
🧖‍♀️ Private member room with zero gravity chairs and salt wall

Book online at linktr.ee/primeivniceville or call 850 820 4819.`,
    },

    // ── Phase 2 — Reset Education (days 8-14) ─────────────────────────
    {
      day: 9, platform: 'Instagram', content_type: 'Carousel', phase: 'Education',
      title: 'Why Spring Reset carousel — Glutathione 101',
      hook: 'Your spring glow is literally inside you.',
      cta: 'Add Glutathione to any drip this month',
      caption:
`🌿 Glutathione 101 for your spring glow

Glutathione is your body's master antioxidant. It supports detox, immune defense, skin brightness, and cellular protection.

When you add it to your IV drip, you get 100% absorption compared to oral supplements, which means your body actually uses what you are paying for.

✨ Supports detox pathways
✨ Brightens skin from the inside
✨ Helps with bloating and gut balance
✨ Pairs beautifully with any Tier 1 or Tier 2 drip

Ask your infusion specialist to add it this month and feel the difference.

🔗 linktr.ee/primeivniceville`,
    },
    {
      day: 11, platform: 'Instagram', content_type: 'Reel', phase: 'Education',
      title: 'NAD+ explained in 30 seconds — new spa footage',
      hook: 'Everyone is talking about NAD+, here is why.',
      cta: 'Reply BOOK',
      caption:
`🧬 NAD+ in 30 seconds

NAD+ is a coenzyme in every cell of your body. It powers energy, brain function, metabolism, and healthy aging. Levels naturally decline with time.

An IV NAD+ session helps restore what age and stress take away.

✨ Mental clarity
✨ Cellular energy
✨ Recovery support
✨ Long term vitality

Our NAD+ packages are built to stack savings, and members get extra perks.

Reply BOOK 💧
linktr.ee/primeivniceville`,
    },
    {
      day: 13, platform: 'Instagram', content_type: 'Post', phase: 'Education',
      title: 'Buccal Peptides highlight',
      hook: 'Say hello to the future of wellness at Prime IV.',
      cta: 'Ask about our peptide menu',
      caption:
`✨ Meet the no needle upgrade your routine has been waiting for

Buccal Peptides are dissolvable strips that support recovery, immunity, beauty, libido, and performance in one easy format.

👅 Place one on your tongue and go
💧 Pair with any drip for a full spectrum reset

Ask your infusion specialist how to add peptides to your spring plan.

🔗 linktr.ee/primeivniceville`,
    },

    // ── Phase 3 — Bundle Launch (days 15-21) ──────────────────────────
    {
      day: 15, platform: 'Instagram', content_type: 'Reel', phase: 'Bundle Launch',
      title: 'Spring Reset Bundle LAUNCH reel',
      hook: 'The Spring Reset Bundle is officially here.',
      cta: 'Reply BOOK or link in bio',
      caption:
`🌿 Spring Reset Bundle is LIVE 💧

Built to help you shed the winter heaviness and feel lit up from the inside out.

✨ Signature Tier 2 IV drip
✨ NAD+ boost for cellular energy and focus
✨ Glutathione add on for detox and skin glow

Bundle pricing available for a limited time only.
Members unlock even more savings.

Reply BOOK or visit linktr.ee/primeivniceville 💧`,
    },
    {
      day: 17, platform: 'Facebook', content_type: 'Post', phase: 'Bundle Launch',
      title: 'FB Spring Reset Bundle announcement',
      hook: 'Feel lighter. Feel brighter. Feel like you again.',
      cta: 'Call or text 850 820 4819 to book',
      caption:
`🌿 Spring Reset Bundle is here for Niceville

A full body reset designed for the season. IV hydration, NAD+ for energy, and Glutathione for a full spring glow. One appointment, one hour, fully reset.

💧 Limited time bundle pricing
💧 Members save even more
💧 Available now through the end of the month

Call or text 850 820 4819 or book at linktr.ee/primeivniceville`,
    },
    {
      day: 19, platform: 'Instagram', content_type: 'Carousel', phase: 'Bundle Launch',
      title: 'Spring Reset Bundle — what each drip does',
      hook: 'What is actually in your Spring Reset?',
      cta: 'Swipe to see each benefit',
      caption:
`💧 What is in your Spring Reset Bundle?

Swipe to see exactly what each part does for your body.

Slide 1 → The IV drip. Full hydration and vitamin panel.
Slide 2 → NAD+. Cellular energy, focus, recovery.
Slide 3 → Glutathione. Detox, immune defense, spring glow.
Slide 4 → The experience. Zero gravity chair, salt wall, private member room.

✨ All in one hour
✨ Designed to stack

Reply BOOK or link in bio 💧
linktr.ee/primeivniceville`,
    },
    {
      day: 21, platform: 'Instagram', content_type: 'Reel', phase: 'Bundle Launch',
      title: 'Before and after Spring Reset testimonial reel (new footage)',
      hook: 'One hour in, one hour out. Here is the difference.',
      cta: 'Reply BOOK to feel it yourself',
      caption:
`💧 Before and after a Spring Reset

Walked in foggy and tired. Walked out lit up and clear headed.

This is what a full body reset feels like when IV hydration, NAD+, and Glutathione all work together.

✨ Real client, real reset
✨ Bundle pricing on now
✨ Limited time only

Reply BOOK to feel it yourself 💧
linktr.ee/primeivniceville`,
    },

    // ── Phase 4 — After Hours Spring Reset Event (days 22-28) ─────────
    {
      day: 22, platform: 'Instagram', content_type: 'Post', phase: 'After Hours',
      title: 'After Hours Spring Reset Night save the date',
      hook: 'You are invited.',
      cta: 'Reserve your spot at linktr.ee/primeivniceville',
      caption:
`✨ You are invited to Spring Reset After Hours ✨

Join us for an exclusive evening of wellness, perks, and savings you can only get after hours.

📅 Save the date
⏰ 6:00 PM to 9:00 PM
📍 Prime IV Niceville

What to expect
💧 Spring Reset Bundle at event only pricing
🌿 Secret menu unlocked
🎁 Free injection with qualifying infusions
🥂 Light bites and a little something bubbly

Spots are limited. Call or text 850 820 4819 to reserve.
🔗 linktr.ee/primeivniceville`,
    },
    {
      day: 24, platform: 'Instagram', content_type: 'Reel', phase: 'After Hours',
      title: 'After Hours giveaway announcement — free intro drip',
      hook: 'GIVEAWAY. One lucky winner, one free drip.',
      cta: 'Like, tag friends, follow @primeivniceville',
      caption:
`🎉 GIVEAWAY ALERT 🎉

One lucky winner takes home a FREE Intro Drip 💧

✅ HOW TO ENTER
✔ Like this post
✔ Tag your friends in the comments, each tag is one extra entry
✔ Must be following @primeivniceville to win

🎟 Bonus entry for anyone who registers for Spring Reset After Hours through the link.

📅 Winner drawn the day of the event
📍 Event night 6:00 PM to 9:00 PM

🔗 RSVP here: linktr.ee/primeivniceville`,
    },
    {
      day: 26, platform: 'Facebook', content_type: 'Post', phase: 'After Hours',
      title: 'FB Spring Reset After Hours reminder',
      hook: 'Almost 50% sold out.',
      cta: 'Reserve your spot today',
      caption:
`Spring Reset After Hours is almost halfway full.

If you have been thinking about joining us, now is the time to reserve your spot before we are fully booked.

📅 Event night 6:00 PM to 9:00 PM
📍 Prime IV Niceville
💧 Spring Reset Bundle at event only pricing
🎁 Free injection with qualifying infusions

Call or text 850 820 4819 or book online at linktr.ee/primeivniceville`,
    },
    {
      day: 28, platform: 'Instagram', content_type: 'Story', phase: 'After Hours',
      title: 'After Hours TOMORROW reminder',
      hook: 'After Hours is tomorrow.',
      cta: 'Reply BOOK to grab the last spots',
      caption:
`⏰ Spring Reset After Hours is TOMORROW

6:00 PM to 9:00 PM. Last chance to grab a spot and lock in event only pricing on the Spring Reset Bundle.

💧 Bring a friend, you both get a free injection
🌿 Secret menu unlocked
🥂 Light bites and bubbly

Reply BOOK or tap the link to reserve the last spots.
linktr.ee/primeivniceville`,
    },

    // ── Phase 5 — Giveaway Winner + Referral Push (days 29-35) ────────
    {
      day: 29, platform: 'Instagram', content_type: 'Post', phase: 'Referral',
      title: 'Giveaway winner + After Hours recap',
      hook: 'Congrats to our winner.',
      cta: 'Check your DMs, winner',
      caption:
`🎉 GIVEAWAY WINNER 🎉

Congrats to our winner, check your DMs 💧

Thank you to everyone who joined us for Spring Reset After Hours. The energy was unreal, the salt wall was glowing, and the Spring Reset Bundles were flying out the door.

Missed it? Our next After Hours is just around the corner. Follow along so you do not miss it.

🔗 linktr.ee/primeivniceville`,
    },
    {
      day: 31, platform: 'Instagram', content_type: 'Reel', phase: 'Referral',
      title: 'Referral program launch reel',
      hook: 'Share the reset. You both save $25.',
      cta: 'Sign up in the link in bio',
      caption:
`💧 Introducing the Prime IV Niceville Referral Program

Share the reset with a friend and you both save $25 when they come in for their first IV.

✨ Perfect for After Hours
✨ Perfect for a spring glow day
✨ Perfect for treating someone who needs it

Sign up here 👇
linktr.ee/primeivniceville`,
    },
    {
      day: 33, platform: 'Instagram', content_type: 'Carousel', phase: 'Referral',
      title: 'Intro Drip spotlight — $85 offer',
      hook: 'The Intro Drip is the easiest yes of your spring.',
      cta: 'Reply BOOK to claim',
      caption:
`💧 Intro Drip $85, a $144 value

Never tried IV therapy before? Start here.

✨ Full medical grade IV hydration
✨ One on one consultation
✨ Private member room experience
✨ Zero gravity chair and salt wall

Perfect for first timers, perfect for friends you want to bring in on the referral program.

Reply BOOK or visit linktr.ee/primeivniceville`,
    },
    {
      day: 35, platform: 'Instagram', content_type: 'Reel', phase: 'Referral',
      title: 'UGC feature — real client reset story',
      hook: 'Hear it from a real Niceville regular.',
      cta: 'Reply BOOK to start your own reset',
      caption:
`✨ Real client, real reset

"It was my first IV experience and it was incredible. I just feel so good now afterwards. So relaxed and rejuvenated. I feel totally awake and alert but at the same time totally relaxed. I feel like a million bucks."

This is the difference between a caffeine fix and a full body reset.

Come feel it yourself.
Reply BOOK 💧
linktr.ee/primeivniceville`,
    },

    // ── Phase 6 — Last Call + Urgency (days 36-42) ────────────────────
    {
      day: 37, platform: 'Instagram', content_type: 'Post', phase: 'Last Call',
      title: 'Spring Reset Bundle last week reminder',
      hook: 'One week left on Spring Reset pricing.',
      cta: 'Reply BOOK before it is gone',
      caption:
`⏳ One week left on Spring Reset Bundle pricing 💧

If you have been waiting for a sign, this is it.

✨ Signature IV drip
✨ NAD+ boost
✨ Glutathione for detox and glow

Bundle pricing ends soon. Members save even more.

Reply BOOK or grab your spot at linktr.ee/primeivniceville`,
    },
    {
      day: 40, platform: 'Instagram', content_type: 'Story', phase: 'Last Call',
      title: '48 hours left story series',
      hook: '48 hours left.',
      cta: 'Link in bio',
      caption:
`⏳ 48 hours left on Spring Reset Bundle 💧

Lock in the full reset before bundle pricing ends.

✨ Limited time pricing
✨ Members save more
✨ Perfect for that glow day before summer

Link in bio 🌿
linktr.ee/primeivniceville`,
    },
    {
      day: 42, platform: 'Instagram', content_type: 'Reel', phase: 'Last Call',
      title: 'Spring Reset last call reel',
      hook: 'Last call on Spring Reset.',
      cta: 'Reply BOOK',
      caption:
`⏳ Final call, Niceville 💧

Spring Reset Bundle pricing ends at midnight. After that, the bundle goes away and the pricing goes back to retail.

If you needed a reason to finally come in, this is it.

Reply BOOK or visit linktr.ee/primeivniceville 🌿`,
    },

    // ── Phase 7 — Bridge Into Next Season (days 43-45) ────────────────
    {
      day: 45, platform: 'Instagram', content_type: 'Post', phase: 'Bridge',
      title: 'Thank you Niceville + what comes next',
      hook: 'Thank you, Niceville.',
      cta: 'Stay tuned for the next one',
      caption:
`💧 Thank you, Niceville

Spring Reset was one for the books. Thank you for showing up, resetting with us, and bringing your friends through the door.

What is next?
✨ Summer Glow menu in the works
✨ Another After Hours on the way
✨ More new faces joining our member room

Follow along, stay hydrated, and we will see you soon.

🔗 linktr.ee/primeivniceville`,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// Serenity Bayfront — VRBO Launch + Spring Booking Push 30-day playbook
// Written in warm, inviting, coastal voice. Emoji-led, short lines,
// no em dashes. Target platforms: Instagram, Facebook, TikTok.
// Phases: Property Reveal → VRBO Live → Guest Experience → Social Proof
// ─────────────────────────────────────────────────────────────────────
export const SERENITY_VRBO_LAUNCH: Playbook = {
  id: 'serenity-vrbo-launch',
  name: 'Serenity Bayfront — VRBO Launch + Spring Booking Push',
  description:
    '30-day playbook covering property reveal with new shoot footage, VRBO listing launch, Airbnb cross-promo, guest experience spotlights, early booking incentive, social proof, summer urgency, and referral program. Warm coastal voice across IG, FB, and TikTok.',
  items: [
    // ── Week 1: Property Reveal (days 1-7) ─────────────────────────
    {
      day: 1, platform: 'Instagram', content_type: 'Reel', phase: 'Property Reveal',
      title: 'First look — bayfront golden hour walkthrough',
      hook: 'Your next getaway just got a whole lot prettier.',
      cta: 'Save this for your next trip down south',
      caption:
`🌅 Welcome to Serenity on the Bay

Golden hour on the Freeport waterfront looks a little different from here. Step inside and see why this bayfront retreat has guests coming back season after season.

🐚 Waterfront views from every room
🌊 Private dock access
☀️ Steps from the bay, minutes from Destin

Save this for your next trip down the Emerald Coast.
📍 Freeport, FL`,
    },
    {
      day: 2, platform: 'TikTok', content_type: 'Reel', phase: 'Property Reveal',
      title: 'POV: You just arrived at Serenity',
      hook: 'POV: You pull into the driveway and this is what you see.',
      cta: 'Follow for the full tour',
      caption:
`🌴 POV: vacation mode activated

You pull up to the driveway. The bay is right there. The breeze hits different. Your phone goes on silent for the rest of the week.

This is Serenity on the Bay in Freeport, FL and your next escape starts here.

🔗 Follow for the full tour and booking details`,
    },
    {
      day: 3, platform: 'Instagram', content_type: 'Carousel', phase: 'Property Reveal',
      title: 'Room by room photo carousel — new shoot',
      hook: 'Swipe through your next home away from home.',
      cta: 'Which room are you claiming first?',
      caption:
`🏡 Room by room, this place hits different

Swipe through and pick your favorite spot 👉

1️⃣ The living room with that bay view
2️⃣ Primary suite with morning light
3️⃣ The kitchen (yes, you will actually cook here)
4️⃣ Outdoor deck with sunset seating
5️⃣ The dock. Just the dock.

📍 Serenity on the Bay, Freeport FL
Drop a 🌊 if you are ready to book`,
    },
    {
      day: 5, platform: 'Instagram', content_type: 'Reel', phase: 'Property Reveal',
      title: 'Sunset timelapse from the dock',
      hook: 'No filter needed when you are on the bay.',
      cta: 'Link in bio to check availability',
      caption:
`🌅 No filter. No edits. Just the bay doing its thing.

Every evening at Serenity ends like this. Pull up a chair on the dock, pour something cold, and let the sky put on a show.

This is what vacation is supposed to feel like.

📍 Freeport, FL
🔗 Check availability in bio`,
    },
    {
      day: 6, platform: 'Facebook', content_type: 'Post', phase: 'Property Reveal',
      title: 'FB intro post — meet Serenity on the Bay',
      hook: 'Meet your new favorite vacation rental on the Emerald Coast.',
      cta: 'Book on Airbnb or message us direct',
      caption:
`Meet Serenity on the Bay 🌊

A bayfront vacation home in Freeport, FL with waterfront views, private dock access, and all the space your group needs to slow down and soak it in.

🐚 Perfect for families, friend trips, and couples getaways
📍 Minutes from Destin, Henderson Beach, and Crab Island
☀️ Available on Airbnb now, VRBO coming very soon

Message us or book through the link for availability and rates.`,
    },
    {
      day: 7, platform: 'Instagram', content_type: 'Story', phase: 'Property Reveal',
      title: 'Poll: What is your dream vacation vibe?',
      hook: 'Help us plan your perfect stay.',
      cta: 'Vote now',
      caption:
`🌴 Quick question for you

What is your dream vacation vibe?

A) Kayak and coffee mornings on the dock
B) Sunset drinks and no plans at all
C) All the beach days plus a cozy home base
D) A little bit of everything

Vote and we will show you what Serenity has for you 💧`,
    },

    // ── Week 2: VRBO Is LIVE + Airbnb Cross-Promo (days 8-14) ──────
    {
      day: 8, platform: 'Instagram', content_type: 'Reel', phase: 'VRBO Launch',
      title: 'VRBO LISTING IS LIVE announcement',
      hook: 'Big news. Serenity is now on VRBO.',
      cta: 'Book on VRBO or Airbnb, link in bio',
      caption:
`🚀 IT'S LIVE

Serenity on the Bay is officially on VRBO! Now you can book your bayfront getaway on whichever platform you love.

✅ Airbnb? We are there.
✅ VRBO? We are there now too.
🏡 Same stunning property. Same bayfront views. More ways to book.

Summer dates are already filling up. Do not wait on this one.

🔗 Link in bio for both platforms`,
    },
    {
      day: 9, platform: 'TikTok', content_type: 'Reel', phase: 'VRBO Launch',
      title: 'Airbnb vs VRBO — same house, two ways to book',
      hook: 'Airbnb or VRBO? Yes.',
      cta: 'Links in bio for both',
      caption:
`Airbnb people 🤝 VRBO people

We do not pick sides over here. Serenity on the Bay is now live on BOTH platforms so you can book however you like.

Same waterfront home. Same views. Same vibes.
Just more ways to say yes to your next getaway.

📍 Freeport, FL
🔗 Both links in bio`,
    },
    {
      day: 10, platform: 'Facebook', content_type: 'Post', phase: 'VRBO Launch',
      title: 'FB VRBO launch announcement',
      hook: 'Now booking on VRBO!',
      cta: 'Search "Serenity Freeport" on VRBO or Airbnb',
      caption:
`Exciting news! Serenity on the Bay is now available on VRBO in addition to Airbnb 🎉

If you have been eyeing a bayfront getaway on the Emerald Coast, now you have two easy ways to book.

🌊 Waterfront views from every room
🏡 Full home with private dock
📍 Minutes from Destin and Crab Island
☀️ Summer dates going fast

Search "Serenity Freeport" on VRBO or Airbnb to check availability.`,
    },
    {
      day: 12, platform: 'Instagram', content_type: 'Carousel', phase: 'VRBO Launch',
      title: '5 reasons to book Serenity this spring',
      hook: 'Shoulder season is the Emerald Coast best kept secret.',
      cta: 'Book a spring stay before peak rates kick in',
      caption:
`🌿 5 reasons to book Serenity this spring

1️⃣ Shoulder season rates before summer prices hit
2️⃣ Warm enough to kayak, not crowded enough to fight for a beach chair
3️⃣ Sunsets are unreal in April and May
4️⃣ The bay is calm and the fishing is hot
5️⃣ You deserve a reset and you know it

Spring is the Emerald Coast best kept secret. Do not let it pass you by.

🔗 Book on Airbnb or VRBO, link in bio`,
    },
    {
      day: 14, platform: 'Instagram', content_type: 'Story', phase: 'VRBO Launch',
      title: 'Countdown to summer booking rush',
      hook: 'Summer dates are moving fast.',
      cta: 'Tap to check availability',
      caption:
`⏳ Summer countdown is on

Peak season starts in just a few weeks and our calendar is already filling up for June and July.

If you are planning a summer trip to the Emerald Coast, now is the time to lock in your dates at Serenity on the Bay.

🌊 Tap to check availability
📍 Freeport, FL`,
    },

    // ── Week 3: Guest Experience + Early Booking Incentive (days 15-21) ──
    {
      day: 15, platform: 'Instagram', content_type: 'Reel', phase: 'Guest Experience',
      title: 'Morning routine at Serenity — coffee on the dock',
      hook: 'This is how mornings should feel.',
      cta: 'Book your morning on the bay',
      caption:
`☕ Morning routine at Serenity

Step 1: Wake up with bay views
Step 2: Coffee on the dock
Step 3: Watch the dolphins cruise by
Step 4: Realize you do not have to go back to work yet

This is what mornings are supposed to feel like.

📍 Serenity on the Bay, Freeport FL
🔗 Book your morning on the bay, link in bio`,
    },
    {
      day: 16, platform: 'TikTok', content_type: 'Reel', phase: 'Guest Experience',
      title: 'Things to do near Serenity — 60 second guide',
      hook: 'Everything within 20 minutes of the front door.',
      cta: 'Save this for your trip',
      caption:
`📍 Everything near Serenity on the Bay

5 min: Kayak launch right from our dock
10 min: Crab Island sandbar
15 min: Destin Harbor boardwalk
15 min: Henderson Beach State Park
20 min: Shopping and dining in Destin Commons

You are in the middle of everything without being in the middle of the chaos.

Save this for your trip 🌴`,
    },
    {
      day: 18, platform: 'Instagram', content_type: 'Carousel', phase: 'Guest Experience',
      title: 'Amenity spotlight — kitchen, dock, outdoor space',
      hook: 'The little things that make a big difference.',
      cta: 'Which amenity are you most excited about?',
      caption:
`✨ The details that make Serenity feel like home

Swipe through and see what is waiting for you 👉

🍳 Fully stocked kitchen with everything you need
🎣 Private dock with kayak and paddleboard storage
🌅 Outdoor deck with sunset seating for 6
📺 Smart TVs in every room
🛏️ Premium bedding that actually makes you sleep in

These are not hotel amenities. This is a home on the bay built for real relaxation.

📍 Freeport, FL
🔗 Book in bio`,
    },
    {
      day: 19, platform: 'Instagram', content_type: 'Post', phase: 'Guest Experience',
      title: 'Early booking incentive — 10% off first VRBO stay',
      hook: 'Our VRBO grand opening gift to you.',
      cta: 'Message us "VRBO10" for the discount code',
      caption:
`🎁 VRBO Launch Special

To celebrate Serenity going live on VRBO, we are offering 10% off your first booking through the platform.

✅ Valid for stays through September 2026
✅ Works on any available dates
✅ Just message us "VRBO10" and we will send you the code

This is our way of saying thank you for being early and helping us build something special.

📍 Serenity on the Bay, Freeport FL
🔗 VRBO + Airbnb links in bio`,
    },
    {
      day: 21, platform: 'Facebook', content_type: 'Post', phase: 'Guest Experience',
      title: 'FB — perfect for families post',
      hook: 'The kind of family trip where everyone actually relaxes.',
      cta: 'Message us to check dates',
      caption:
`The kind of family trip where everyone actually relaxes 🌊

Serenity on the Bay is built for families who want space, water, and zero stress. The kids can fish off the dock while you sip coffee on the deck. Everyone wins.

🏡 Full home with room to spread out
🐚 Bayfront with private dock
📍 Minutes from kid-friendly beaches and Crab Island

Message us or book on Airbnb and VRBO. Summer dates are going fast.`,
    },

    // ── Week 4: Social Proof + Urgency + Referral (days 22-30) ──────
    {
      day: 22, platform: 'Instagram', content_type: 'Reel', phase: 'Social Proof',
      title: 'Guest reaction reel — first impressions',
      hook: 'The look on their faces when they walk in.',
      cta: 'Be the next guest to feel this',
      caption:
`😍 That first moment when you walk in

There is a look guests get when they step through the door and see the bay for the first time. It is part surprise, part relief, part "why did I not book this sooner."

We live for that moment.

📍 Serenity on the Bay, Freeport FL
🔗 Be the next guest, book in bio`,
    },
    {
      day: 23, platform: 'Instagram', content_type: 'Post', phase: 'Social Proof',
      title: 'First review highlight',
      hook: 'What our guests are saying.',
      cta: 'Read more reviews on Airbnb',
      caption:
`⭐ What our guests are saying

"The views are incredible and the house is even better than the photos. We did not want to leave."

Thank you to every guest who has stayed with us so far. Your words mean everything and they help future guests find their way to the bay.

📍 Serenity on the Bay
🔗 Read reviews and book on Airbnb or VRBO, link in bio`,
    },
    {
      day: 25, platform: 'TikTok', content_type: 'Reel', phase: 'Social Proof',
      title: 'Summer dates are filling up — urgency reel',
      hook: 'This is not a drill. Summer is almost booked.',
      cta: 'Check availability before it is gone',
      caption:
`⏳ Summer calendar check

June: Almost full
July 4th week: GONE
July: A few spots left
August: Still open but moving fast

If you have been thinking about a bayfront getaway this summer, the window is closing.

📍 Serenity on the Bay, Freeport FL
🔗 Check dates in bio before your week is gone`,
    },
    {
      day: 26, platform: 'Instagram', content_type: 'Carousel', phase: 'Social Proof',
      title: 'Serenity by the numbers — what guests love most',
      hook: 'The numbers do not lie.',
      cta: 'Join the guest list',
      caption:
`📊 Serenity by the numbers

🌅 Sunsets watched from the dock: countless
🐬 Dolphin sightings per week: 3+ (they are regulars)
☕ Cups of coffee on the deck: too many to count
⭐ Average guest rating: building our way to Superhost
🏖️ Minutes to the beach: under 15

The numbers say it all. Come see for yourself.

📍 Freeport, FL
🔗 Book in bio`,
    },
    {
      day: 27, platform: 'Instagram', content_type: 'Reel', phase: 'Social Proof',
      title: 'Referral program launch — share the bay',
      hook: 'Know someone who needs a vacation? This one is for you.',
      cta: 'Tag them below or DM us for the referral link',
      caption:
`🤝 Share the Bay, Everyone Wins

Know someone who deserves a waterfront getaway? Send them our way and you both get rewarded.

✅ They get 10% off their first stay
✅ You get a credit toward your next booking
✅ Everyone ends up on the bay. Win win win.

Tag a friend who needs this trip or DM us for the referral link.

📍 Serenity on the Bay, Freeport FL`,
    },
    {
      day: 28, platform: 'Facebook', content_type: 'Post', phase: 'Social Proof',
      title: 'FB — last call for spring rates',
      hook: 'Spring rates end soon. Summer pricing is coming.',
      cta: 'Book now at shoulder season rates',
      caption:
`Heads up, Emerald Coast lovers 🌊

Spring shoulder season rates at Serenity on the Bay are ending soon. Once May hits, summer pricing kicks in.

If you have been eyeing a bayfront getaway at a friendlier price point, now is the time.

📍 Freeport, FL
🏡 Bayfront home with private dock
☀️ Available on Airbnb and VRBO

Book now while spring rates are still live.`,
    },
    {
      day: 30, platform: 'Instagram', content_type: 'Reel', phase: 'Social Proof',
      title: 'Thank you + what is next — summer preview',
      hook: 'Thank you for following along. Here is what is coming.',
      cta: 'Stay tuned and follow for summer content',
      caption:
`💧 Thank you and here is what is next

Serenity on the Bay is officially live on Airbnb AND VRBO. The spring push is in the books and we are so grateful for every booking, every follow, and every share.

What is coming this summer:
🌊 Fishing guide partnerships
🎣 Dock day content series
📸 Guest photo features
🏖️ Local guide: best beaches within 20 minutes

Follow along. The best is just getting started.

📍 Serenity on the Bay, Freeport FL`,
    },
  ],
};

// ─── PRIME IV — APRIL 2026 CORPORATE CASCADE ─────────────────────────
// Mirrors the actual April 2026 tab from "Social Content Calendar.xlsx"
// (corporate schedule). "Yes" in the cascading column = corporate posts
// across all locations (we see it, we don't overlap). "No" = local reel
// the location posts on its own page with the linked MP4 + audio.
//
// Load with startDate=2026-04-01 to place posts on their actual spring
// dates. Captions are verbatim from the corporate sheet so Niceville's
// page matches what Prime IV corporate is pushing.
export const PRIME_IV_CORP_APR_2026: Playbook = {
  id: 'prime-iv-corp-apr-2026',
  name: 'Prime IV — April 2026 Corporate Cascade',
  description:
    'Actual April 2026 corporate content schedule from Prime IV\'s Social Content Calendar. Spring Momentum + Stress Support theme. Load this into Niceville\'s calendar so MNA can see what corporate is posting and plan complementary local content around it. Includes 2 local reels (non-cascading) the location is expected to post from its own page.',
  items: [
    // Wk 4/1
    { day: 1, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'National Stress Awareness Month',
      hook: 'Stress Awareness Month reminder — check in with yourself.',
      cta: 'Book a wellness appointment',
      caption: `Stress doesn't just affect your mood. It can show up as low energy, tension, poor sleep, brain fog, irritability, and feeling like your body is constantly trying to catch up. 😮‍💨 During Stress Awareness Month, it's a good reminder to check in with yourself and build in support where you can — more rest, better boundaries, movement, hydration, and wellness routines that help you feel more balanced. Prime IV is here to support the days when life feels like a lot. 💙 #PrimeIV #StressAwarenessMonth #IVTherapy #WellnessSupport #HealthyHabits #FeelYourBest #GetPrimed` },

    // Wk 4/5 (3 cascading posts spread across the week)
    { day: 6, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Zinc / Seasonal Immune Support',
      hook: 'Spring can be beautiful and brutal all at once.',
      cta: 'Book immunity-focused IV',
      caption: `Spring can be beautiful and brutal all at once. 🌷🤧 Seasonal changes, allergies, busy schedules, and more time on the go can all put extra stress on the body. Zinc is an important nutrient for immune support, healing, and overall resilience, which is one reason it is especially relevant this time of year. 🛡️ When your schedule fills up, staying well becomes part of the plan. #PrimeIV #IVTherapy #ZincSupport #ImmuneHealth #SpringWellness #SeasonalSupport #GetPrimed` },
    { day: 8, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Testimonial Highlight',
      hook: 'No one-size-fits-all — personalized wellness.',
      cta: 'Share your story',
      caption: `One of the most rewarding parts of what we do is hearing from people who feel more energized, more refreshed, more confident, and more supported in their wellness journey. 🙌 There is no one-size-fits-all path to feeling your best, which is why personalized wellness support can make such a meaningful difference. Your goals are your own and we're here to help support them. 🫶 #PrimeIV #IVTherapy #TestimonialHighlight #PersonalizedWellness #WellnessJourney #FeelYourBest #GetPrimed` },
    { day: 10, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'NAD+ Highlight',
      hook: 'Energy off, focus dragging — go deeper with NAD+.',
      cta: 'Ask about NAD+',
      caption: `When your energy feels off, your focus is dragging, and you just do not feel like yourself, it may be time to support your body on a deeper level. 🧬 NAD+ therapy is a popular option for those looking to support cellular energy, mental clarity, recovery, and healthy aging. 🧠✨ Because feeling your best is not just about getting through the day — it's about having the energy to fully live it. #PrimeIV #NADTherapy #HealthyAging #MentalClarity #EnergySupport #WellnessJourney #GetPrimed` },

    // Non-cascading local Reel #1
    { day: 11, platform: 'Instagram', content_type: 'Reel', phase: 'Local Reel · post from our page',
      title: '[LOCAL REEL] Which IV would you choose?',
      hook: 'Different goals, different IVs.',
      cta: 'Comment your pick',
      caption: `Different goals call for different kinds of support. Whether you're focused on energy, immunity, glow, recovery, or feeling your best on the go, Prime IV offers personalized IV therapy options designed to meet you where you are. Which one would you choose? #PrimeIV #IVTherapy #WellnessSupport #EnergySupport #RecoverySupport #ImmuneSupport #GlowFromWithin #GetPrimed\n\nAsset: AprilReel-1-PrimeIV.mp4 · Audio: https://www.instagram.com/reels/audio/1440082083677247` },

    // Wk 4/12
    { day: 13, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Prep for Summer',
      hook: 'Feel healthy, energized, confident heading into summer.',
      cta: 'Start building momentum',
      caption: `This time of year, many people start thinking ahead to summer vacations, warmer weather, and spending more time outside. 🌞 Not because you need to change who you are, but because feeling healthy, confident, energized, and comfortable in your own skin feels good. 💁‍♀️ Building healthy momentum now can help you head into summer feeling stronger, brighter, and more like yourself. ✨ #PrimeIV #IVTherapy #SummerPrep #FeelYourBest #HealthyMomentum #ConfidenceStartsWithin #GetPrimed` },
    { day: 15, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Amino Acid Blend Highlight',
      hook: 'Workouts pick up — recovery is part of feeling your best.',
      cta: 'Book recovery IV',
      caption: `As your workouts, walks, and weekend plans pick back up, recovery becomes part of feeling your best. 🧘‍♀️ Amino acids help support muscle recovery, tissue repair, energy, and lean muscle maintenance, making them a great fit for spring routines and active lifestyles. 💪 Looking and feeling stronger usually starts with taking better care of your body behind the scenes. #PrimeIV #AminoAcids #IVTherapy #RecoverySupport #WellnessRoutine #SpringFitness #FeelYourBest #GetPrimed` },
    { day: 17, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Healthier Habits, Real Life',
      hook: 'Wellness does not have to be perfect.',
      cta: 'Take the next step',
      caption: `Wellness does not have to mean doing everything perfectly. It can look like getting outside more, making better food choices, prioritizing sleep, managing stress, staying consistent with movement, and giving your body extra support when needed. 🛌 Real life is busy. Healthy habits still matter. Prime IV is here to support the goals you are working toward, one step at a time. 🧡 #PrimeIV #HealthyHabits #WellnessJourney #FeelYourBest #EverydayWellness #GetPrimed #IVTherapy` },

    // Wk 4/19
    { day: 20, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Magnesium / Stress + Recovery',
      hook: 'Tense? Overstimulated? Magnesium matters.',
      cta: 'Ask about Magnesium adds',
      caption: `If you've been feeling tense, overstimulated, or like your body cannot fully unwind, you're not alone. Magnesium is a key nutrient involved in relaxation, nerve function, and recovery, which is why it is often top of mind during stressful seasons. 🌙🫧 Supporting your body is not a luxury — it's part of functioning well in everyday life. #PrimeIV #IVTherapy #MagnesiumSupport #StressSupport #RecoverySupport #WellnessRoutine #GetPrimed` },

    // Non-cascading local Reel #2
    { day: 22, platform: 'Instagram', content_type: 'Reel', phase: 'Local Reel · post from our page',
      title: '[LOCAL REEL] POV: you finally booked the wellness appointment',
      hook: 'Finally taking the time to support yourself.',
      cta: 'Book your first IV',
      caption: `Sometimes the best feeling is finally taking the time to support yourself. Whether you've been feeling run down, depleted, off your routine, or just in need of a reset, wellness support can go a long way. Prime IV is here to help you recharge, recover, and feel more like yourself again. #PrimeIV #IVTherapy #WellnessReset #RecoverySupport #HydrationSupport #FeelYourBest #GetPrimed\n\nAsset: AprilReel-2-PrimeIV.mp4 · Audio: https://www.instagram.com/reels/audio/2384967038669966` },

    { day: 23, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Feel Good in Your Skin',
      hook: 'More sunshine, more plans, more reasons to feel refreshed.',
      cta: 'Start your glow plan',
      caption: `There's something motivating about this season. More sunshine, more plans, more reasons to want to feel refreshed, energized, and confident. 💫 Whether your goals are better recovery, more glow, stronger immunity, healthier habits, or simply feeling better in your own skin, this is a great time to start. Small steps now can help you feel your best heading into summer. 🔄 #PrimeIV #IVTherapy #FeelYourBest #SummerWellness #GlowFromWithin #HealthyMomentum #GetPrimed` },
    { day: 24, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'B-Complex & B-5 Highlight',
      hook: 'Nonstop life? Your body feels it.',
      cta: 'Ask about B-Complex',
      caption: `When life feels nonstop, your body feels it too. B-Complex helps support energy, mood, and stress resilience, while Vitamin B-5 supports energy metabolism and stress hormone balance. 🌿 Together, they're a smart pairing for busy days when you want to feel more balanced, more energized, and better equipped to handle what's on your plate. #PrimeIV #IVTherapy #BComplex #VitaminB5 #EnergySupport #StressSupport #WellnessSupport #FeelYourBest #GetPrimed` },

    // Wk 4/26
    { day: 27, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Memberships Feature',
      hook: 'Feeling your best is about consistency.',
      cta: 'Explore memberships',
      caption: `Feeling your best is not about one healthy choice — it's about consistency. 🗓️ That's why so many people find that having a wellness routine makes all the difference. Prime IV memberships are designed to help you stay committed to your goals, whether you're focused on energy, recovery, immunity, beauty, or overall well-being. 💧 Because when wellness becomes part of your lifestyle, it is easier to keep showing up for yourself. 🩵 #PrimeIV #IVTherapy #PrimeIVMembership #WellnessRoutine #HealthyHabits #FeelYourBest` },
    { day: 29, platform: 'Instagram', content_type: 'Post', phase: 'Corporate Cascade',
      title: 'Zinc & Amino Acid Blend Highlight',
      hook: 'Two featured nutrients of the month.',
      cta: 'Add Zinc + Amino Acids',
      caption: `Looking and feeling your best starts with supporting your body well. Zinc helps support immune health, healing, and overall resilience, while Amino Acid Blend supports recovery, energy, lean muscle maintenance, and collagen synthesis for healthy skin. 🛡️🏋️‍♀️ It's a powerful combination for staying consistent with your wellness goals and feeling stronger, brighter, and more supported from the inside out. 🌟 #PrimeIV #IVTherapy #ZincSupport #AminoAcids #FeelYourBest #WellnessSupport #GlowFromWithin #HealthyMomentum #GetPrimed` },
  ],
};

// Keep the pamphlet-derived membership playbook too — MNA can layer it in
// between corporate cascades for stronger membership framing.
export const PRIME_IV_MEMBERSHIPS: Playbook = {
  id: 'prime-iv-memberships',
  name: 'Prime IV — Membership Push (Pamphlet)',
  description:
    '30-day plan walking the audience through all 4 membership tiers (SELECT $110, ESSENTIALS $189, TRANSFORMATION $359, ENLIGHTENMENT $649). Captions pulled from the corporate pamphlet so MNA posts align with what the brand is actually saying.',
  items: [
    // ── Phase 1 — The Hook (Days 1-3) ────────────────────────────
    { day: 1, platform: 'Instagram', content_type: 'Reel',      phase: 'Hook',
      title: 'Say hello to ROUTINE WELLNESS', hook: 'Wellness isn\'t a quick fix. It\'s a routine.', cta: 'Tap to see our memberships',
      caption: `Say hello to ROUTINE WELLNESS.\n\nWe built Prime IV memberships because showing up for yourself should feel easy, not expensive. Four tiers. One goal: a body that works as hard as you do.\n\nWhich one fits your life?\n→ SELECT · $110  (the starter)\n→ ESSENTIALS · $189  (the regular)\n→ TRANSFORMATION · $359  (the committed)\n→ ENLIGHTENMENT · $649  (the all-in)\n\nMember perks include exclusive savings, flexible priority scheduling, VIP lounge access, and massage chairs.\n\nLink in bio to join.` },
    { day: 2, platform: 'TikTok',    content_type: 'Reel',      phase: 'Hook',
      title: 'What a Prime IV membership actually gets you', hook: 'Everyone asks if memberships are worth it. Here\'s the real math.', cta: 'Save for later',
      caption: `People ask if memberships are worth it. The math tells on itself.\n\nOur lowest tier (SELECT $110) is a $194 value.\nOur top tier (ENLIGHTENMENT $649) is a $1,055 value.\n\nEvery tier includes:\n✓ VIP status + massage chair access\n✓ 50% off additional IV drip additives\n✓ Oxygen treatment\n\nYou\'re not paying for a service. You\'re paying for a system.` },
    { day: 3, platform: 'Instagram', content_type: 'Story',     phase: 'Hook',
      title: 'Poll — What\'s stopping you from starting a wellness routine?', hook: 'Tell us what\'s in the way. We\'ll help.', cta: 'Answer the poll',
      caption: `Quick poll — what\'s really keeping you from a wellness routine?\n\n🔘 Time  🔘 Money  🔘 Don\'t know where to start  🔘 All of the above\n\nWhatever the answer, we built memberships for you.` },

    // ── Phase 2 — SELECT ($110) — days 4-7 ───────────────────────
    { day: 4, platform: 'Instagram', content_type: 'Carousel',  phase: 'SELECT',
      title: 'Meet SELECT — $110/mo', hook: 'The easiest way to make IV therapy a habit.', cta: 'Join SELECT',
      caption: `Meet SELECT · $110/month · $194 value.\n\nDesigned for those who value consistency — a regular hydration + vitamin boost without the commitment of a bigger plan.\n\nHere\'s what\'s included:\n💧 1 Primary IV Drip of your choice\n💉 1 B-12 or Lipolean Injection\n👑 VIP Status + Massage Chair Access\n➕ 50% OFF Additional IV Drip Additives\n🌬️ Oxygen Treatment\n\nIdeal for maintaining vitality with minimal commitment. Perfect starter tier.\n\nLink in bio to sign up.` },
    { day: 5, platform: 'TikTok',    content_type: 'Reel',      phase: 'SELECT',
      title: 'What $110 actually gets you at Prime IV', hook: 'POV: $110 that actually pays for itself.', cta: 'Comment MEMBER for the link',
      caption: `Breaking down SELECT — the $110 starter membership.\n\nOne IV drip ($129 value on its own). One injection. VIP chair. Oxygen. Half off any additive upgrade you want.\n\nIf you even ADD one thing, you\'ve already made the math work.` },
    { day: 6, platform: 'Instagram', content_type: 'Post',      phase: 'SELECT',
      title: 'Testimonial — SELECT member story', hook: '"I just wanted energy back. I got a whole routine."', cta: 'Read the full story',
      caption: `"I joined SELECT because I thought I just needed a B-12 shot. 3 months in, it\'s the one appointment I don\'t cancel."  — real member\n\nSometimes routine wellness is the whole point. Start where you are.` },
    { day: 7, platform: 'Instagram', content_type: 'Reel',      phase: 'SELECT',
      title: 'A day with SELECT', hook: 'Here\'s what one visit looks like.', cta: 'Book your first session',
      caption: `A day with SELECT. Walk in. VIP chair. IV drip + injection. Oxygen if you want it. Out in under an hour feeling like a whole new person.\n\n$110/mo. You\'re welcome.` },

    // ── Phase 3 — ESSENTIALS ($189) — days 8-13 ──────────────────
    { day: 8, platform: 'Instagram', content_type: 'Carousel',  phase: 'ESSENTIALS',
      title: 'ESSENTIALS — the sweet spot of wellness', hook: 'The membership most people settle into.', cta: 'Swipe to see what\'s inside',
      caption: `Meet ESSENTIALS · $189/month · $320 value.\n\nFor those who want a more comprehensive wellness support with flexibility built in.\n\nWhat\'s inside:\n💧 ANY 1 IV Drip of your choice\n💉 2 B-12 or Lipolean Injections\n👑 VIP Status + Massage Chair Access\n🏷️ 15% OFF any Additional IV Drips & Injections\n➕ 50% OFF Additional IV Drip Additives\n🌬️ Oxygen Treatment\n\nThis is the plan for people who benefit from a holistic approach to hydration + vitamin therapy.` },
    { day: 9, platform: 'TikTok',    content_type: 'Reel',      phase: 'ESSENTIALS',
      title: 'SELECT vs ESSENTIALS — which one', hook: 'Which is right for you? Quick breakdown.', cta: 'Comment your tier',
      caption: `SELECT or ESSENTIALS?\n\nSELECT: 1 drip + 1 injection. $110. Great if you\'re testing the waters.\nESSENTIALS: 1 drip + 2 injections + 15% off add-ons. $189. Great if you already know you want more than one shot a month.\n\nThe upgrade is $79 for 1 extra injection + a permanent 15% discount on everything else. Math works if you add even once.` },
    { day: 10, platform: 'Instagram', content_type: 'Reel',     phase: 'ESSENTIALS',
      title: 'The double-injection month', hook: 'Two injections hit different than one.', cta: 'Learn more',
      caption: `Two B-12 injections a month is a mood.\n\nOne mid-week pick-me-up. One weekend reset. The energy loop writes itself.\n\nESSENTIALS · $189 · two injections included.` },
    { day: 11, platform: 'Instagram', content_type: 'Story',    phase: 'ESSENTIALS',
      title: 'Poll — add Lipolean or stick with B-12?', hook: 'Your call — which one are you picking this month?', cta: 'Vote + DM for details',
      caption: `Lipolean or B-12? The eternal injection question.\n\nBoth included in ESSENTIALS. Mix and match each month.` },
    { day: 12, platform: 'Instagram', content_type: 'Carousel', phase: 'ESSENTIALS',
      title: 'How to maximize your ESSENTIALS membership', hook: '5 ways to stretch a $320-value membership.', cta: 'Save the post',
      caption: `Getting the most out of your ESSENTIALS membership:\n\n1. Use both injections — no rolling unused shots forever.\n2. Time the IV for the week you feel run-down.\n3. Bring a friend on VIP guest days.\n4. Stack the 15% discount on a higher-tier drip once a quarter.\n5. The 50% additive discount? Actually use it.\n\n$189 in. $320+ out. Every month.` },
    { day: 13, platform: 'TikTok',    content_type: 'Reel',     phase: 'ESSENTIALS',
      title: 'Before/after — 30 days on ESSENTIALS', hook: 'What changed after one month.', cta: 'Book your consult',
      caption: `30 days on ESSENTIALS looks like:\n\n↑ Energy\n↑ Hydration\n↓ Afternoon crashes\n↓ Getting sick from every office cold\n\nIt\'s not magic. It\'s routine.` },

    // ── Phase 4 — TRANSFORMATION ($359) — days 14-21 ─────────────
    { day: 14, platform: 'Instagram', content_type: 'Carousel', phase: 'TRANSFORMATION',
      title: 'TRANSFORMATION — the committed wellness plan', hook: 'When you\'re ready to stop dabbling.', cta: 'See what\'s inside',
      caption: `TRANSFORMATION · $359/month · $605 value.\n\nTailored for those committed to a real wellness journey. This membership maximizes your health potential with multiple IV drips and a wider selection of injections.\n\nWhat\'s inside:\n💧 ANY 2 IV Drips of your choice\n💉 3 Injections of your choice\n👑 VIP Status + Massage Chair Access\n🏷️ 20% OFF any Additional IV Drips & Injections\n➕ 50% OFF Additional IV Drip Additives\n🌬️ Oxygen Treatment\n\nIdeal for looking to significantly enhance your physical health and wellness outcomes.` },
    { day: 15, platform: 'TikTok',    content_type: 'Reel',     phase: 'TRANSFORMATION',
      title: '2 drips a month = different body', hook: 'What happens when you get two full IVs every month.', cta: 'Comment for details',
      caption: `Two IV drips a month. Three injections. 20% off anything extra.\n\nTRANSFORMATION is for the people who don\'t just want to feel better — they want to be different.\n\n$359 · $605 value. The math is good. The results are better.` },
    { day: 16, platform: 'Instagram', content_type: 'Reel',     phase: 'TRANSFORMATION',
      title: 'The TRANSFORMATION stack', hook: 'Here\'s how a committed member actually uses it.', cta: 'DM us your goals',
      caption: `How a TRANSFORMATION member actually uses it:\n\nWeek 1: Myers Cocktail drip + B-12\nWeek 2: Vitamin C / Immune drip + Lipolean\nWeek 3: Hydration + B-12\nWeek 4: Recovery drip + Vitamin D injection\n\nTwo drips + three injections. Every month. Your body notices.` },
    { day: 17, platform: 'Instagram', content_type: 'Post',     phase: 'TRANSFORMATION',
      title: 'Member spotlight — TRANSFORMATION', hook: '"It changed how my body feels on a Tuesday."', cta: 'Read the full story',
      caption: `"I don\'t just feel ok anymore. I feel capable." — TRANSFORMATION member, 6 months in.\n\n$359/month that pays dividends in the parts of life that don\'t show up on an invoice.` },
    { day: 18, platform: 'Instagram', content_type: 'Carousel', phase: 'TRANSFORMATION',
      title: 'ESSENTIALS vs TRANSFORMATION — when to upgrade', hook: 'The moment you know you\'re ready.', cta: 'Swipe to decide',
      caption: `Upgrade time?\n\nESSENTIALS makes sense when: You want consistency + one solid monthly reset.\nTRANSFORMATION makes sense when: You\'re already going twice a month. You\'re adding injections. You want a second drip to actually stack effects.\n\nDoing the math: ESSENTIALS → TRANSFORMATION is +$170/mo but you gain a full second IV drip ($129+ value) + 2 more injections. Pays for itself in use.` },
    { day: 19, platform: 'TikTok',    content_type: 'Reel',     phase: 'TRANSFORMATION',
      title: 'What 3 injections a month can do', hook: 'Three shots, three purposes, one body.', cta: 'Save this',
      caption: `Three injections a month. One strategy.\n\nB-12 for energy. Lipolean for metabolism. Vitamin D for immunity.\n\nThat\'s TRANSFORMATION. $359/mo. Covered.` },
    { day: 20, platform: 'Instagram', content_type: 'Story',    phase: 'TRANSFORMATION',
      title: 'Poll — Which drip combo are you picking this month?', hook: 'Two drips. Infinite combos.', cta: 'Vote now',
      caption: `If you had TRANSFORMATION this month, which two drips are you picking?\n\n🔘 Myers + Immune  🔘 Recovery + NAD+  🔘 Beauty + Hydration  🔘 Other\n\n(members, answer in the comments)` },
    { day: 21, platform: 'Instagram', content_type: 'Reel',     phase: 'TRANSFORMATION',
      title: 'A month in the life of a TRANSFORMATION member', hook: 'Four visits. One transformation.', cta: 'Book your first one',
      caption: `Four visits a month. Two IVs. Three injections. Oxygen every time. VIP chair every time.\n\nThis is what "committed to wellness" actually looks like.\n\nTRANSFORMATION · $359 · link in bio.` },

    // ── Phase 5 — ENLIGHTENMENT ($649) — days 22-28 ──────────────
    { day: 22, platform: 'Instagram', content_type: 'Carousel', phase: 'ENLIGHTENMENT',
      title: 'ENLIGHTENMENT — the flagship', hook: 'This is the one people share with their partner.', cta: 'Tap to see everything',
      caption: `ENLIGHTENMENT · $649/month · $1,055 value.\n\nDesigned for those who value ultimate flexibility and comprehensive wellness support. Perfect for individuals or households looking to maximize their wellness with a wider range of treatments.\n\nWhat\'s inside:\n💧 ANY 4 IV Drips of your choice\n💉 ANY 5 Injections (including Vitamin D)\n👑 VIP Status + Massage Chair Access\n🏷️ 25% OFF any Additional IV Drips & Injections\n➕ 50% OFF Additional IV Drip Additives\n👥 Shareable among 2 household members\n🌬️ Oxygen Treatment\n\n*Some exclusions may apply.` },
    { day: 23, platform: 'TikTok',    content_type: 'Reel',     phase: 'ENLIGHTENMENT',
      title: 'Share it with your spouse — the math', hook: 'Why couples get ENLIGHTENMENT and don\'t look back.', cta: 'DM for details',
      caption: `ENLIGHTENMENT is shareable — that\'s the unlock.\n\nSplit it with your spouse, roommate, or adult kid. 4 drips + 5 injections between two people = 2 drips + 2-3 shots each.\n\n$325/person/month for a service that runs $500+ retail. Math works.` },
    { day: 24, platform: 'Instagram', content_type: 'Reel',     phase: 'ENLIGHTENMENT',
      title: 'Vitamin D injection — why it\'s in the top tier', hook: 'Why ENLIGHTENMENT is the only tier with Vitamin D.', cta: 'Save for later',
      caption: `Vitamin D is the injection 90% of Americans need. And it\'s only in ENLIGHTENMENT.\n\nLow Vitamin D = low mood, weak immunity, weaker bones, brain fog. High Vitamin D = the opposite.\n\nOne reason ENLIGHTENMENT is the tier serious wellness people pick.` },
    { day: 25, platform: 'Instagram', content_type: 'Carousel', phase: 'ENLIGHTENMENT',
      title: 'What $1,055 of wellness costs on this plan', hook: 'The tier where math stops making sense (in your favor).', cta: 'Swipe to see',
      caption: `ENLIGHTENMENT at a glance:\n\n$649/month → $1,055+ in actual service value.\n\nThat\'s 4 IV drips @ $129+ each = $516+\nPlus 5 injections @ $35+ each = $175+\nPlus VIP access, oxygen, and 25% off anything you add.\n\nYou\'re paying $649 for what would cost $1,055+ à la carte. That gap is the membership\'s whole point.` },
    { day: 26, platform: 'Instagram', content_type: 'Post',     phase: 'ENLIGHTENMENT',
      title: 'Couples who wellness together', hook: '"We split a membership. It\'s our cheapest date night."', cta: 'Tag your person',
      caption: `"We used to spend $300 on dinner on date night. Now we spend our ENLIGHTENMENT visits together — two chairs, two IVs, glowing home.\n\nCheapest most-effective date night we\'ve ever had."\n\n— real ENLIGHTENMENT members` },
    { day: 27, platform: 'TikTok',    content_type: 'Reel',     phase: 'ENLIGHTENMENT',
      title: '5 injections a month is unhinged (in a good way)', hook: 'What 5 injections a month can actually do.', cta: 'Comment FIVE to learn more',
      caption: `Five injections. One body. One month.\n\nB-12 x2 (energy anchors)\nLipolean x1 (metabolism)\nVitamin D x1 (immune + mood)\nYour pick x1 (however you need it)\n\nThis is what ENLIGHTENMENT looks like in practice.` },
    { day: 28, platform: 'Instagram', content_type: 'Reel',     phase: 'ENLIGHTENMENT',
      title: 'Why ENLIGHTENMENT changes how you feel about wellness', hook: 'Not a treatment. A lifestyle.', cta: 'Join the waitlist',
      caption: `ENLIGHTENMENT members don\'t "go to Prime IV." They live here.\n\nFour visits a month. Shareable. 25% off everything else. Oxygen every time.\n\nIt stops being about the drips and starts being about how differently your body operates all month.` },

    // ── Phase 6 — Compare + Close (days 29-30) ───────────────────
    { day: 29, platform: 'Instagram', content_type: 'Carousel', phase: 'Close',
      title: 'All 4 tiers — side by side', hook: 'Which one are YOU?', cta: 'Swipe + tap your pick',
      caption: `All 4 tiers. One decision.\n\n🔹 SELECT · $110  — 1 drip, 1 injection, VIP, oxygen. Consistency for beginners.\n🔹 ESSENTIALS · $189  — 1 drip, 2 injections, +15% off. The sweet spot.\n🔹 TRANSFORMATION · $359  — 2 drips, 3 injections, +20% off. The committed.\n🔹 ENLIGHTENMENT · $649  — 4 drips, 5 injections (incl Vitamin D), +25% off, shareable. The all-in.\n\nEvery tier: VIP + 50% off additives + oxygen.\n\nLink in bio.` },
    { day: 30, platform: 'Instagram', content_type: 'Reel',     phase: 'Close',
      title: 'Last chance reminder to start a wellness routine', hook: 'Future you already said thank you.', cta: 'Link in bio',
      caption: `If you\'ve been reading these posts for 30 days and still haven\'t signed up — this is your sign.\n\n4 tiers. One starts at $110. The system works no matter where you start.\n\nFuture you already said thank you.` },
  ],
};

export const PLAYBOOKS: Playbook[] = [
  PRIME_IV_CORP_APR_2026,
  PINECREST_REOPENING,
  NICEVILLE_SPRING_RESET,
  SERENITY_VRBO_LAUNCH,
  PRIME_IV_MEMBERSHIPS,
];

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}

/**
 * Map client IDs to their available playbooks.
 * When a client has playbooks, they show in the Content Calendar Agent
 * as one-click load buttons.
 */
export const CLIENT_PLAYBOOKS: Record<string, string[]> = {
  // Corporate cascade first so it's the top one-click load each month
  'prime-iv':           ['prime-iv-corp-apr-2026', 'niceville-spring-reset', 'prime-iv-memberships'],
  'prime-iv-pinecrest': ['prime-iv-corp-apr-2026', 'pinecrest-reopening',    'prime-iv-memberships'],
  'serenity-bayfront':  ['serenity-vrbo-launch'],
};

export function getPlaybooksForClient(clientId: string): Playbook[] {
  const ids = CLIENT_PLAYBOOKS[clientId] || [];
  return ids.map((id) => PLAYBOOKS.find((p) => p.id === id)).filter(Boolean) as Playbook[];
}
