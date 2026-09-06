# Word World

An AI-powered document assistant for automating Microsoft Word (.docx) page numbering. Type instructions in natural language and the AI parses your intent, restructuring the document XML to apply the correct page fields, section breaks, and numbering.

## Features

- **Natural Language Instructions** — e.g. "Add Roman page numbers from the beginning to the table of contents"
- **Advanced Page Numbering** — per-chapter formats, positions, and first-page exclusions
- **Smart Section Isolation** — automatic chapter boundary detection without breaking document layout
- **Zero-Loss Formatting** — targeted XML manipulation, document styles stay intact
- **Conversational Memory** — follow-up corrections work because previous prompts are passed to the model
- **Live Preview** — results render via Microsoft Office Web Viewer

## Tech Stack

- **Backend**: FastAPI, python-docx, LangChain + Groq, Supabase Storage
- **Frontend**: React (TypeScript), Tailwind CSS, Vite

## Requirements

- Python 3.11+
- Node.js 18+
- Groq API key
- Optional: a Supabase project with a public `previews` bucket for the preview feature

## Getting Started

### 1. Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:

```env
GROQ_API_KEY=your_groq_api_key_here
ALLOWED_ORIGINS=http://localhost:5173
```

Run the API:

```powershell
uvicorn app.main:app --reload
```

### 2. Frontend

```powershell
cd web
npm install
npm run dev
```

### Testing

```powershell
pytest -v
```