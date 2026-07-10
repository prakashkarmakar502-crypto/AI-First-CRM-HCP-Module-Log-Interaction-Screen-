import os
from datetime import datetime
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models import get_db, HCP, Material, Sample, Interaction, InteractionAttendee, InteractionFollowup
from agent import run_agent

app = FastAPI(title="HCP CRM - Log Interaction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ───────────────────────── schemas ─────────────────────────

class ChatRequest(BaseModel):
    message: str
    current_form: Dict[str, Any]
    interaction_id: Optional[int] = None  # set when the rep is editing a previously saved interaction


class ChatResponse(BaseModel):
    form_diff: Dict[str, Any]
    followups: List[str]
    reply: str


class InteractionCreate(BaseModel):
    hcp_name: str
    interaction_type: str
    date: str
    time: str
    attendees: List[str] = []
    topics: Optional[str] = None
    materials_shared: List[str] = []
    samples_distributed: List[str] = []
    sentiment: str = "Neutral"
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None
    source: str = "form"
    rep_user_id: int
    raw_chat_transcript: Optional[List[Dict[str, str]]] = None


# ───────────────────────── chat: the AI assistant panel ─────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Called by the right-hand AI Assistant panel on every message.
    Runs the LangGraph tool-calling agent (Groq gemma2-9b-it, with
    llama-3.3-70b-versatile as fallback) against the 6 sales tools in
    agent.py (log_interaction, edit_interaction, search_hcp,
    search_materials_or_samples, suggest_followups, create_followup_task)
    and returns a diff the frontend Redux store merges into
    interactionSlice, plus AI-suggested follow-ups and a chat reply.
    """
    try:
        return run_agent(req.message, req.current_form, req.interaction_id, db)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent error: {e}")


# ───────────────────────── HCP / material / sample lookups ─────────────────────────

@app.get("/api/hcps")
def search_hcps(q: str = "", db: Session = Depends(get_db)):
    query = db.query(HCP)
    if q:
        query = query.filter(HCP.name.ilike(f"%{q}%"))
    return [{"id": h.id, "name": h.name, "specialty": h.specialty} for h in query.limit(20)]


@app.get("/api/materials")
def search_materials(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Material).filter(Material.active == True)
    if q:
        query = query.filter(Material.name.ilike(f"%{q}%"))
    return [{"id": m.id, "name": m.name, "type": m.type} for m in query.limit(20)]


@app.get("/api/samples")
def search_samples(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Sample).filter(Sample.active == True)
    if q:
        query = query.filter(Sample.name.ilike(f"%{q}%"))
    return [{"id": s.id, "name": s.name} for s in query.limit(20)]


# ───────────────────────── saving the logged interaction ─────────────────────────

@app.post("/api/interactions")
def create_interaction(payload: InteractionCreate, db: Session = Depends(get_db)):
    hcp = db.query(HCP).filter(HCP.name == payload.hcp_name).first()
    if not hcp:
        hcp = HCP(name=payload.hcp_name)
        db.add(hcp)
        db.flush()

    interaction = Interaction(
        hcp_id=hcp.id,
        rep_user_id=payload.rep_user_id,
        interaction_type=payload.interaction_type,
        occurred_on=payload.date,
        occurred_at=payload.time,
        topics_discussed=payload.topics,
        sentiment=payload.sentiment,
        outcomes=payload.outcomes,
        follow_up_actions=payload.follow_up_actions,
        source=payload.source,
        raw_chat_transcript=payload.raw_chat_transcript,
    )
    db.add(interaction)
    db.flush()

    for name in payload.attendees:
        db.add(InteractionAttendee(interaction_id=interaction.id, attendee_name=name))

    db.commit()
    return {"id": interaction.id, "hcp_id": hcp.id}


@app.get("/api/interactions/{interaction_id}")
def get_interaction(interaction_id: int, db: Session = Depends(get_db)):
    row = db.query(Interaction).get(interaction_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return {
        "id": row.id,
        "hcp_id": row.hcp_id,
        "interaction_type": row.interaction_type,
        "date": str(row.occurred_on),
        "time": str(row.occurred_at),
        "topics": row.topics_discussed,
        "sentiment": row.sentiment,
        "outcomes": row.outcomes,
        "follow_up_actions": row.follow_up_actions,
        "attendees": [a.attendee_name for a in row.attendees],
    }


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}
