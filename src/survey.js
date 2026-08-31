export const prototypeSections = [
  {
    id: "collecting",
    eyebrow: "Section 1 of 5",
    title: "Your collecting life—and what may come next",
    intro: "We begin with actual collecting behavior, then protect the commercially valuable next-purchase outlook from late-survey fatigue.",
    milestone: "The commercially juicy stuff is complete. Next, let’s look at how watches move from “What is that?” to “I might actually buy that.”",
    questions: [
      {
        id: "prototype_purchase_count",
        label: "Prototype question: About how many watches have you purchased in the past 12 months?",
        hint: "Representative interaction only; this is not the frozen questionnaire wording.",
        options: ["None", "1–2", "3–5", "6–10", "11 or more"]
      },
      {
        id: "prototype_next_purchase",
        label: "Prototype question: When do you currently expect to purchase your next watch?",
        hint: "This measures stated outlook, not a validated prediction.",
        options: ["Within one month", "Within 2–3 months", "Within 4–6 months", "Later", "Not currently planning one"]
      }
    ]
  },
  {
    id: "pathway",
    eyebrow: "Section 2 of 5",
    title: "From discovery to confidence",
    intro: "Creator value can appear throughout the buying journey—not only at first discovery or final purchase.",
    milestone: "You’re past the halfway point—and still running accurately. Next, we’re looking at your openness to smaller brands and unfamiliar watches.",
    questions: [
      {
        id: "prototype_creator_role",
        label: "Prototype question: Where has watch content been most useful to you?",
        options: ["Discovering a watch or brand", "Seeing how a watch wears", "Understanding specifications", "Validating a brand or seller", "Comparing options"]
      }
    ]
  },
  {
    id: "small_brands",
    eyebrow: "Section 3 of 5",
    title: "Openness to small and unfamiliar brands",
    intro: "This section will help distinguish enthusiasts who are ready to explore microbrands from those who prefer established names.",
    milestone: "Nicely done. The remaining questions describe the people behind WatchTok—not just who posts, but who watches, advises, connects and participates.",
    questions: [
      {
        id: "prototype_small_brand",
        label: "Prototype question: How often do microbrands or smaller independents enter your consideration set?",
        options: ["Almost never", "Occasionally", "About half the time", "Most of the time", "Almost always"]
      }
    ]
  },
  {
    id: "community",
    eyebrow: "Section 4 of 5",
    title: "Your place in the WatchTok community",
    intro: "A few final-production questions will ask creators to estimate activity. A best reasonable estimate will be perfectly fine—no one needs to audit an entire posting history.",
    milestone: "Final stretch. One last prototype interaction, then you’ll see the intended completion experience.",
    questions: [
      {
        id: "prototype_role",
        label: "Prototype question: Which description best reflects your WatchTok participation?",
        options: ["Mostly watch videos", "Watch and interact", "Share and discuss privately", "Advise or connect enthusiasts", "Regularly create watch content"]
      }
    ]
  },
  {
    id: "independence",
    eyebrow: "Section 5 of 5",
    title: "Research independence",
    intro: "Brand employees may eventually participate as individual enthusiasts, while industry affiliation remains identifiable for sensitivity analysis.",
    questions: [
      {
        id: "prototype_independence",
        label: "Prototype confirmation: Is the survey’s creator-led, brand-independent framing clear?",
        options: ["Yes", "Mostly", "Not yet"]
      }
    ]
  }
];

export function normalizeReferral(rawValue, allowList = []) {
  if (!rawValue) return "direct";
  const normalized = rawValue.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  if (!normalized) return "direct";
  if (allowList.length && !allowList.includes(normalized)) return "unrecognized";
  return normalized;
}

export function progressPercent(screen, sectionCount = prototypeSections.length) {
  if (screen === "welcome") return 0;
  if (screen === "complete") return 100;
  const index = Number(screen);
  return Math.max(0, Math.min(100, Math.round(((index + 1) / sectionCount) * 100)));
}

