// Approximates the shape of what POST /api/chat (LangGraph + Groq) returns,
// so the UI stays usable in local dev before the backend is wired up.

const KNOWN_MATERIALS = ["OncoBoost Phase III PDF", "Product X brochure", "brochure", "leave-behind", "clinical study reprint"];
const KNOWN_SAMPLES = ["OncoBoost 10mg", "Product X sample pack", "starter pack"];

export function localAgentFallback(text, state) {
  const updates = {};
  const touched = [];
  const notes = [];
  const lower = text.toLowerCase();

  const nameMatch = text.match(/Dr\.?\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  if (nameMatch) {
    updates.hcpName = `Dr. ${nameMatch[1]}`;
    touched.push("hcpName");
    notes.push(`HCP set to Dr. ${nameMatch[1]}`);
  }

  if (/call|phone/.test(lower)) { updates.interactionType = "Call"; touched.push("interactionType"); }
  else if (/email/.test(lower)) { updates.interactionType = "Email"; touched.push("interactionType"); }
  else if (/conference|congress|event/.test(lower)) { updates.interactionType = "Conference"; touched.push("interactionType"); }
  else if (/met|meeting|visit/.test(lower)) { updates.interactionType = "Meeting"; touched.push("interactionType"); }

  if (/negative|unhappy|declined|concerned/.test(lower)) { updates.sentiment = "Negative"; touched.push("sentiment"); }
  else if (/positive|receptive|enthusiastic|great|efficacy/.test(lower)) { updates.sentiment = "Positive"; touched.push("sentiment"); }
  else if (/neutral|noncommittal/.test(lower)) { updates.sentiment = "Neutral"; touched.push("sentiment"); }

  const topicMatch = text.match(/discussed\s+([^,.]+)/i);
  if (topicMatch) {
    updates.topics = (state.topics ? state.topics + " " : "") + topicMatch[1].trim();
    touched.push("topics");
    notes.push(`Logged topic: ${topicMatch[1].trim()}`);
  }

  const newMaterials = [];
  KNOWN_MATERIALS.forEach((m) => {
    if (lower.includes(m.toLowerCase()) && !state.materialsShared.includes(m)) newMaterials.push(m);
  });
  if (newMaterials.length) {
    updates.materialsShared = [...state.materialsShared, ...newMaterials];
    touched.push("materialsShared");
    notes.push(`Added material(s): ${newMaterials.join(", ")}`);
  }

  const newSamples = [];
  KNOWN_SAMPLES.forEach((s) => {
    if (lower.includes(s.toLowerCase()) && !state.samplesDistributed.includes(s)) newSamples.push(s);
  });
  if (/sample/.test(lower) && newSamples.length) {
    updates.samplesDistributed = [...state.samplesDistributed, ...newSamples];
    touched.push("samplesDistributed");
    notes.push(`Recorded sample(s): ${newSamples.join(", ")}`);
  }

  const outcomeMatch = text.match(/(agreed to [^,.]+|will [^,.]+)/i);
  if (outcomeMatch) {
    updates.outcomes = (state.outcomes ? state.outcomes + " " : "") + outcomeMatch[0].trim();
    touched.push("outcomes");
    notes.push(`Outcome captured: ${outcomeMatch[0].trim()}`);
  }

  const suggestions = [];
  if (updates.sentiment === "Positive" || state.sentiment === "Positive") {
    suggestions.push("Schedule follow-up meeting in 2 weeks");
  }
  if (lower.includes("phase iii")) suggestions.push("Send OncoBoost Phase III PDF");
  if (/advisory|board/.test(lower) && nameMatch) {
    suggestions.push(`Add Dr. ${nameMatch[1]} to advisory board invite list`);
  }
  if (!suggestions.length) suggestions.push("Log a follow-up call in 1 week");

  const reply = notes.length
    ? "Updated the form — " + notes.join("; ") + "."
    : "I couldn't pull a clear field from that — try naming the HCP, what was discussed, and the sentiment.";

  return { form_diff: updates, touched, followups: suggestions.slice(0, 3), reply };
}
