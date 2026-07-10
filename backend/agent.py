"""
LangGraph tool-calling agent for the HCP CRM "Log Interaction" screen.

Unlike a fixed pipeline, this agent is handed a set of tools and decides
for itself which to call based on the rep's message — so the same agent
naturally handles "log this visit", "actually make that neutral", "who's
Dr. Rao at Fortis", and "remind me to follow up in 2 weeks" without needing
separate code paths.

    user message
         │
         ▼
  ┌─────────────┐   tool_calls?   ┌───────────┐
  │  agent (LLM) │ ───────────►   │  ToolNode  │
  └──────┬───────┘                └─────┬─────┘
         │  no tool_calls               │ tool results
         ▼                              │
   final reply  ◄───────────────────────┘

Groq's gemma2-9b-it drives tool selection for most turns; llama-3.3-70b-versatile
is used as a fallback when gemma2 returns malformed tool-call arguments (this
happens more often on long, multi-intent dictations).
"""

import os
import json
from typing import Optional, List, Literal

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
# Load environment variables from .env
load_dotenv()

# Get API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found. Please check your .env file.")

PRIMARY_MODEL = os.getenv("GROQ_MODEL_PRIMARY", "gemma2-9b-it")
FALLBACK_MODEL = os.getenv("GROQ_MODEL_FALLBACK", "llama-3.3-70b-versatile")

llm_primary = ChatGroq(model=PRIMARY_MODEL, temperature=0)
llm_fallback = ChatGroq(model=FALLBACK_MODEL, temperature=0)

SYSTEM_PROMPT = """You are the logging assistant on a pharma CRM's "Log HCP \
Interaction" screen. The rep describes a visit, call, or email in their own \
words; your job is to call the right tool(s) to capture it accurately.

Rules:
- Use log_interaction to capture or extend the interaction currently being \
drafted (do this for almost every message describing a visit).
- Use edit_interaction only when the rep is correcting something already \
logged ("actually make that neutral", "remove the brochure").
- Use search_hcp if an HCP name is ambiguous or you need to confirm identity \
before logging against them.
- Use search_materials_or_samples to check whether something the rep \
mentions sharing is an approved, active item before logging it.
- Use suggest_followups after logging a substantive interaction, then \
create_followup_task only if the rep accepts a suggestion or explicitly \
asks for a reminder/task.
- After calling tools, reply with ONE short, plain-language sentence \
confirming what changed. Never expose raw JSON or field names verbatim to \
the rep."""


def build_tools(ctx: dict, db=None):
    """
    Builds the tool set for a single request. `ctx` is a mutable dict shared
    by closure across all tools in this call so their side effects (form
    edits, follow-up suggestions) can be read back by run_agent() once the
    graph finishes. `db` is the SQLAlchemy session for this request (None in
    contexts where DB-backed tools aren't needed, e.g. local testing).
    """

    @tool
    def log_interaction(
        hcp_name: Optional[str] = None,
        interaction_type: Optional[Literal["Meeting", "Call", "Email", "Conference"]] = None,
        topics_discussed: Optional[str] = None,
        sentiment: Optional[Literal["Positive", "Neutral", "Negative"]] = None,
        materials_shared: Optional[List[str]] = None,
        samples_distributed: Optional[List[str]] = None,
        outcomes: Optional[str] = None,
        attendees: Optional[List[str]] = None,
    ) -> dict:
        """Capture or extend the HCP interaction currently being drafted.
        Call this for any part of a visit/call/email description: who it was
        with, what was discussed, sentiment, materials or samples given, and
        outcomes. Safe to call multiple times in one turn as new details are
        mentioned — list fields are merged, not overwritten."""
        form = ctx["form"]
        diff = {}

        if hcp_name:
            form["hcpName"] = diff["hcpName"] = hcp_name
        if interaction_type:
            form["interactionType"] = diff["interactionType"] = interaction_type
        if sentiment:
            form["sentiment"] = diff["sentiment"] = sentiment
        if topics_discussed:
            merged = (form.get("topics", "") + " " + topics_discussed).strip()
            form["topics"] = diff["topics"] = merged
        if outcomes:
            merged = (form.get("outcomes", "") + " " + outcomes).strip()
            form["outcomes"] = diff["outcomes"] = merged
        if materials_shared:
            existing = set(form.get("materialsShared", []))
            merged_list = form.get("materialsShared", []) + [m for m in materials_shared if m not in existing]
            form["materialsShared"] = diff["materialsShared"] = merged_list
        if samples_distributed:
            existing = set(form.get("samplesDistributed", []))
            merged_list = form.get("samplesDistributed", []) + [s for s in samples_distributed if s not in existing]
            form["samplesDistributed"] = diff["samplesDistributed"] = merged_list
        if attendees:
            existing = set(form.get("attendees", []))
            merged_list = form.get("attendees", []) + [a for a in attendees if a not in existing]
            form["attendees"] = diff["attendees"] = merged_list

        ctx["diff"].update(diff)
        return {"status": "ok", "fields_set": list(diff.keys())}

    @tool
    def edit_interaction(
        field: Literal["hcpName", "interactionType", "topics", "sentiment",
                        "materialsShared", "samplesDistributed", "outcomes",
                        "followUpActions", "attendees"],
        operation: Literal["replace", "append", "remove"],
        value: str,
        interaction_id: Optional[int] = None,
    ) -> dict:
        """Correct a field on the interaction. Use interaction_id=None to
        edit the draft currently on screen; pass an interaction_id to correct
        a previously saved record (look it up with search_hcp / interaction
        history first if the rep doesn't give you the id directly).
        operation: 'replace' overwrites a text field, 'append' adds to a
        text or list field, 'remove' deletes one item from a list field."""
        form = ctx["form"]

        if interaction_id is None:
            old_value = form.get(field)
            if operation == "replace":
                form[field] = value
            elif operation == "append":
                if isinstance(old_value, list):
                    form[field] = old_value + [value]
                else:
                    form[field] = ((old_value or "") + " " + value).strip()
            elif operation == "remove":
                if isinstance(old_value, list):
                    form[field] = [v for v in old_value if v != value]
            ctx["diff"][field] = form[field]
            return {"status": "ok", "scope": "draft", "field": field, "new_value": form[field]}

        if db is None:
            return {"status": "error", "message": "No database session available for saved-record edits."}

        from models import Interaction, InteractionEditLog

        row = db.query(Interaction).get(interaction_id)
        if row is None:
            return {"status": "error", "message": f"No saved interaction with id {interaction_id}"}

        db_field_map = {
            "topics": "topics_discussed", "sentiment": "sentiment", "outcomes": "outcomes",
            "followUpActions": "follow_up_actions", "interactionType": "interaction_type",
        }
        db_field = db_field_map.get(field)
        if db_field is None:
            return {"status": "error", "message": f"Field '{field}' isn't editable on a saved record via this tool."}

        old_value = getattr(row, db_field)
        new_value = value if operation == "replace" else f"{old_value or ''} {value}".strip()
        setattr(row, db_field, new_value)
        db.add(InteractionEditLog(
            interaction_id=interaction_id, field=field, operation=operation,
            old_value=str(old_value), new_value=str(new_value), edited_by="ai_agent",
        ))
        db.commit()
        return {"status": "ok", "scope": "saved", "field": field, "new_value": new_value}

    @tool
    def search_hcp(name: str, specialty: Optional[str] = None) -> list:
        """Look up HCP records by name to resolve ambiguity before logging
        (e.g. multiple 'Dr. Rao' at different institutions) or to confirm an
        HCP exists before referencing them."""
        if db is None:
            return []
        from models import HCP
        q = db.query(HCP).filter(HCP.name.ilike(f"%{name}%"))
        if specialty:
            q = q.filter(HCP.specialty.ilike(f"%{specialty}%"))
        return [{"id": h.id, "name": h.name, "specialty": h.specialty, "institution": h.institution}
                for h in q.limit(5)]

    @tool
    def search_materials_or_samples(query: str, kind: Literal["material", "sample"]) -> list:
        """Check whether something the rep mentions sharing matches an
        approved, currently-active material or sample, before logging it.
        Prevents logging distribution of withdrawn or unapproved items."""
        if db is None:
            return []
        from models import Material, Sample
        model = Material if kind == "material" else Sample
        q = db.query(model).filter(model.active == True).filter(model.name.ilike(f"%{query}%"))
        return [{"id": m.id, "name": m.name} for m in q.limit(5)]

    @tool
    def suggest_followups(interaction_summary: Optional[str] = None) -> list:
        """Propose 1-3 short, concrete follow-up actions based on the
        interaction logged so far (sentiment, topics, materials). Call this
        after log_interaction on a substantive visit, not on every message."""
        merged = ctx["form"]
        prompt = [
            {"role": "system", "content": (
                "Given this JSON state of a logged HCP interaction, suggest 1-3 short, "
                "concrete follow-up actions a pharma rep should take next. Respond with "
                "ONLY a JSON array of strings, no prose."
            )},
            {"role": "user", "content": json.dumps(merged)},
        ]
        try:
            resp = llm_primary.invoke(prompt)
            content = resp.content.strip().strip("`")
            suggestions = json.loads(content)
            if not isinstance(suggestions, list):
                suggestions = []
        except Exception:
            suggestions = []
        ctx["followups"] = suggestions[:3]
        return suggestions[:3]

    @tool
    def create_followup_task(
        description: str,
        due_date: Optional[str] = None,
        interaction_id: Optional[int] = None,
    ) -> dict:
        """Turn an accepted follow-up suggestion (or an explicit rep request)
        into a real task. If interaction_id is None, the task is appended to
        the draft's follow-up actions text and will be saved with the
        interaction; if interaction_id is given, it's written immediately as
        its own row against that saved interaction."""
        if interaction_id is None:
            form = ctx["form"]
            sep = "\n" if form.get("followUpActions") else ""
            form["followUpActions"] = form.get("followUpActions", "") + sep + f"- {description}"
            ctx["diff"]["followUpActions"] = form["followUpActions"]
            return {"status": "ok", "scope": "draft"}

        if db is None:
            return {"status": "error", "message": "No database session available."}
        from models import InteractionFollowup
        row = InteractionFollowup(
            interaction_id=interaction_id, description=description,
            suggested_by_ai=True, accepted=True,
            due_date=due_date,
        )
        db.add(row)
        db.commit()
        return {"status": "ok", "scope": "saved", "id": row.id}

    return [
        log_interaction, edit_interaction, search_hcp,
        search_materials_or_samples, suggest_followups, create_followup_task,
    ]


def run_agent(message: str, current_form: dict, interaction_id: int = None, db=None) -> dict:
    """Entry point called from POST /api/chat."""
    ctx = {"form": dict(current_form), "diff": {}, "followups": []}
    tools = build_tools(ctx, db)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": message},
    ]

    def run_with(llm):
        agent = create_react_agent(llm, tools)
        result = agent.invoke({"messages": messages})
        return result["messages"][-1].content

    try:
        reply = run_with(llm_primary)
    except Exception:
        # gemma2-9b-it occasionally emits malformed tool-call arguments on
        # long or multi-intent dictations; retry once on the larger model.
        ctx["diff"] = {}
        ctx["followups"] = []
        reply = run_with(llm_fallback)

    if not ctx["diff"] and not reply:
        reply = "I didn't catch anything actionable there — try describing who you met and what happened."

    return {
        "form_diff": ctx["diff"],
        "followups": ctx["followups"],
        "reply": reply or "Got it.",
    }
