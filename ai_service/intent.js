import {
  EMERGENCY_WARNING,
  LANGUAGE_ALIASES,
  SPECIALTY_ALIASES,
  TEST_ALIASES,
} from "./constants.js";

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}₹.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalizeText(phrase);
  return ` ${text} `.includes(` ${normalizedPhrase} `);
}

function findAlias(text, groups) {
  for (const group of groups) {
    if (group.aliases.some((alias) => hasPhrase(text, alias))) return group.name;
  }
  return null;
}

function findAliases(text, groups) {
  return groups
    .filter((group) => group.aliases.some((alias) => hasPhrase(text, alias)))
    .map((group) => group.name);
}

function numberFrom(value) {
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBudget(query) {
  const source = String(query ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .replace(/,/g, "");
  const currency = /(?:₹|\brs\.?|\binr\b|\brupees?\b)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i.exec(source);
  if (currency) return numberFrom(currency[1]);

  const patterns = [
    /(?:under|below|max(?:imum)?|up\s*to|upto|within|budget(?:\s+is|\s+of)?|andar|अंदर|तक)\s*(?:₹|rs\.?|inr|rupees?)?\s*(\d+(?:\.\d+)?)/gi,
    /(\d+(?:\.\d+)?)\s*(?:rupees?|रुपये)?\s*(?:ke\s+)?(?:andar|se\s+kam|अंदर|से\s+कम|तक)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const afterMatch = source.slice((match.index ?? 0) + match[0].length).trimStart();
      if (/^(?:km|kms|kilomet(?:er|re)s?)\b/i.test(afterMatch)) continue;
      return numberFrom(match[1]);
    }
  }
  return null;
}

function parseDistance(query) {
  const source = String(query ?? "").normalize("NFKC").toLocaleLowerCase("en-IN").replace(/,/g, "");
  const match = /(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?)\b/i.exec(source);
  return match ? numberFrom(match[1]) : null;
}

function parseGender(text) {
  if (/\b(?:female|woman|women|lady|ladies|mahila)\b/u.test(text) || /(?:महिला|औरत)/u.test(text)) {
    return "Female";
  }
  if (/\b(?:male|man|men|gents|purush)\b/u.test(text) || /(?:पुरुष|आदमी)/u.test(text)) {
    return "Male";
  }
  return null;
}

function phrasePosition(text, expressions) {
  const positions = expressions.map((expression) => text.search(expression)).filter((position) => position >= 0);
  return positions.length ? Math.min(...positions) : -1;
}

export function detectEmergency(query) {
  const text = normalizeText(query);
  const signals = [
    {
      code: "chest_pain",
      label: "severe chest pain",
      pattern: /\b(?:severe\s+)?chest\s+pain\b|\bseene?\s+(?:me|mein)\s+dard\b|सीने\s+में\s+दर्द/u,
    },
    {
      code: "breathing_difficulty",
      label: "breathing difficulty",
      pattern:
        /\b(?:difficulty|problem|trouble)\s+(?:in\s+)?breathing\b|\bshortness\s+of\s+breath\b|\bcant\s+breathe\b|\bsaans\s+(?:nahi|lene\s+me|lene\s+mein)\b|सांस\s+(?:लेने\s+में|नहीं)/u,
    },
    {
      code: "fainting",
      label: "fainting or unconsciousness",
      pattern: /\bfaint(?:ed|ing)?\b|\bunconscious\b|\bpassed\s+out\b|\bbehosh\b|बेहोश/u,
    },
    {
      code: "stroke_signs",
      label: "possible stroke signs",
      pattern: /\bstroke\b|\bface\s+droop(?:ing)?\b|\bsudden\s+(?:one sided\s+)?weakness\b|\bslurred\s+speech\b/u,
    },
    {
      code: "uncontrolled_bleeding",
      label: "uncontrolled bleeding",
      pattern: /\b(?:heavy|severe|uncontrolled|wont\s+stop)\s+bleeding\b|\bkhoon\s+(?:nahi\s+ruk|bahut\s+beh)\b|खून\s+नहीं\s+रुक/u,
    },
    {
      code: "seizure",
      label: "seizure",
      pattern: /\bseizure\b|\bconvulsion\b|\bfit\s+aa\s+raha\b|दौरा/u,
    },
    {
      code: "self_harm",
      label: "immediate self-harm risk",
      pattern: /\b(?:suicidal|suicide|kill\s+myself|harm\s+myself|self\s+harm)\b/u,
    },
  ].filter((signal) => signal.pattern.test(text));

  return {
    isEmergency: signals.length > 0,
    matchedSignals: signals.map(({ code, label }) => ({ code, label })),
    warning: signals.length ? EMERGENCY_WARNING : null,
  };
}

export function isEmergencyQuery(query) {
  return detectEmergency(query).isEmergency;
}

export function parseIntent(query) {
  const originalQuery = typeof query === "string" ? query.trim() : String(query ?? "").trim();
  const text = normalizeText(originalQuery);
  const specialty = findAlias(text, SPECIALTY_ALIASES);
  const test = findAlias(text, TEST_ALIASES);
  const languages = findAliases(text, LANGUAGE_ALIASES);
  const gender = parseGender(text);
  const budget = parseBudget(originalQuery);
  const maxDistanceKm = parseDistance(originalQuery);
  const safety = detectEmergency(originalQuery);

  const explicitLab =
    /\b(?:lab|labs|pathlab|pathology|diagnostic|diagnostics|test|tests|package|report)\b/u.test(text) ||
    /(?:जांच|लैब|पैथोलॉजी)/u.test(text);
  const explicitDoctor =
    /\b(?:doctor|doctors|dr|specialist|physician|consultation|consult)\b/u.test(text) ||
    /(?:डॉक्टर|चिकित्सक)/u.test(text);

  let type = "general";
  if (explicitLab) type = "lab";
  else if (explicitDoctor || specialty || gender || languages.length) type = "doctor";
  else if (test) type = "lab";

  const cheapestExpressions = [
    /\bcheapest\b/u,
    /\bcheap\b/u,
    /\blowest\s+(?:price|fee|cost)\b/u,
    /\blow\s+cost\b/u,
    /\bsast[ai]\b/u,
    /\bkam\s+(?:price|fees?|paise)\b/u,
    /सबसे\s+सस्त/u,
  ];
  const fastestExpressions = [
    /\bfastest\b/u,
    /\bfast\b/u,
    /\bquick(?:est|ly)?\b/u,
    /\bearliest\b/u,
    /\bsoonest\b/u,
    /\bjaldi\b/u,
    /जल्दी/u,
  ];
  const nearestExpressions = [
    /\bnearest\b/u,
    /\bnearby\b/u,
    /\bnear\s+me\b/u,
    /\bclose\s+by\b/u,
    /\bpaas\b/u,
    /\bpas\s+me\b/u,
    /पास/u,
  ];
  const cheapestAt = phrasePosition(text, cheapestExpressions);
  const fastestAt = phrasePosition(text, fastestExpressions);
  const nearestAt = phrasePosition(text, nearestExpressions);
  const cheapest = cheapestAt >= 0;
  const fastest = fastestAt >= 0;
  const nearest = nearestAt >= 0 || maxDistanceKm !== null;

  let homeCollection = null;
  if (
    /\b(?:no|without)\s+home\s+collection\b/u.test(text) ||
    /\bhome\s+collection\s+(?:nahi|not)\b/u.test(text)
  ) {
    homeCollection = false;
  } else if (
    /\bhome\s+(?:sample\s+)?collection\b/u.test(text) ||
    /\bcollect\s+(?:sample\s+)?(?:at|from)\s+home\b/u.test(text) ||
    /\bghar\s+(?:se|par|pe)\s+(?:sample|collection)\b/u.test(text) ||
    /घर\s+(?:से|पर)\s+(?:सैंपल|जांच)/u.test(text)
  ) {
    homeCollection = true;
    if (type === "general") type = "lab";
  }

  let availability = null;
  if (/\b(?:today|aaj)\b/u.test(text) || /आज/u.test(text)) availability = "today";
  else if (/\b(?:tomorrow|kal)\b/u.test(text) || /कल/u.test(text)) availability = "tomorrow";
  else if (
    /\b(?:available|availability|earliest|soonest|open\s+now|abhi)\b/u.test(text) ||
    (type === "doctor" && fastest)
  ) {
    availability = "earliest";
  }

  const priorityPositions = [
    cheapest ? { key: "price", position: cheapestAt } : null,
    fastest ? { key: type === "lab" ? "reportTime" : "availability", position: fastestAt } : null,
    nearest ? { key: "distance", position: nearestAt < 0 ? Number.MAX_SAFE_INTEGER : nearestAt } : null,
  ]
    .filter(Boolean)
    .sort((a, b) => a.position - b.position)
    .map(({ key }) => key);

  return {
    query: originalQuery,
    type,
    budget,
    maxDistanceKm,
    gender,
    specialty,
    test,
    cheapest,
    fastest,
    nearest,
    homeCollection,
    availability,
    language: languages[0] ?? null,
    languages,
    priorities: [...new Set(priorityPositions)],
    emergency: safety.isEmergency,
    emergencySignals: safety.matchedSignals,
  };
}

export function canonicalSpecialty(value) {
  return findAlias(normalizeText(value), SPECIALTY_ALIASES);
}

export function canonicalTest(value) {
  return findAlias(normalizeText(value), TEST_ALIASES);
}
