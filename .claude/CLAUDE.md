# Project Prism – Claude AI Rules

## Global AI Rules

### Stack
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript 5.x, Tailwind CSS v4, shadcn/ui.
- **Backend:** Python 3.12 with **FastAPI** as the primary API framework. AWS Serverless via Boto3 (Lambda, Bedrock, DynamoDB, OpenSearch). For the MVP, run FastAPI locally to simulate the Lambda microservices, with the Next.js frontend calling the FastAPI backend via HTTP.
- **AI/ML:** Amazon Bedrock is the sole LLM provider.
  - Use **Claude Opus 4.6** (`claude-opus-4-6`) for complex agentic tasks (grading co-pilot, deep reasoning, RAG pipeline).
  - Use **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) for high-volume, low-latency tasks (forum auto-suggestions, quick document summaries).
- **Database:** SQLAlchemy 2.x (async) for PostgreSQL (simulating Aurora Serverless v2 locally) and Boto3 for DynamoDB.

### Code Style
- Write modular, **strictly typed Python** throughout — use type hints on all function signatures and leverage `mypy` strict mode.
- On the frontend, write **strict TypeScript** (`strict: true` in tsconfig).
- Favor **React Server Components** for rendering and delegate all data fetching to the FastAPI backend.
- Use **Client Components** (`"use client"`) only when browser APIs or interactivity (state, effects, event handlers) are explicitly required.
- Co-locate types, components, and their tests in the same feature directory (frontend). Co-locate schemas, routers, and tests in the same domain module (backend).
- Validate all external input at API boundaries with **Pydantic v2** models (backend) and **Zod** schemas (frontend forms).
- Use **SQLAlchemy 2.x** async query builder for all PostgreSQL queries — no raw SQL unless strictly necessary.

### Architecture Conventions
- Each FastAPI router module (`backend/app/routers/*.py`) represents a distinct microservice boundary and should remain single-responsibility.
- All Bedrock API calls must go through a shared utility (`backend/app/services/bedrock.py`) that configures the Boto3 `bedrock-runtime` client once and exports typed helper functions.
- Environment variables must be accessed through a validated Pydantic `Settings` class (`backend/app/core/config.py`) — never inline `os.environ` calls in router or service code.
- Event-driven side effects (e.g., triggering a notification after a grade is published) should be modelled as explicit function calls that can be swapped for EventBridge calls when moving off the MVP.

### What NOT to Do
- Do not add client-side data fetching (useEffect + fetch) when a React Server Component can call the FastAPI backend directly.
- Do not use `Any` in Python — use `Unknown` patterns or narrow the type explicitly. Do not use `any` in TypeScript.
- Do not commit secrets, AWS credentials, or `.env` files.
- Do not introduce a new dependency without checking if the existing stack already covers the need.
