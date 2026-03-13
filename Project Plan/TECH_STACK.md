# Project Prism – Full Tech Stack

A comprehensive, layered technology stack for the cloud-native intelligent LMS. Every tool listed here has a deliberate reason for being chosen over its alternatives.

---

## 1. Frontend

| Category | Technology | Notes |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Server Components, streaming SSR, built-in image/font optimization |
| UI Library | **React 19** | Concurrent features, `use()` hook, form actions |
| Language | **TypeScript 5.x** | Strict mode enabled across the entire codebase |
| Styling | **Tailwind CSS v4** | JIT, design tokens via CSS variables |
| Component Library | **shadcn/ui** | Radix primitives + Tailwind, fully owned source, no versioning lock-in |
| Animation | **Framer Motion** | Layout animations for the Bubble View transitions and page routing |
| 3D / Canvas | **Three.js + React Three Fiber** | Powers the Bubble View semantic cluster visualization |
| Charts / Dashboards | **Recharts** + **D3.js** | Recharts for standard analytics; D3 for custom force-directed cluster graphs |
| Data Tables | **TanStack Table v8** | Headless table engine for the Gradebook (sorting, filtering, virtualized rows, sticky columns) |
| Calendar | **FullCalendar v6** | Full-featured calendar component (month/week/day views); integrates with React; handles event rendering, drag-and-drop, and date navigation |
| Date Utilities | **date-fns** | Lightweight, tree-shakeable date manipulation; formatting, relative time ('Due in 3 days'), timezone handling |
| PDF Viewer | **react-pdf** (PDF.js) | In-browser PDF rendering for the SpeedGrader submission viewer and course file previews |
| Data Fetching | **TanStack Query v5** | Server-state cache, background refetch, stale-while-revalidate |
| Global State | **Zustand** | Lightweight, no boilerplate; scoped stores per feature domain |
| Real-Time Client | **Socket.io Client** | Forum live updates, chat, notification toasts |
| Forms | **React Hook Form** + **Zod** | Schema-validated forms, minimal re-renders |
| Rich Text Editor | **TipTap** (ProseMirror-based) | Assignment submissions, forum posts, instructor announcements, wiki pages |
| File Upload | **Uppy** | Chunked multipart upload directly to S3 presigned URLs |
| Drag and Drop | **@dnd-kit/core** | Accessible drag-and-drop for module reordering, quiz question reordering, and matching question types |
| i18n | **next-intl** | ICU message format, locale-aware routing |
| Accessibility | **axe-core** + **eslint-plugin-jsx-a11y** | WCAG 2.1 AA compliance enforced at lint time |

---

## 2. Backend – API & Microservices

| Category | Technology | Notes |
|---|---|---|
| Primary Runtime | **Python 3.12** | All Lambda functions, CRUD microservices, AI/ML pipelines, SageMaker scripts |
| API Framework (MVP) | **FastAPI** | High-performance async Python framework; auto-generated OpenAPI docs; runs locally during MVP, maps to Lambda in production |
| API Protocol (REST) | **Amazon API Gateway (HTTP API v2)** | 60% cheaper than REST API; native JWT authorizers |
| API Protocol (GraphQL) | **AWS AppSync** | Complex relational data queries from the instructor dashboard; subscription support for real-time grade updates |
| API Protocol (WebSocket) | **API Gateway WebSocket API** | Persistent connections for the live forum and in-course chat |
| Container Runtime | **Amazon ECS on Fargate** | Video transcoding pipeline, heavy ETL preprocessing tasks |
| Container Images | **Amazon ECR** | Private registry with image scanning on push |
| Serverless Orchestration | **AWS Step Functions** | Coordinates the multi-step grading co-pilot workflow (Textract → Bedrock → variance check → publish) |
| Message Queue | **Amazon SQS (FIFO)** | Dead-letter queues for failed Lambda invocations; exactly-once delivery for grade events |
| Service Mesh (internal) | **AWS App Mesh** | mTLS between ECS services; traffic shaping for canary deployments |
| Schema Validation | **Pydantic v2** | Runtime validation at every service boundary; shared models between FastAPI and Lambda handlers |
| ORM | **SQLAlchemy 2.x (async)** | Type-safe async query builder for Aurora PostgreSQL; Alembic for migrations |
| AWS SDK | **Boto3** | AWS SDK for Python; used for DynamoDB, Bedrock, S3, SQS, EventBridge, and all AWS service integrations |
| Cache Layer | **Amazon ElastiCache for Redis 7** | Session tokens, rate-limit counters, leaderboard data, hot-path query results |

---

## 3. Database & Storage

| Layer | Technology | Purpose |
|---|---|---|
| Relational (OLTP) | **Amazon Aurora PostgreSQL Serverless v2** | Users, grades, courses, enrollments — ACID-compliant transactions |
| NoSQL (High-Throughput) | **Amazon DynamoDB** (on-demand) | Forum threads, chat logs, session state, notification records |
| Vector Database | **Amazon OpenSearch Serverless (Vector Engine)** | k-NN similarity search for Bubble View clustering and RAG retrieval |
| Time-Series | **Amazon Timestream** | Raw clickstream metrics (video pauses, scroll depth) with automatic tiered storage |
| Object Storage | **Amazon S3 (Intelligent-Tiering)** | Lecture videos, PDFs, student submissions, ML training data |
| Data Lake | **Amazon S3 + AWS Glue Data Catalog** | Structured behavioral data lake in Apache Parquet format |
| Distributed Cache | **Amazon ElastiCache for Redis 7** | Hot-path caching, pub/sub for real-time features |
| Search | **Amazon OpenSearch Serverless** | Full-text search across course materials and forum content |

---

## 4. Cloud Infrastructure (AWS)

### Compute & Delivery

| Service | Role |
|---|---|
| **AWS Lambda** (Python 3.12) | All CRUD microservices, event handlers, triggers — deployed from FastAPI routers via Mangum adapter |
| **Amazon ECS (Fargate)** | Long-running containers: video transcoding, bulk ETL |
| **Amazon CloudFront** | Global CDN for static assets, signed URLs for S3 video delivery |
| **AWS Amplify Hosting** | Next.js SSR hosting with managed CI/CD and preview deployments |
| **AWS Global Accelerator** | Anycast routing for API Gateway; reduces latency for international students |

### Networking

| Service | Role |
|---|---|
| **Amazon VPC** | Isolated private network with public/private/database subnet tiers |
| **AWS PrivateLink** | Zero-internet-exposure access to S3, DynamoDB, SQS from within the VPC |
| **Amazon Route 53** | Latency-based DNS routing, health checks, failover policies |
| **AWS WAF v2** | OWASP rule groups, rate limiting, IP reputation lists on CloudFront + API Gateway |
| **AWS Shield Advanced** | L3/L4 DDoS protection; critical during exam submission peaks |

### Identity & Access

| Service | Role |
|---|---|
| **Amazon Cognito (User Pools + Identity Pools)** | RBAC with custom attributes for Student/TA/Instructor/Admin roles; SAML federation for university SSO (Shibboleth/ADFS) |
| **AWS IAM + Permission Boundaries** | Least-privilege Lambda execution roles; SCP enforcement at the AWS Organization level |
| **AWS Secrets Manager** | Rotated DB credentials, API keys, Bedrock access tokens |
| **AWS KMS (Customer Managed Keys)** | Envelope encryption for S3 objects, DynamoDB items, Aurora at rest |

### Event-Driven & Messaging

| Service | Role |
|---|---|
| **Amazon EventBridge** | Central event bus; schema registry for all domain events (DueDateChanged, SubmissionReceived, GradePublished) |
| **Amazon SQS** | Buffered queues between producers and consumers; FIFO for grade events |
| **Amazon SNS** | Fan-out push notifications (email, SMS, mobile push) to students |
| **Amazon Kinesis Data Streams** | Real-time clickstream ingestion at high throughput |

---

## 5. AI / ML Layer

| Category | Technology | Notes |
|---|---|---|
| LLM Provider | **Amazon Bedrock** | Managed API; no GPU provisioning required |
| Primary Model | **Claude Opus 4.6** (via Bedrock) | Agentic chat, grading co-pilot, rubric evaluation |
| Fallback / Cost Tier | **Claude Haiku 4.5** (via Bedrock) | Low-latency, high-volume queries: forum auto-suggest, quick document summaries |
| Embeddings | **Amazon Titan Embeddings V2** | 1536-dim vectors for course material ingestion into OpenSearch |
| LLM Orchestration | **LangGraph** (Python) | Stateful agentic workflows: multi-step RAG, grading pipeline, student intervention routing |
| Prompt Management | **LangSmith** | Prompt versioning, A/B testing, trace visualization |
| ML Training & Inference | **Amazon SageMaker** | At-risk student prediction models; resource ROI regression; custom fine-tuned classifiers |
| Feature Store | **Amazon SageMaker Feature Store** | Reusable student engagement features across multiple model pipelines |
| Experiment Tracking | **MLflow** (on SageMaker) | Metric logging, artifact registry, model versioning |
| Document Parsing | **Amazon Textract** | PDF/DOCX/handwriting extraction from student submissions |
| Document Understanding | **Amazon Comprehend** | Sentiment analysis on forum posts for instructor alerts; keyphrase extraction |
| ETL | **AWS Glue (PySpark)** | Serverless Spark jobs transforming raw Parquet clickstream data for SageMaker |
| Stream Processing | **Amazon Kinesis Data Analytics (Flink)** | Real-time anomaly detection on engagement streams; session windowing |
| Query Engine | **Amazon Athena** | Ad-hoc SQL over the S3 data lake; powers the instructor analytics dashboard |

---

## 6. DevOps & CI/CD

| Category | Technology | Notes |
|---|---|---|
| Version Control | **GitHub** | Monorepo with Turborepo for build orchestration |
| CI/CD Pipeline | **GitHub Actions** | Lint → Test → Build → Synth CDK → Deploy (per-environment) |
| Infrastructure as Code | **AWS CDK v2 (Python)** | All AWS resources defined as code; CDK Pipelines for self-mutating deployments |
| Container Build | **Docker** + **AWS CodeBuild** | Multi-stage builds; BuildKit cache mounts; images pushed to ECR |
| Secret Scanning | **GitHub Advanced Security + Gitleaks** | Pre-commit hook blocks accidental key commits |
| Dependency Management | **Dependabot** + **Renovate Bot** | Automated PRs for dependency updates with test validation |
| Monorepo Tooling | **Turborepo** | Parallel task execution; remote caching via Vercel Remote Cache |
| Package Manager (Frontend) | **pnpm v9** | Efficient disk usage, strict phantom dependency prevention |
| Package Manager (Backend) | **uv** | Fast Python package manager; manages virtualenvs and lockfiles |
| Environment Promotion | **Dev → Staging → Prod** via CDK Stages | Blue/green deployments for ECS; Lambda aliases + traffic shifting for serverless |
| Feature Flags | **AWS AppConfig** | Gradual rollouts for AI features; instant kill-switch without a deploy |

---

## 7. Testing

| Layer | Technology | Notes |
|---|---|---|
| Unit Tests | **Pytest** (Python) / **Vitest** (TS frontend) | Co-located with source files; Pytest for all backend tests |
| Component Tests | **Testing Library (React)** | User-event driven; no implementation detail testing |
| E2E Tests | **Playwright** | Cross-browser; covers full student and instructor user journeys |
| API Tests | **Bruno** | Git-committable API collection; replaces Postman |
| Contract Testing | **Pact** | Consumer-driven contract tests between microservices |
| Load & Performance | **k6** | Simulates enrollment-day traffic spikes; thresholds as code |
| Chaos Engineering | **AWS Fault Injection Service (FIS)** | Lambda throttle injection, Aurora failover drills, AZ outage simulation |
| Accessibility Testing | **axe-playwright** | Automated WCAG 2.1 AA checks in every E2E run |
| Security Scanning | **Snyk** + **Trivy** | SAST, dependency CVE scanning, container image scanning |
| Coverage | **Coverage.py** (backend) / **V8 Coverage** (Vitest frontend) | Enforced minimum thresholds block merge on regression |

---

## 8. Observability & Monitoring

| Category | Technology | Notes |
|---|---|---|
| Distributed Tracing | **AWS X-Ray** + **OpenTelemetry SDK** | End-to-end traces from CloudFront → Lambda → Aurora |
| Metrics & Alarms | **Amazon CloudWatch** | Custom metrics: grading pipeline latency, RAG retrieval hit rate, at-risk flag counts |
| Log Aggregation | **Amazon CloudWatch Logs Insights** + **Fluent Bit** | Structured JSON logs from all services; Fluent Bit sidecar on ECS |
| Dashboards | **Amazon Managed Grafana** | Unified dashboards pulling from CloudWatch, X-Ray, Timestream, and Athena |
| Real-Time Alerting | **Amazon CloudWatch Alarms → SNS → PagerDuty** | P1 alerts (Aurora failover, Lambda error rate spike) with on-call escalation |
| Frontend Observability | **AWS RUM (Real User Monitoring)** | Core Web Vitals, JS errors, session replay |
| Synthetic Monitoring | **Amazon CloudWatch Synthetics** | Canary scripts that run the login → submit assignment flow every 5 minutes |
| Cost Monitoring | **AWS Cost Anomaly Detection** | Alerts on unexpected Bedrock token spend or Kinesis shard scaling |

---

## 9. Security & Compliance

| Category | Technology | Notes |
|---|---|---|
| Threat Detection | **Amazon GuardDuty** | ML-based anomaly detection on CloudTrail, VPC flow logs, DNS logs |
| Vulnerability Management | **Amazon Inspector v2** | Continuous CVE scanning of Lambda function code and ECR images |
| Compliance Auditing | **AWS Security Hub** | Aggregated findings; CIS AWS Foundations Benchmark; FERPA alignment |
| Audit Logging | **AWS CloudTrail (with S3 + Athena)** | Immutable API-level audit log; queryable for compliance investigations |
| Secrets Rotation | **AWS Secrets Manager** | Automatic 30-day rotation for Aurora credentials |
| Data Encryption | **AWS KMS (CMK)** | AES-256 at rest; TLS 1.3 in transit enforced via security policies |
| Network Controls | **AWS WAF v2 + AWS Shield Advanced** | Rate limiting, geo-blocking, OWASP Top 10 rule groups |
| FERPA Compliance | **AWS Artifact** | On-demand access to AWS compliance reports (SOC 2, ISO 27001) |
| Pen Testing Automation | **OWASP ZAP** (in CI) | Automated DAST scan against staging environment on every release |

---

## 10. Data Visualization & BI

| Category | Technology | Notes |
|---|---|---|
| Instructor Analytics Dashboard | **Amazon QuickSight** (embedded) | Native Athena integration; per-seat licensing avoids BI server management |
| Custom Bubble View | **Three.js + React Three Fiber + D3-Force** | Force-directed graph with semantic cluster positioning from OpenSearch k-NN |
| Grade Distribution | **Recharts** | Histogram, boxplot, time-series views built into the gradebook UI |
| Gradebook | **TanStack Table v8** + **Custom React components** | Spreadsheet-style gradebook with inline editing, sticky columns, CSV export |
| Calendar Views | **FullCalendar v6** | Month, week, day, and agenda views for global and per-course calendars |
| Predictive Score Cards | **Custom React components + TanStack Table** | At-risk student lists with sortable engagement metrics |

---

## 11. Developer Experience

> **Environment Mandate:** All backend development must occur inside the `prism-dev` Conda environment (`conda activate prism-dev`). The `environment.yml` in the repo root pins Python 3.12 and all backend dependencies. Never run `uv` or `pip` outside of this active environment.

| Tool | Purpose |
|---|---|
| **Conda** | Python 3.12 version management; single source of truth for the backend runtime environment |
| **ESLint** + **Prettier** | Opinionated code style for frontend; enforced on save and in CI |
| **Ruff** | Extremely fast Python linter and formatter; replaces flake8, isort, black for the backend |
| **mypy** | Strict static type checking for all Python code |
| **Husky** + **lint-staged** | Pre-commit hooks: lint, format, type-check only changed files |
| **Storybook** | Isolated component development and visual regression tests |
| **Chromatic** | Cloud-hosted Storybook + pixel-diff visual regression CI |
| **Nx / Turborepo** | Monorepo task graph; only rebuilds what changed |
| **AWS CDK Watch** | Hot-swaps Lambda function code without a full CloudFormation deploy during development |
| **LocalStack** | Local emulation of S3, DynamoDB, SQS, EventBridge for offline development |
| **Docker Compose** | Spins up local Redis, OpenSearch, and Postgres alongside LocalStack |

---

## Stack at a Glance

```
                    ┌─────────────────────────────────────────────┐
                    │              Students / Instructors          │
                    └────────────────────┬────────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────────┐
                    │   Next.js 15 + React 19 + Tailwind + shadcn  │
                    │   Three.js (Bubble View) · Recharts · TipTap │
                    └────────────────────┬────────────────────────┘
                                         │ CloudFront + WAF
                    ┌────────────────────▼────────────────────────┐
                    │  API Gateway (REST/WS) · AppSync (GraphQL)   │
                    │            Cognito JWT Auth                  │
                    └───┬───────────────────────────┬─────────────┘
                        │                           │
          ┌─────────────▼──────────────────────────▼──────────────┐
          │           Lambda / ECS Fargate (Python 3.12)            │
          │   FastAPI · CRUD · Triggers · AI Jobs · Bulk ETL        │
          └─────────────────────────┬─────────────────────────────┘
                                    │ EventBridge · SQS · Kinesis
          ┌─────────────────────────▼─────────────────────────────┐
          │  Aurora PG · DynamoDB · OpenSearch · ElastiCache Redis  │
          │         S3 Data Lake · Timestream · Glue Catalog        │
          └────────────────────────────┬───────────────────────────┘
                                       │
          ┌────────────────────────────▼───────────────────────────┐
          │          AI / ML Layer                                  │
          │  Bedrock (Claude Opus 4.6 / Haiku 4.5)                  │
          │  Titan Embeddings · LangGraph · SageMaker · Textract    │
          └────────────────────────────────────────────────────────┘
```
