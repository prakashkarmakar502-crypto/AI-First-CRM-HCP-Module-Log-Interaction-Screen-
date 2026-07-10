# AI-First-CRM-HCP-Module-Log-Interaction-Screen-
An AI-first take on the "Log HCP Interaction" screen for a pharma CRM. Reps can fill out the interaction form the normal way, or just describe the visit in plain language to an AI Assistant panel and watch the form fill itself in.


Met Dr. Rao, discussed Product X efficacy, positive sentiment, shared brochure, agreed to a follow-up call.



...turns into a fully populated form: HCP name, topics, sentiment, materials shared, outcomes — no typing into individual fields required.


Table of contents


How it works
Tech stack
Project structure
The AI agent
Setup
Running it
Environment variables
Known limitations



How it works

Two things update the same form: the rep typing directly into a field, or the rep describing the visit in the chat panel. Both paths write to the exact same state, so validation and saving behave identically no matter which one was used.

 Rep types in chat  ──►  FastAPI (/api/chat)  ──►  LangGraph agent  ──►  Groq LLM decides which
                                                                         tool(s) to call
                                                            │
                                                            ▼
                                            Tool updates the interaction draft
                                            (and/or the database, for edits/lookups)
                                                            │
                                                            ▼
                                  Diff sent back to the frontend ──► Redux store ──► form re-renders

Tech stack

LayerChoiceFrontendReact + Redux ToolkitBackendPython + FastAPIAgent frameworkLangGraph (tool-calling agent)LLMGroq — gemma2-9b-it (primary), llama-3.3-70b-versatile (fallback)DatabaseMySQLFontGoogle Inter

Project structure

hcp-crm/
├── README.md
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── main.jsx                     # entry point, wraps App in Redux <Provider>
│       ├── App.jsx
│       ├── store/
│       │   ├── store.js                 # configureStore()
│       │   └── interactionSlice.js      # the single slice both form + chat write to
│       ├── api/
│       │   ├── chatApi.js               # talks to /api/chat, /api/interactions, etc.
│       │   └── localAgentFallback.js    # offline heuristic if the backend is unreachable
│       └── components/
│           └── LogInteractionScreen.jsx # the screen itself
└── backend/
    ├── main.py                # FastAPI app — routes requests to the right place
    ├── agent.py                # the LangGraph agent + its 6 tools
    ├── models.py                # SQLAlchemy models (MySQL)
    ├── schema.sql                # raw DDL, same schema as models.py
    ├── demo_tools.py              # standalone script that exercises all 6 tools directly
    ├── requirements.txt
    └── .env.example

Frontend, in short: LogInteractionScreen.jsx is the layout. store/ is where the form's data actually lives — both manual typing and the AI Assistant write to it through the same actions. api/chatApi.js is the only thing that talks to the backend.

Backend, in short: main.py receives HTTP requests and routes them. agent.py is the AI — it decides what a rep's message means and acts on it. models.py / schema.sql define what's stored in MySQL.

The AI agent

agent.py uses langgraph.prebuilt.create_react_agent: the LLM is given 6 tools and decides for itself which to call, rather than following a fixed script.

ToolPurposelog_interactionCapture/extend the draft interaction (HCP, topics, sentiment, materials, samples, outcomes, attendees). Merges into the existing draft rather than overwriting.edit_interactionCorrect a field — on the current draft, or (given an interaction_id) on a previously saved record. Saved-record edits are written to an audit table.search_hcpResolve an ambiguous HCP name (e.g. two "Dr. Rao"s) before logging against one.search_materials_or_samplesConfirm something mentioned is an approved, active material/sample before logging its distribution.suggest_followupsPropose 1–3 next actions based on the logged interaction.create_followup_taskTurn an accepted suggestion into a real, saved task.

gemma2-9b-it drives tool selection for most turns; llama-3.3-70b-versatile is used as a fallback when the primary model returns malformed tool-call arguments (more common on long, multi-intent dictations).

You can see all 6 tools exercised directly, with real database reads/writes, by running:

bashcd backend
python demo_tools.py

This runs against a temporary in-memory database and doesn't require a Groq key — it proves the tools' execution logic works, independent of the LLM's tool-selection step.

Setup

Prerequisites


Python 3.10+
Node.js 18+
MySQL running locally
A Groq API key — create one at console.groq.com/keys


1. Database

bashmysql -u root -p -e "CREATE DATABASE hcp_crm;"
mysql -u root -p hcp_crm < backend/schema.sql

2. Backend

bashcd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

Open backend/.env and fill in your Groq key and MySQL credentials.

3. Frontend

bashcd frontend
cp .env.example .env
npm install

Running it

Two terminals, both running at the same time:

bash# Terminal 1 — backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload
# → http://localhost:8000  (check http://localhost:8000/health)

bash# Terminal 2 — frontend
cd frontend
npm run dev
# → http://localhost:5173

Open http://localhost:5173 and try typing into the AI Assistant panel.


The frontend still works even without the backend running — chatApi.js falls back to a local, rule-based parser (localAgentFallback.js) so the UI is demonstrable offline, with a console warning that it isn't hitting the real agent.



Environment variables

backend/.env

GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL_PRIMARY=gemma2-9b-it
GROQ_MODEL_FALLBACK=llama-3.3-70b-versatile
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=crm_app
MYSQL_PASSWORD=change-me
MYSQL_DATABASE=hcp_crm

frontend/.env

VITE_API_BASE=http://localhost:8000

Known limitations


Extraction accuracy hasn't been tuned against real dictation data — it's prompt-only, with no evaluation set yet.
No confidence scoring per field; the agent doesn't flag uncertain extractions to the rep.
No authentication/session layer — the rep's identity is currently hardcoded in the backend.
Voice-note transcription is stubbed in the UI but not wired to a transcription service.



Next steps


Per-field confidence scores, surfaced in the UI so low-confidence extractions get flagged for review before saving.
A review/confirm step before the final save, rather than writing on every chat turn.
Real voice-note transcription feeding into the same tool pipeline.
