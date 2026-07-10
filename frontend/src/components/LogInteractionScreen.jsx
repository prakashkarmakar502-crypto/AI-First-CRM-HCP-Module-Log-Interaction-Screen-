import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Bot, Search, Plus, Mic, AlertTriangle, X, Calendar, Clock } from "lucide-react";
import {
  setField, addAttendee, removeAttendee,
  addMaterial, removeMaterial, addSample, removeSample,
  setSuggestions, useSuggestion, bulkUpdate, clearTouched,
} from "../store/interactionSlice";
import { sendChatMessage, saveInteraction } from "../api/chatApi";

const RADIO_OPTIONS = [
  { value: "Positive", emoji: "🙂" },
  { value: "Neutral", emoji: "😐" },
  { value: "Negative", emoji: "🙁" },
];

function Flash({ active, children }) {
  return (
    <div
      style={{
        transition: "background-color 900ms ease, box-shadow 900ms ease",
        backgroundColor: active ? "#EFF6FF" : "transparent",
        boxShadow: active ? "0 0 0 1px #BFDBFE inset" : "none",
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}

export default function LogInteractionScreen() {
  const state = useSelector((s) => s.interaction);
  const dispatch = useDispatch();

  const [messages, setMessages] = useState([
    { role: "assistant", text: 'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.' },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (state.lastTouched.length) {
      const t = setTimeout(() => dispatch(clearTouched()), 1000);
      return () => clearTimeout(t);
    }
  }, [state.lastTouched, dispatch]);

  const touched = (field) => state.lastTouched.includes(field);

  async function handleSend() {
    const text = chatInput.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setChatInput("");
    setIsThinking(true);

    const { form_diff, touched: touchedFields, followups, reply } = await sendChatMessage(text, state);
    dispatch(bulkUpdate({ diff: form_diff, touched: touchedFields }));
    if (followups?.length) dispatch(setSuggestions(followups));
    setMessages((m) => [...m, { role: "assistant", text: reply }]);
    setIsThinking(false);
  }

  async function handleLogAndSave() {
    try {
      await saveInteraction({
        hcp_name: state.hcpName,
        interaction_type: state.interactionType,
        date: state.date,
        time: state.time,
        attendees: state.attendees,
        topics: state.topics,
        materials_shared: state.materialsShared,
        samples_distributed: state.samplesDistributed,
        sentiment: state.sentiment,
        outcomes: state.outcomes,
        follow_up_actions: state.followUpActions,
        source: "chat",
        rep_user_id: 1, // replace with authenticated user id
        raw_chat_transcript: messages,
      });
      setMessages((m) => [...m, { role: "assistant", text: "Interaction saved." }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `Couldn't save: ${err.message}` }]);
    }
  }

  function addMaterialManually() {
    const v = window.prompt("Material name");
    if (v && v.trim()) dispatch(addMaterial(v.trim()));
  }
  function addSampleManually() {
    const v = window.prompt("Sample name");
    if (v && v.trim()) dispatch(addSample(v.trim()));
  }
  function addAttendeeManually(e) {
    if (e.key === "Enter" && e.target.value.trim()) {
      dispatch(addAttendee(e.target.value.trim()));
      e.target.value = "";
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#F7F8FA", minHeight: "100vh", padding: 24, color: "#1F2430" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px 4px" }}>Log HCP Interaction</h1>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        {/* LEFT: FORM */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Interaction Details</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <Field label="HCP Name">
              <Flash active={touched("hcpName")}>
                <TextInput
                  placeholder="Search or select HCP..."
                  value={state.hcpName}
                  onChange={(v) => dispatch(setField({ field: "hcpName", value: v }))}
                  icon={<Search size={14} color="#9CA3AF" />}
                />
              </Flash>
            </Field>
            <Field label="Interaction Type">
              <Flash active={touched("interactionType")}>
                <select
                  value={state.interactionType}
                  onChange={(e) => dispatch(setField({ field: "interactionType", value: e.target.value }))}
                  style={selectStyle}
                >
                  {["Meeting", "Call", "Email", "Conference"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Flash>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <Field label="Date">
              <TextInput type="date" value={state.date} onChange={(v) => dispatch(setField({ field: "date", value: v }))} icon={<Calendar size={14} color="#9CA3AF" />} />
            </Field>
            <Field label="Time">
              <TextInput type="time" value={state.time} onChange={(v) => dispatch(setField({ field: "time", value: v }))} icon={<Clock size={14} color="#9CA3AF" />} />
            </Field>
          </div>

          <Field label="Attendees">
            <Flash active={touched("attendees")}>
              <div style={{ ...inputBase, minHeight: 40, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {state.attendees.map((a) => (
                  <Chip key={a} onRemove={() => dispatch(removeAttendee(a))}>{a}</Chip>
                ))}
                <input
                  placeholder={state.attendees.length ? "" : "Enter names or search..."}
                  onKeyDown={addAttendeeManually}
                  style={{ border: "none", outline: "none", flex: 1, minWidth: 100, fontSize: 13, fontFamily: "inherit" }}
                />
              </div>
            </Flash>
          </Field>

          <Field label="Topics Discussed" style={{ marginTop: 14 }}>
            <Flash active={touched("topics")}>
              <textarea
                placeholder="Enter key discussion points..."
                value={state.topics}
                onChange={(e) => dispatch(setField({ field: "topics", value: e.target.value }))}
                style={{ ...inputBase, minHeight: 70, resize: "vertical", width: "100%" }}
              />
            </Flash>
          </Field>

          <button style={ghostButton}>
            <Mic size={13} style={{ marginRight: 6 }} />
            Summarize from Voice Note (Requires Consent)
          </button>

          <div style={{ fontSize: 13, fontWeight: 600, margin: "18px 0 10px" }}>Materials Shared / Samples Distributed</div>

          <ListBlock
            title="Materials Shared"
            items={state.materialsShared}
            emptyText="No materials added."
            onAdd={addMaterialManually}
            addLabel="Search/Add"
            addIcon={<Search size={13} />}
            onRemove={(v) => dispatch(removeMaterial(v))}
            flashed={touched("materialsShared")}
          />
          <ListBlock
            title="Samples Distributed"
            items={state.samplesDistributed}
            emptyText="No samples added."
            onAdd={addSampleManually}
            addLabel="Add Sample"
            addIcon={<Plus size={13} />}
            onRemove={(v) => dispatch(removeSample(v))}
            flashed={touched("samplesDistributed")}
          />

          <div style={{ fontSize: 13, fontWeight: 600, margin: "18px 0 10px" }}>Observed/Inferred HCP Sentiment</div>
          <Flash active={touched("sentiment")}>
            <div style={{ display: "flex", gap: 22, padding: "2px 2px 4px" }}>
              {RADIO_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="sentiment"
                    checked={state.sentiment === opt.value}
                    onChange={() => dispatch(setField({ field: "sentiment", value: opt.value }))}
                  />
                  <span>{opt.emoji}</span> {opt.value}
                </label>
              ))}
            </div>
          </Flash>

          <Field label="Outcomes" style={{ marginTop: 14 }}>
            <Flash active={touched("outcomes")}>
              <textarea
                placeholder="Key outcomes or agreements..."
                value={state.outcomes}
                onChange={(e) => dispatch(setField({ field: "outcomes", value: e.target.value }))}
                style={{ ...inputBase, minHeight: 56, resize: "vertical", width: "100%" }}
              />
            </Flash>
          </Field>

          <Field label="Follow-up Actions" style={{ marginTop: 14 }}>
            <Flash active={touched("followUpActions")}>
              <textarea
                placeholder="Enter next steps or tasks..."
                value={state.followUpActions}
                onChange={(e) => dispatch(setField({ field: "followUpActions", value: e.target.value }))}
                style={{ ...inputBase, minHeight: 56, resize: "vertical", width: "100%" }}
              />
            </Flash>
          </Field>

          {state.suggestedFollowUps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>AI Suggested Follow-ups:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {state.suggestedFollowUps.map((s) => (
                  <button key={s} onClick={() => dispatch(useSuggestion(s))} style={suggestionButton}>
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: AI ASSISTANT */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, display: "flex", flexDirection: "column", height: 720 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #EEF0F3", display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={16} color="#2563EB" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Log interaction via chat</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "#2563EB" : "#F3F4F6",
                  color: m.role === "user" ? "#fff" : "#374151",
                  borderRadius: 10,
                  padding: "9px 12px",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  maxWidth: "92%",
                }}
              >
                {m.text}
              </div>
            ))}
            {isThinking && (
              <div style={{ alignSelf: "flex-start", background: "#F3F4F6", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#9CA3AF" }}>
                thinking…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: 12, borderTop: "1px solid #EEF0F3", display: "flex", gap: 8 }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Describe interaction..."
              style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, outline: "none", fontFamily: "inherit" }}
            />
            <button
              onClick={handleSend}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#1F2430", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer" }}
            >
              <AlertTriangle size={13} /> Log
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={handleLogAndSave} style={saveButton}>Save Interaction</button>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, icon, type = "text" }) {
  return (
    <div style={{ ...inputBase, display: "flex", alignItems: "center", gap: 8 }}>
      {icon}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: "none", outline: "none", flex: 1, fontSize: 13, background: "transparent", fontFamily: "inherit" }}
      />
    </div>
  );
}

function Chip({ children, onRemove }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#EFF6FF", color: "#1D4ED8", borderRadius: 6, padding: "3px 7px", fontSize: 12 }}>
      {children}
      <X size={11} style={{ cursor: "pointer" }} onClick={onRemove} />
    </span>
  );
}

function ListBlock({ title, items, emptyText, onAdd, addLabel, addIcon, onRemove, flashed }) {
  return (
    <Flash active={flashed}>
      <div style={{ padding: "8px 2px", marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>{title}</span>
          <button onClick={onAdd} style={smallButton}>{addIcon} {addLabel}</button>
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{emptyText}</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {items.map((it) => <Chip key={it} onRemove={() => onRemove(it)}>{it}</Chip>)}
          </div>
        )}
      </div>
    </Flash>
  );
}

const inputBase = { border: "1px solid #E5E7EB", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", background: "#fff" };
const selectStyle = { ...inputBase, width: "100%", appearance: "auto" };
const ghostButton = { marginTop: 12, display: "inline-flex", alignItems: "center", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#4B5563", cursor: "pointer", fontFamily: "inherit" };
const smallButton = { display: "flex", alignItems: "center", gap: 5, border: "1px solid #E5E7EB", background: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" };
const suggestionButton = { textAlign: "left", background: "#F9FAFB", border: "1px solid #EEF0F3", borderRadius: 6, padding: "6px 9px", fontSize: 12, color: "#2563EB", cursor: "pointer", fontFamily: "inherit" };
const saveButton = { background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
