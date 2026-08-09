/**
 * Hard-coded escalation rules for the AI CRM layer. These run BEFORE and
 * AFTER the model: a match on the inbound message forces needs_human_review
 * regardless of what the model says, so a jailbroken or overconfident model
 * response can never auto-send on a sensitive topic.
 *
 * Location-specific keywords (ghl_locations.escalation_keywords, comma
 * separated) are merged in at check time.
 */

export type EscalationHit = {
  category: string;
  reason: string;
};

type Rule = { category: string; reason: string; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    category: 'medical',
    reason: 'Medical symptoms or individualized medical advice',
    patterns: [
      /\b(symptom|dizzy|dizziness|nausea|nauseous|vomit|fever|rash|swelling|swollen|infection|infected|chest pain|shortness of breath|faint(ed|ing)?|numb(ness)?|blood pressure|heart rate|palpitation)/i,
      /\b(should i (take|get|do)|is it safe (for me|to)|can i (take|mix|combine)).{0,60}\b(iv|vitamin|medication|drip|injection|shot|treatment)/i,
      /\b(diagnos|prescri|dosage|dose for)/i,
    ],
  },
  {
    category: 'adverse_reaction',
    reason: 'Possible adverse reaction to a treatment',
    patterns: [
      /\b(reaction|side effect|allergic|allergy|hives|bruis(e|ing)|infiltrat|after (my|the) (iv|drip|treatment|injection|appointment).{0,40}(hurt|pain|sick|weird|wrong|burn))/i,
      /\b(made me (sick|ill|dizzy)|feel(ing)? (sick|ill|worse|bad) (after|since))/i,
    ],
  },
  {
    category: 'emergency',
    reason: 'Possible emergency',
    patterns: [
      /\b(emergency|911|er\b|urgent care|hospital|ambulance|can'?t breathe|passing out|unconscious|overdose|suicid|self.?harm)/i,
    ],
  },
  {
    category: 'pregnancy',
    reason: 'Pregnancy-related question requiring clinical judgment',
    patterns: [
      /\b(pregnan|breastfeed|nursing|trimester|trying to conceive|ttc\b|fertility treatment)/i,
    ],
  },
  {
    category: 'medication',
    reason: 'Medication interaction question',
    patterns: [
      /\b(interact|contraindicat|mix(ing)? with|while (on|taking)).{0,40}\b(medication|medicine|meds|prescription|antibiotic|blood thinner)/i,
      /\b(i('m| am) (on|taking) (medication|meds|prescri))/i,
    ],
  },
  {
    category: 'legal',
    reason: 'Legal threat or lawsuit',
    patterns: [
      /\b(lawyer|attorney|lawsuit|sue|suing|legal action|small claims|court|liab(le|ility)|negligen)/i,
    ],
  },
  {
    category: 'privacy',
    reason: 'HIPAA or privacy complaint',
    patterns: [/\b(hipaa|privacy|medical records?|confidential|data breach|shared my (info|information))/i],
  },
  {
    category: 'billing_dispute',
    reason: 'Refund dispute or chargeback',
    patterns: [
      /\b(refund|charge ?back|dispute[sd]? (the|a|this)? ?charge|charged (me )?(twice|wrong|incorrectly)|money back|cancel (my )?(membership|subscription))/i,
      /\b(billing (issue|problem|error))/i,
    ],
  },
  {
    category: 'complaint',
    reason: 'Serious complaint',
    patterns: [
      /\b(worst|horrible|terrible|unacceptable|disgust(ed|ing)|never coming back|report(ing)? (you|this)|bbb\b|better business bureau|health department)/i,
    ],
  },
  {
    category: 'harassment',
    reason: 'Harassment or threats',
    patterns: [/\b(threat|harass|stalk|kill|hurt you|beat (you|your))/i],
  },
  {
    category: 'media',
    reason: 'Media inquiry',
    patterns: [/\b(journalist|reporter|press|news (story|article)|interview (for|with)|media inquiry)/i],
  },
  {
    category: 'employment',
    reason: 'Employment issue',
    patterns: [
      /\b(job|hiring|apply(ing)? (for|to)|resume|position open|employment|work (for|with) you|career)/i,
    ],
  },
];

/** Opt-out keywords — never respond, mark contact opted out. */
export function isOptOutMessage(text: string): boolean {
  return /^\s*(stop|stopall|unsubscribe|cancel|end|quit|opt ?out)\s*[.!]?\s*$/i.test(text || '');
}

/**
 * Check an inbound customer message against global rules + the location's
 * own escalation keywords. Returns the first hit, or null.
 */
export function checkEscalation(text: string, locationKeywords?: string | null): EscalationHit | null {
  const t = text || '';
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(t))) {
      return { category: rule.category, reason: rule.reason };
    }
  }
  if (locationKeywords) {
    const keywords = locationKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    for (const kw of keywords) {
      if (t.toLowerCase().includes(kw.toLowerCase())) {
        return { category: 'location_rule', reason: `Location escalation keyword: "${kw}"` };
      }
    }
  }
  return null;
}

/**
 * Review-specific screen: these topics force human approval regardless of
 * star rating (medical harm, privacy, legal, billing, discrimination,
 * serious complaints).
 */
export function checkReviewEscalation(text: string): EscalationHit | null {
  const t = text || '';
  const reviewRules: Rule[] = [
    { category: 'medical_harm', reason: 'Mentions medical harm or reaction', patterns: [/\b(reaction|side effect|injur|harm|infection|hospital|sick|unsafe|dangerous)/i] },
    { category: 'privacy', reason: 'Privacy issue', patterns: [/\b(hipaa|privacy|records?|confidential|personal info)/i] },
    { category: 'legal', reason: 'Legal issue', patterns: [/\b(lawyer|attorney|lawsuit|sue|legal|fraud|scam)/i] },
    { category: 'billing_dispute', reason: 'Billing dispute', patterns: [/\b(refund|charge|overcharg|billing|charged|money back|rip.?off)/i] },
    { category: 'discrimination', reason: 'Discrimination claim', patterns: [/\b(discriminat|racis|sexis|homophob|prejudic|profil(ed|ing))/i] },
    { category: 'complaint', reason: 'Serious complaint', patterns: [/\b(worst|horrible|unacceptable|disgusting|health department|report(ed|ing)?)/i] },
  ];
  for (const rule of reviewRules) {
    if (rule.patterns.some((p) => p.test(t))) {
      return { category: rule.category, reason: rule.reason };
    }
  }
  return null;
}
