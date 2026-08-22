# Word World

An AI Agent for formatting and manipulating Microsoft Word (.docx) page numbers using natural language commands.

## Overview

Word World allows users to control document pagination without navigating complex software menus. By providing a natural language instruction, the tool automatically parses the intent and restructures the underlying XML of the .docx file to apply the correct page fields, section breaks, and alignments.

## Features

- **Natural Language Parsing**: Translates plain English or Indonesian instructions (e.g., *"Add roman numerals at the bottom center of Chapter 1"*) into document structural changes.
- **Advanced Page Numbering & Sectioning**: Automatically manages complex document sections and Microsoft Word page fields, enabling independent numbering formats and positions for specific chapters.
- **Privacy First**: Documents are processed in-memory and immediately returned to the user. No files are stored or persisted.
- **Zero Configuration**: A single-viewport, glassmorphism interface designed for a fast drag-and-drop workflow.

## Models Used

Word World's natural language command parsing is powered by highly efficient LLMs, utilizing:
- **Llama 3.1 (8B)** via Groq API for blazing-fast inference.

## Tech Stack

- React (TypeScript)
- Tailwind CSS
- Vite