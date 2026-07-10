# 🏥 AI-First CRM – HCP Interaction Logging Module

![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)
![Redux](https://img.shields.io/badge/State-Redux-764ABC?logo=redux)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)
![LangGraph](https://img.shields.io/badge/AI-LangGraph-blue)
![Groq](https://img.shields.io/badge/LLM-Groq-orange)
![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1?logo=mysql)
![License](https://img.shields.io/badge/License-MIT-green)

An **AI-powered CRM module** for Healthcare Professional (HCP) interaction logging that allows pharmaceutical representatives to log interactions using either a **traditional form** or a **conversational AI assistant**.

Instead of manually filling multiple fields, users simply describe their meeting in natural language, and the AI automatically extracts and populates the interaction details.

---

## 🚀 Features

- 🤖 AI-powered interaction logging
- 💬 Conversational chat interface
- 📝 Traditional form-based logging
- 🔍 Search HCPs
- ✏️ Edit previous interactions
- 📦 Search materials & samples
- 📅 Suggest follow-up actions
- ✅ Create follow-up tasks
- ⚡ Redux state management
- 🗄️ MySQL database integration
- 🔄 LangGraph tool-calling agent
- 🎯 Groq LLM integration

---

## 💡 Example

### User says:

> "Met Dr. Rao today. Discussed Product X efficacy, shared brochure, doctor showed positive interest and agreed for a follow-up meeting next week."

### AI automatically fills:

- HCP Name ✅
- Discussion Topics ✅
- Sentiment ✅
- Materials Shared ✅
- Follow-up Required ✅
- Interaction Summary ✅

No manual typing required.

---

# 🏗️ System Architecture

```
                User
                  │
                  ▼
        React + Redux Frontend
                  │
                  ▼
         FastAPI REST Backend
                  │
                  ▼
          LangGraph AI Agent
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
    Groq LLM             AI Tools
        │                    │
        └─────────┬──────────┘
                  ▼
             MySQL Database
```

---

# 🛠️ Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | React + Redux Toolkit + Vite |
| Backend | FastAPI (Python) |
| AI Agent | LangGraph |
| LLM | Groq (Gemma2-9B / Llama-3.3-70B) |
| Database | MySQL |
| ORM | SQLAlchemy |
| Styling | CSS |
| State Management | Redux Toolkit |

---

# 📂 Project Structure

```
hcp-crm/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── store/
│   │   ├── api/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── agent.py
│   ├── main.py
│   ├── models.py
│   ├── schema.sql
│   ├── demo_tools.py
│   └── requirements.txt
│
└── README.md
```

---

# 🤖 AI Tools

The LangGraph agent contains **6 intelligent tools**.

| Tool | Description |
|------|-------------|
| Log Interaction | Extracts interaction details from conversation |
| Edit Interaction | Updates draft or saved interactions |
| Search HCP | Finds Healthcare Professionals |
| Search Materials | Searches approved materials/samples |
| Suggest Follow-ups | Generates recommended next actions |
| Create Follow-up Task | Creates follow-up task in database |

---



## 1. Create Database

```sql
CREATE DATABASE hcp_crm;
```

Import schema

```bash
mysql -u root -p hcp_crm < backend/schema.sql
```

---

## 2. Backend Setup

```bash
cd backend

python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Linux / Mac

```bash
source .venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Copy environment file

```bash
cp .env.example .env
```

Run backend

```bash
uvicorn main:app --reload
```

Backend runs at

```
http://localhost:8000
```

---

## 3. Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend runs at

```
http://localhost:5173
```

---

# 🔑 Environment Variables

## Backend (.env)

```env
GROQ_API_KEY=your_api_key

PRIMARY_MODEL=gemma2-9b-it

FALLBACK_MODEL=llama-3.3-70b-versatile

MYSQL_HOST=localhost

MYSQL_PORT=3306

MYSQL_USER=root

MYSQL_PASSWORD=your_password

MYSQL_DATABASE=hcp_crm
```

---

## Frontend (.env)

```env
VITE_API_BASE=http://localhost:8000
```

---


# 🔄 Workflow

```
User Types
      │
      ▼
AI Assistant
      │
      ▼
FastAPI API
      │
      ▼
LangGraph Agent
      │
      ▼
Select Tool
      │
      ▼
Execute Tool
      │
      ▼
Update Database
      │
      ▼
Return Updated Form
```

---

# 🎯 Future Improvements

- Voice interaction support
- Confidence score for extracted fields
- Authentication & role management
- OCR for visiting cards
- Calendar integration
- Analytics dashboard
- Email reminders
- Multi-language support

---

# 📄 License

This project is developed as part of an **AI-First CRM HCP Module Assignment** for round 1 assignment at AIVOA.AI.

---

# 👨‍💻 Author

**Prakash Karmakar**

MCA Graduate

GitHub: https://github.com/prakashkarmakar502-crypto

LinkedIn: https://www.linkedin.com/in/prakash-karmakar-abaa93280

---

⭐ If you found this project helpful, don't forget to **Star** the repository!
