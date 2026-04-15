# Papers

A modern research paper management platform with AI-powered reading assistance, full-text search, and semantic discovery. Organize academic literature with intelligent tagging, threaded discussions, and automatic paper relationship discovery through citations.

## Features

### Paper Organization

- **Multi-source Ingestion**: Import papers directly from URLs (arXiv, ACM, IEEE, OpenReview, PMLR, NeurIPS, etc.) or upload PDFs
- **Hierarchical Groups**: Create nested collection structures to organize papers by topic, project, or custom taxonomy — scoped per user
- **Smart Tagging**: Apply custom tags to papers for flexible filtering and cross-cutting organization — scoped per user
- **Duplicate Detection**: Automatic detection and management of duplicate papers in your library
- **Reading Progress**: Track papers through states (unread, in-progress, read, archived) with reading time estimates

### AI-Powered Reading

- **Chat with Papers**: Ask context-aware questions about any paper and get detailed responses powered by Google Gemini
- **Threaded Conversations**: Create follow-up threads on responses for deeper exploration of specific topics
- **Auto-generated Summaries**: Receive AI-generated summaries upon paper ingestion for quick understanding
- **Key Findings Extraction**: Automatically extract main contributions, methodology, and conclusions
- **Reading Guides**: Get AI-generated guides with questions to guide your reading journey
- **Smart Highlights**: AI suggests important passages to highlight for quick review

### Reading & Annotation

- **Built-in PDF Reader**: Smooth, responsive PDF viewer integrated directly into the application
- **Rich Annotations**: Highlight text and attach notes directly on papers with multiple annotation types
- **Citation Graph**: Visualize connections between papers through extracted citation relationships
- **Bookmarks**: Mark important sections for quick navigation and reference

### Search & Discovery

- **Full-text Search**: Search across all paper content, metadata, and annotations — scoped to your library
- **Semantic Search**: Find papers by meaning using vector embeddings (768-dimensional vectors)
- **Paper Relationships**: Discover related papers through citation extraction and analysis
- **Advanced Filters**: Filter by tags, groups, reading status, publication date, and more

### Export & Integration

- **Multiple Export Formats**: Export papers with metadata in various formats
- **Annotations Export**: Export your annotations and notes separately or with papers

### Multi-user & Auth

- **Google OAuth**: Sign in with your Google account
- **Admin Login**: Local username/password login for administrators (configured via environment variables)
- **Per-user Data Isolation**: All papers, groups, tags, annotations, chat sessions, bookmarks, saved searches, and discovery sessions are fully scoped to the authenticated user
- **Admin Access**: Administrators can view all users' data for support and manage user accounts
- **Persistent Sessions**: Access token stored in localStorage for seamless page refreshes without re-authentication

## Architecture

Papers is a full-stack polyglot application designed for self-hosting.

### Backend

- **Framework**: FastAPI (Python 3.13+) — modern, performant async web framework
- **Database**: PostgreSQL 16 with pgvector extension for vector embeddings
- **ORM**: SQLAlchemy 2.0 with async support for database operations
- **Task Queue**: Celery with Redis broker for background AI tasks and paper processing
- **Vector Search**: pgvector for semantic similarity search using embeddings
- **Auth**: JWT access tokens + httpOnly refresh token cookies; Google OAuth + local admin login
- **Caching**: Redis for session management and task status tracking

### Frontend

- **Framework**: React 19 with TypeScript for type-safe UI development
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: TailwindCSS with a near-monochrome design system (forest-green undertones, mint accent)
- **Data Management**: TanStack Query (React Query) for efficient server state management
- **PDF Viewer**: Integrated PDF.js for in-browser PDF reading
- **Rich Editor**: TipTap for text editing with markdown support and math rendering
- **Theming**: Light and dark mode with adaptive logo and paper card color themes

### Infrastructure

- **Containerization**: Docker and Docker Compose for reproducible deployments
- **Reverse Proxy**: Traefik v2 for routing, SSL termination, and load balancing
- **SSL/TLS**: Automatic Let's Encrypt certificate provisioning and renewal
- **Development**: Includes local Traefik setup for localhost domain routing

## External Dependencies

Papers relies on several third-party services and libraries that need to be configured.

### AI Model Provider

**Google Gemini API** (required for AI features)

- Used for: Paper summaries, key findings extraction, reading guides, smart highlights, threaded conversations
- Configuration: Set `GOOGLE_API_KEY` environment variable
- Get your key: <https://ai.google.dev/>
- Cost: Free tier available with usage limits; pay-as-you-go for higher volumes
- Models used: `gemini-3-flash-preview` for generation, `gemini-embedding-001` for embeddings

### Auth

**Google OAuth** (required for Google sign-in)

- Configuration: Set `GOOGLE_CLIENT_ID` environment variable
- Get your client ID: <https://console.cloud.google.com/>

**Admin Login** (optional local admin account)

- Configuration: Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` as base64-encoded strings
- Example: `echo -n "admin" | base64` → set as `ADMIN_USERNAME`

### Search & Discovery Integration (Optional)

- **Semantic Scholar API**: Academic paper search and citation data
  - Configuration: Set `SEMANTIC_SCHOLAR_API_KEY` (optional — falls back to arXiv)
  - Cost: Free tier available

- **SerpAPI**: General-purpose web search for paper discovery
  - Configuration: Set `SERPAPI_KEY` (optional)
  - Cost: Free tier with limited queries; paid plans available

### Database (PostgreSQL)

- **pgvector Extension**: Enables vector similarity search on embeddings
- **PostgreSQL 16+**: Required for advanced features and performance
- Self-hosted or managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.)

### Infrastructure Services

- **Redis**: In-memory data structure store for task queue and session management
- **Docker**: Container runtime for local and production deployments

## System Requirements

### Local Development

- **Python**: 3.13 or later
- **Node.js**: 18+ or Bun (JavaScript package manager/runtime)
- **PostgreSQL**: 16 with pgvector extension
- **Redis**: 7.0+ for task queue
- **RAM**: Minimum 4GB (2GB backend, 1GB frontend, 1GB services)
- **Storage**: At least 10GB for paper PDFs and database

### Production Server

- **OS**: Linux (Ubuntu 22.04+ recommended) or compatible
- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB+ recommended for 3+ Celery workers)
- **Storage**: 20GB+ SSD for database, papers, and cache
- **Docker**: Docker and Docker Compose installed
- **Domain**: A registered domain with DNS pointing to your server

## Getting Started

### Prerequisites

1. **Get API Keys**
   - Google API Key: <https://ai.google.dev/> (required for AI features)
   - Google Client ID: <https://console.cloud.google.com/> (required for Google sign-in)
   - Optional: Semantic Scholar API, SerpAPI

2. **Install Dependencies**
   - Python 3.13+: <https://www.python.org/downloads/>
   - Node.js 18+ or Bun: <https://nodejs.org/> or <https://bun.sh/>
   - Docker & Docker Compose: <https://www.docker.com/products/docker-desktop>

### Local Development Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd papers

# Create .env file in root directory
cat > .env << EOF
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
SEMANTIC_SCHOLAR_API_KEY=optional_semantic_scholar_key
SERPAPI_KEY=optional_serpapi_key
DB_PASSWORD=your_secure_password
JWT_SECRET_KEY=your_random_secret_key
ADMIN_USERNAME=$(echo -n "admin" | base64)
ADMIN_PASSWORD=$(echo -n "yourpassword" | base64)
EOF

# Start all services with Docker
docker compose up -d

# Run database migrations
docker compose exec backend alembic upgrade head

# Access the application
# Frontend: http://papers.localhost
# Backend API: http://api.localhost
# API Docs: http://api.localhost/docs
# Traefik Dashboard: http://traefik.localhost/dashboard
```

### Local Development (Without Docker)

**Backend:**

```bash
cd backend
uv sync                           # Install dependencies
export GOOGLE_API_KEY=your_key
export GOOGLE_CLIENT_ID=your_client_id
export JWT_SECRET_KEY=your_secret
export ADMIN_USERNAME=$(echo -n "admin" | base64)
export ADMIN_PASSWORD=$(echo -n "yourpassword" | base64)
export DB_HOST=localhost
export DB_NAME=papers
export DEBUG=true
uv run alembic upgrade head      # Run migrations
uv run fastapi dev app/main.py   # Start dev server (localhost:8000)
```

**Frontend:**

```bash
cd frontend-v2
bun install                       # or: npm install
# Create .env file
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env
echo "VITE_GOOGLE_CLIENT_ID=your_google_client_id" >> .env
bun run dev                       # or: npm run dev (localhost:5173)
```

**Celery Worker (optional for background tasks):**

```bash
cd backend
uv run celery -A app.celery_app worker -l info -Q ai,processing,dead_letter
```

**PostgreSQL & Redis:**

```bash
# Using Docker for just services
docker compose up -d postgres redis

# Or install locally and run
# PostgreSQL: createdb papers; psql papers -c "CREATE EXTENSION IF NOT EXISTS vector;"
# Redis: redis-server
```

## Production Deployment

### 1. Prepare Your Server

```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Clone repository
git clone <your-repo-url> /opt/papers
cd /opt/papers
```

### 2. Configure Environment

Create `.env` file in the Papers directory:

```bash
# API Keys
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
SEMANTIC_SCHOLAR_API_KEY=your_optional_api_key
SERPAPI_KEY=your_optional_api_key

# Auth
JWT_SECRET_KEY=your_very_long_random_secret_key
ADMIN_USERNAME=YWRtaW4=        # base64("admin")
ADMIN_PASSWORD=your_base64_password

# Database (choose strong password)
DB_USER=papers_user
DB_PASSWORD=your_very_secure_password_here
DB_NAME=papers

# Let's Encrypt Email (for SSL certificate notifications)
LETSENCRYPT_EMAIL=your-email@yourdomain.com

# Your Domain Configuration
TRAEFIK_DOMAIN=traefik.yourdomain.com
BACKEND_DOMAIN=api.yourdomain.com
FRONTEND_DOMAIN=papers.yourdomain.com
FRONTEND_URL=https://papers.yourdomain.com
```

### 3. Configure DNS

Point your domain's DNS records to your server's IP:

```
traefik.yourdomain.com    A  your.server.ip.address
api.yourdomain.com        A  your.server.ip.address
papers.yourdomain.com     A  your.server.ip.address
```

### 4. Deploy

```bash
cd /opt/papers

# Create directories for persistent data
mkdir -p data/storage letsencrypt

# Start all services
docker compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Verify it's running
curl https://api.yourdomain.com/health
curl https://papers.yourdomain.com
```

## Contributing

This is a personal project. Feel free to fork and customize for your needs.
