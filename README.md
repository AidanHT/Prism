Project Description: Project Prism – Cloud-Native Intelligent LMS Architecture
Executive Summary
Project Prism outlines the engineering architecture for a next-generation Learning Management System (LMS) enhanced by an event-driven AI intelligence layer. Built entirely on an AWS microservices architecture, Prism aims to solve the administrative bottleneck in higher education. It separates the static core infrastructure (data storage, access control, routing) from the dynamic AI workflows (predictive analytics, RAG-based semantic search, autonomous agentic routing), providing a highly performant, scalable solution for enterprise-level university deployments.

Part 1: Core Infrastructure (The Baseline LMS)
Prism's foundational application is designed as a decoupled, serverless web application to handle highly variable traffic loads (e.g., assignment submission deadlines, exam periods) without provisioning idle compute.

1. Frontend & Edge Delivery

Framework: React/Next.js for a highly responsive Single Page Application (SPA).

Hosting & Delivery: Deployed via AWS Amplify, with static assets (CSS, JS, images) cached globally using Amazon CloudFront to ensure sub-100ms load times for the UI.

Authentication: Managed by Amazon Cognito, handling secure JWT-based role-based access control (RBAC) for Students, TAs, Instructors, and Admins.

2. Backend API & Microservices

API Gateway: Amazon API Gateway acts as the primary entry point, routing REST and WebSocket (for real-time chat/forum updates) requests.

Compute Layer: Core CRUD operations (fetching syllabus, submitting assignments) are handled by decoupled AWS Lambda functions (Node.js/Python). Heavier, asynchronous tasks (video transcoding) are offloaded to Amazon ECS (Fargate) containers.

3. Database & Storage Tier

Relational Database: Amazon Aurora PostgreSQL (Serverless v2) handles the highly structured, transactional data requiring ACID compliance (user profiles, gradebook ledgers, course relationships).

NoSQL / Fast-Access Data: Amazon DynamoDB is utilized for high-throughput, unstructured or semi-structured data like Prism's forum threads, session states, and chat logs.

Object Storage: Amazon S3 stores all course materials, lecture videos, and student file submissions.

Part 2: The Intelligence Layer (AWS ML & Data Analytics)
This layer sits on top of Prism's core infrastructure, utilizing AWS Bedrock and streaming analytics to power the platform's autonomous features.

1. Agentic Course Chatbot & Next-Gen Forum (RAG Pipeline)

LLM Orchestration: Amazon Bedrock serves as the central API for foundation models. For the high-speed, agentic chat and dynamic forum auto-suggestions, the pipeline utilizes Claude Opus 4.6 (via Bedrock) to provide highly capable reasoning, deep context windows, and low-latency inference.

Vector Embeddings: Course materials (syllabi, transcripts, previous forum posts) are processed using Amazon Titan Embeddings and stored in Amazon OpenSearch Serverless (Vector Engine).

Semantic Clustering (Bubble View): OpenSearch performs K-Nearest Neighbor (k-NN) searches to instantly group mathematically or conceptually similar student questions, passing the clusters to the frontend to render Prism's visual "Bubble View."

2. Smart Analytics & Predictive Interventions (Data Pipeline)

Clickstream Ingestion: Granular user interactions (video pauses, PDF scroll depth, time-on-page) are streamed in real-time using Amazon Kinesis Data Streams.

Data Lake & ETL: Kinesis buffers the data into an S3 Data Lake. AWS Glue performs serverless ETL (Extract, Transform, Load) operations to clean and structure the behavioral data.

Predictive Analytics: Amazon SageMaker runs lightweight predictive models against this historical data to calculate "Resource ROI" and flag at-risk students based on engagement drop-offs, surfacing these insights to the professor's dashboard via Amazon Athena.

3. Grading Co-Pilot & Anomaly Detection

Document Parsing: Student submissions in PDF/Word format are parsed using Amazon Textract to extract text and handwriting.

Evaluation Engine: The extracted text is sent to Bedrock. The LLM compares the submission against the dynamically generated rubric, returning baseline grading recommendations and feedback.

Variance Tracking: As TAs submit grades, an AWS Lambda trigger runs a statistical variance check against historical TA grading patterns stored in Aurora, flagging anomalies before grades are published.

4. Dynamic Material Synchronization (Event-Driven Updates)

Event Choreography: Amazon EventBridge acts as the central event bus for Prism.

The "Domino Effect": If a professor publishes an announcement changing a due date, the Lambda function processing that announcement emits a DueDateChanged event to EventBridge. This triggers a fan-out to other microservices to automatically update the Aurora database (calendar view), notify the Bedrock RAG pipeline to update its vector index, and send a push notification to students via Amazon SNS.
