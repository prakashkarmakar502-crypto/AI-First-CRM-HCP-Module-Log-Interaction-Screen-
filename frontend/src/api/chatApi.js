import { localAgentFallback } from "./localAgentFallback";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/**
 * Sends the rep's message + current form state to the LangGraph/Groq agent
 * running behind FastAPI. Falls back to a local heuristic (see
 * localAgentFallback.js) if the backend isn't reachable, so `npm run dev`
 * works before the API key / MySQL instance are set up.
 *
 * Returns: { form_diff, touched, followups, reply }
 */
export async function sendChatMessage(message, currentForm) {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, current_form: currentForm }),
    });
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const data = await res.json();
    return {
      form_diff: data.form_diff,
      touched: Object.keys(data.form_diff || {}),
      followups: data.followups,
      reply: data.reply,
    };
  } catch (err) {
    console.warn("Falling back to local agent simulation:", err.message);
    return localAgentFallback(message, currentForm);
  }
}

export async function searchHcps(q) {
  const res = await fetch(`${API_BASE}/api/hcps?q=${encodeURIComponent(q)}`);
  return res.ok ? res.json() : [];
}

export async function searchMaterials(q) {
  const res = await fetch(`${API_BASE}/api/materials?q=${encodeURIComponent(q)}`);
  return res.ok ? res.json() : [];
}

export async function searchSamples(q) {
  const res = await fetch(`${API_BASE}/api/samples?q=${encodeURIComponent(q)}`);
  return res.ok ? res.json() : [];
}

export async function saveInteraction(payload) {
  const res = await fetch(`${API_BASE}/api/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return res.json();
}
