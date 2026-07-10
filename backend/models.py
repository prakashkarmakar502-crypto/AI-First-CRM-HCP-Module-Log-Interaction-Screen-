import os
from datetime import date, time, datetime
from sqlalchemy import (
    create_engine, Column, BigInteger, String, Text, Date, Time, Enum,
    Boolean, ForeignKey, TIMESTAMP, JSON, Integer
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_URL = (
    f"mysql+pymysql://{os.getenv('MYSQL_USER')}:{os.getenv('MYSQL_PASSWORD')}"
    f"@{os.getenv('MYSQL_HOST','localhost')}:{os.getenv('MYSQL_PORT','3306')}"
    f"/{os.getenv('MYSQL_DATABASE')}"
)

engine = create_engine(DB_URL, pool_pre_ping=True, pool_recycle=280)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class HCP(Base):
    __tablename__ = "hcps"
    id = Column(BigInteger, primary_key=True)
    name = Column(String(255), nullable=False)
    specialty = Column(String(255))
    institution = Column(String(255))
    npi_number = Column(String(32))
    created_at = Column(TIMESTAMP, default=datetime.utcnow)


class Material(Base):
    __tablename__ = "materials"
    id = Column(BigInteger, primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(Enum("brochure", "pdf", "reprint", "leave_behind", "other"), default="other")
    active = Column(Boolean, default=True)


class Sample(Base):
    __tablename__ = "samples"
    id = Column(BigInteger, primary_key=True)
    name = Column(String(255), nullable=False)
    lot_number = Column(String(64))
    active = Column(Boolean, default=True)


class Interaction(Base):
    __tablename__ = "interactions"
    id = Column(BigInteger, primary_key=True)
    hcp_id = Column(BigInteger, ForeignKey("hcps.id"), nullable=False)
    rep_user_id = Column(BigInteger, nullable=False)
    interaction_type = Column(Enum("Meeting", "Call", "Email", "Conference"), default="Meeting")
    occurred_on = Column(Date, nullable=False)
    occurred_at = Column(Time, nullable=False)
    topics_discussed = Column(Text)
    sentiment = Column(Enum("Positive", "Neutral", "Negative"), default="Neutral")
    outcomes = Column(Text)
    follow_up_actions = Column(Text)
    source = Column(Enum("form", "chat", "voice"), default="form")
    raw_chat_transcript = Column(JSON)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    attendees = relationship("InteractionAttendee", backref="interaction", cascade="all, delete-orphan")
    followups = relationship("InteractionFollowup", backref="interaction", cascade="all, delete-orphan")


class InteractionAttendee(Base):
    __tablename__ = "interaction_attendees"
    interaction_id = Column(BigInteger, ForeignKey("interactions.id"), primary_key=True)
    attendee_name = Column(String(255), primary_key=True)


class InteractionFollowup(Base):
    __tablename__ = "interaction_followups"
    id = Column(BigInteger, primary_key=True)
    interaction_id = Column(BigInteger, ForeignKey("interactions.id"))
    description = Column(String(500), nullable=False)
    suggested_by_ai = Column(Boolean, default=False)
    accepted = Column(Boolean, default=False)
    due_date = Column(Date)


class InteractionEditLog(Base):
    __tablename__ = "interaction_edit_log"
    id = Column(BigInteger, primary_key=True)
    interaction_id = Column(BigInteger, ForeignKey("interactions.id"), nullable=False)
    field = Column(String(64), nullable=False)
    operation = Column(Enum("replace", "append", "remove"), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    edited_by = Column(Enum("rep", "ai_agent"), default="ai_agent")
    edited_at = Column(TIMESTAMP, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
