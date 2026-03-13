# Project Prism – Cloud-Native Intelligent LMS

## Executive Summary

Project Prism is a next-generation Learning Management System enhanced by an event-driven AI intelligence layer. Built on AWS microservices, Prism separates static core infrastructure (data storage, access control, routing) from dynamic AI workflows (predictive analytics, RAG-based semantic search, autonomous agentic routing), providing a highly performant, scalable solution for enterprise-level university deployments.

---

## Repository Structure

```
prism/
├── frontend/          # Next.js 15 (App Router) application
├── backend/           # Python 3.12 / FastAPI microservices
│   ├── app/
│   │   ├── main.py            # FastAPI entry point & CORS config
│   │   ├── core/
│   │   │   └── config.py      # Pydantic Settings (env vars)
│   │   ├── routers/           # One file per microservice boundary
│   │   │   ├── courses.py
│   │   │   ├── forum.py
│   │   │   ├── grading.py
│   │   │   ├── chatbot.py
│   │   │   └── announcements.py
│   │   ├── services/
│   │   │   ├── bedrock.py     # Boto3 Bedrock client & typed helpers
│   │   │   └── db.py          # SQLAlchemy async engine & session
│   │   ├── models/
│   │   │   └── base.py        # SQLAlchemy DeclarativeBase
│   │   └── schemas/
│   │       └── base.py        # Shared Pydantic v2 base models
│   └── pyproject.toml         # Ruff, Mypy, and project metadata
├── environment.yml    # Conda environment definition
└── README.md
```

---

## Prerequisites: Conda Environment

> **All developers and CI/CD pipelines must initialize and activate the `prism-dev` Conda environment before installing dependencies or running the backend.**

This project uses **Conda** for Python 3.12 version management and **uv** for fast package installation within that environment.

### First-time setup

```bash
# 1. Create the Conda environment (Python 3.12)
conda env create -f environment.yml

# 2. Activate the environment – required before every session
conda activate prism-dev

# 3. Install backend dependencies with uv (inside the active env)
cd backend
pip install uv          # install uv into the conda env once
uv pip install -e ".[dev]"
```

### Daily workflow

```bash
# Always activate first
conda activate prism-dev

# Run the backend dev server
cd backend
uvicorn app.main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`.
Interactive API docs: `http://localhost:8000/api/docs`.

---

## Environment Variables

Copy `.env.example` to `backend/.env` and fill in the required values:

| Variable | Description |
|---|---|
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |
| `DATABASE_URL` | asyncpg DSN (`postgresql+asyncpg://user:pass@host/db`) |
| `AWS_ACCESS_KEY_ID` | AWS access key (use IAM roles in production) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (use IAM roles in production) |
| `FRONTEND_ORIGIN` | Next.js dev server origin (default `http://localhost:3000`) |

---

## Architecture Overview

### Part 1: Core Infrastructure

- **Frontend & Edge:** Next.js 15 (App Router) on AWS Amplify + CloudFront
- **Auth:** Amazon Cognito (JWT/RBAC – Student, TA, Instructor, Admin)
- **API:** Amazon API Gateway → AWS Lambda (FastAPI handlers)
- **Relational DB:** Amazon Aurora PostgreSQL Serverless v2 (ACID transactions)
- **NoSQL:** Amazon DynamoDB (forum threads, session state, chat logs)
- **Storage:** Amazon S3 (course materials, submissions, videos)

### Part 2: Intelligence Layer

- **LLM Orchestration:** Amazon Bedrock
  - **Claude Opus 4.6** (`claude-opus-4-6`) – grading co-pilot, deep reasoning, RAG pipeline
  - **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) – forum auto-suggestions, quick summaries
- **Vector Search:** Amazon Titan Embeddings + OpenSearch Serverless (k-NN "Bubble View")
- **Analytics Pipeline:** Kinesis Data Streams → S3 Data Lake → AWS Glue → SageMaker
- **Event Bus:** Amazon EventBridge (DueDateChanged fan-out, notification triggers)
- **Document Parsing:** Amazon Textract (PDF/Word submission extraction)

---

## Tooling

| Tool | Purpose |
|---|---|
| `ruff` | Linting and formatting (configured in `pyproject.toml`) |
| `mypy --strict` | Static type checking |
| `pytest` | Test runner |
| `alembic` | Database migrations |
| `uv` | Fast dependency installation (run inside `prism-dev` Conda env) |
