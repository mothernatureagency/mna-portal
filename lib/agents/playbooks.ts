export type PlaybookItem = {
  day: number;          // days offset from launch date
  platform: string;
  content_type: string;
  title: string;
  hook: string;
  cta: string;
  phase: string;
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

export const PLAYBOOKS: Playbook[] = [PINECREST_REOPENING];

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}
