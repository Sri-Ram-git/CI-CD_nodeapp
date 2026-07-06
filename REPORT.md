# CI/CD Node.js App — Full Project Report

**Repository:** `https://github.com/Sri-Ram-git/CI-CD_nodeapp.git`  
**Branch:** `main`  
**Score:** 4 / 10

---

## 1. Project Overview

A minimal Node.js Express web server containerized with Docker and deployed via a GitHub Actions CI/CD pipeline. The pipeline builds the Docker image and pushes it to Docker Hub on every push to the `main` branch.

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18 |
| Web Framework | Express 5.2.1 |
| Containerization | Docker |
| CI/CD | GitHub Actions |
| Image Registry | Docker Hub (`mrsridoc/node-ci-app`) |
| Version Control | Git (remote: GitHub) |

---

## 2. Complete File Inventory

### 2.1 `.github/workflows/ci.yml` — GitHub Actions Workflow

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: ["main"]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Login to DockerHub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build Docker Image
        run: docker build -t mrsridoc/node-ci-app .

      - name: Push to Docker Hub
        run: docker push mrsridoc/node-ci-app
```

**Purpose:** The CI/CD pipeline definition.  
**Trigger:** Every push to the `main` branch.  
**Steps (sequential):**
1. Checkout the repository code into the runner
2. Authenticate with Docker Hub using credentials stored in GitHub Secrets (`DOCKER_USERNAME`, `DOCKER_PASSWORD`)
3. Build a Docker image tagged `mrsridoc/node-ci-app`
4. Push the built image to Docker Hub

**Limitations:**
- No testing step before building
- No linting or code quality check
- No security scanning (npm audit, image scan)
- No deployment step — stops at pushing to registry
- No version tagging — always pushes `latest`
- Single job, no parallelism

---

### 2.2 `app.js` — Express Web Server

```javascript
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CI/CD DevOps App</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          text-align: center;
          padding: 40px;
          border-radius: 15px;
          background: rgba(0,0,0,0.4);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
        }
        p {
          font-size: 1.2rem;
          opacity: 0.8;
        }
        .badge {
          margin-top: 20px;
          display: inline-block;
          padding: 10px 20px;
          border-radius: 20px;
          background: #00c9ff;
          color: black;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 CI/CD Pipeline Live</h1>
        <p>Docker + GitHub Actions + Node.js</p>
        <div class="badge">Build Successful ✅</div>
      </div>
    </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

**Purpose:** Single-page web application.  
**Route:** `GET /` — Returns a styled HTML page showing "CI/CD Pipeline Live" with a gradient background and a "Build Successful" badge.  
**Port:** 3000.  
**Limitations:**
- No error handling middleware
- No environment variable configuration for port
- No health check endpoint (`/health`)
- No tests for the route

---

### 2.3 `Dockerfile` — Container Build Definition

```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
```

**Purpose:** Defines how to build the Docker image.  
**Layers:**
1. Base image: `node:18` (full OS, ~900MB)
2. Set working directory to `/app`
3. Copy `package.json` and `package-lock.json` first (for Docker layer caching)
4. Install dependencies (`npm install`)
5. Copy the rest of the source code
6. Document port 3000
7. Command to run the app

**Limitations:**
- Single-stage build — includes dev dependencies and full OS in final image
- Uses `node:18` (Debian-based, ~900MB) instead of `node:18-alpine` (~170MB)
- No `.dockerignore` — could copy unwanted files into the image
- No non-root user — runs as root (security risk)

---

### 2.4 `package.json` — Node.js Project Metadata

```json
{
  "name": "ci-cd_nodeapp",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "express": "^5.2.1"
  }
}
```

**Key facts:**
- Entry point: `app.js`
- Dependency: `express ^5.2.1` (Express 5)
- `test` script is a stub that exits with code 1 — **no tests exist**
- `description` and `author` fields are empty

---

### 2.5 `package-lock.json` — Locked Dependency Tree

- Lockfile version: 3
- Contains the full resolved tree of all Express 5.2.1 transitive dependencies (~50+ packages)
- Ensures reproducible installs across environments

---

### 2.6 `.gitignore` — Git Ignore Rules

```
# dependencies
node_modules/

# environment variables
.env
.env.local
.env.*.local

# secrets / config
*.pem
*.key
*.cert

# logs
*.log
npm-debug.log*

# OS artifacts
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# binary artifacts
*.tar
*.gz
```

**Purpose:** Prevent sensitive/unnecessary files from being committed.  
**Covers:** dependencies, env files, secrets/keys, logs, OS artifacts, IDE config, binary archives.  
**Note:** This was enhanced during cleanup — originally it was empty.

---

### 2.7 Removed Files (Cleaned Up)

| File | Reason for Removal |
|---|---|
| `ci.yml` (root) | Empty duplicate of `.github/workflows/ci.yml` |
| `node-ci-app.tar` | Binary Docker image archive — not meant for version control |

---

## 3. Git History

| Commit | Message | Description |
|---|---|---|
| `e8b6fe3` | Final CI/CD project | Initial commit (on `master`, later renamed to `main`) |
| `87222e8` | removed secrets | Amended out accidentally committed secrets |
| `2ee058d` | update ci file | Updated the workflow file |
| `137c24e` | UI upgrade | Improved the frontend HTML/CSS styling |
| `dd0515e` | cleanup: remove duplicate ci.yml, secure .gitignore | Latest — cleanup and security hardening |

---

## 4. End-to-End Data Flow

```
Developer pushes to main
         │
         ▼
  GitHub Actions triggers
  .github/workflows/ci.yml
         │
         ├── 1. actions/checkout@v3
         │        └── Pulls repo into runner
         │
         ├── 2. docker/login-action@v2
         │        └── Authenticates (DOCKER_USERNAME, DOCKER_PASSWORD)
         │
         ├── 3. docker build -t mrsridoc/node-ci-app .
         │        └── Dockerfile builds image with Node 18 + Express
         │
         └── 4. docker push mrsridoc/node-ci-app
                  └── Image pushed to Docker Hub as latest
```

**Result:** Anyone can run `docker run -p 3000:3000 mrsridoc/node-ci-app` and access the app at `http://localhost:3000`.

---

## 5. Scoring Breakdown: 4/10

### Strengths (The 4 points)

| # | Area | Why It Scores |
|---|---|---|
| 1 | **CI/CD Concept** | Pipeline exists, triggers on push, builds and pushes — core loop works |
| 2 | **Docker Proficiency** | Correct Dockerfile with layer caching, EXPOSE, CMD |
| 3 | **Secrets Management** | Uses GitHub Secrets (not hardcoded creds), amended out leaked secrets from git history |
| 4 | **Security Hardening** | `.gitignore` now blocks env files, keys, certs, logs, binary artifacts |

### Weaknesses (The missing 6 points)

| # | Area | Deficiency |
|---|---|---|
| 1 | **No Tests** | `npm test` exits with error — no quality gate in pipeline |
| 2 | **No Deployment** | Pipeline stops at Docker Hub push — app never runs anywhere |
| 3 | **No Tagging Strategy** | Always `latest` — no version, no commit SHA tag, no rollback |
| 4 | **Single-Stage Docker Build** | Uses full `node:18` (~900MB), no Alpine variant, no multi-stage |
| 5 | **No Code Quality** | No ESLint, Prettier, or any linting step |
| 6 | **No Security Scanning** | No `npm audit`, no Trivy/Snyk/Docker Scout in pipeline |
| 7 | **No PR Workflow** | Only pushes to `main` directly, no branch protection, no code review |
| 8 | **No Health Check** | No `/health` endpoint, no readiness/liveness probe |
| 9 | **No Error Handling** | Express app has no error middleware, no graceful shutdown |
| 10 | **No Documentation** | No `README.md`, no `.env.example`, no setup instructions |
| 11 | **No Environment Config** | Port hardcoded to 3000, no `dotenv` or config module |
| 12 | **No CI Parallelism** | Single job — test, lint, scan, build all sequential |

---

## 6. Roadmap to 10/10

### Phase 1 — Foundation (→ 6/10)

- [ ] **Add tests** — Install Jest + supertest, write test for `GET /` returning 200 + expected HTML
- [ ] **Make test a real pipeline gate** — Add `npm test` before `docker build`
- [ ] **Add `.env.example`** — Document configurable variables
- [ ] **Add `dotenv` + config module** — Make port configurable via environment variable
- [ ] **Add ESLint + Prettier** — Config files + CI linting step
- [ ] **Multi-stage Dockerfile** — Builder stage + `node:18-alpine` final stage
- [ ] **Add `.dockerignore`** — Exclude `node_modules`, `*.md`, `.git`, etc.

### Phase 2 — Pipeline Maturity (→ 8/10)

- [ ] **Split CI into multiple jobs:**
  ```yaml
  jobs:
    lint:
    test:
    audit:
    build:
      needs: [lint, test, audit]
    scan:
      needs: [build]
    deploy:
      needs: [scan]
  ```
- [ ] **Tag Docker image with commit SHA:**
  ```yaml
  docker build -t mrsridoc/node-ci-app:${{ github.sha }} .
  docker tag mrsridoc/node-ci-app:${{ github.sha }} mrsridoc/node-ci-app:latest
  ```
- [ ] **Add `npm audit` step** — fail pipeline on critical vulnerabilities
- [ ] **Add Docker image vulnerability scan** — Trivy or Docker Scout
- [ ] **Run CI on pull requests** (not just push to main)
- [ ] **Add branch protection rules** — require CI pass before merge

### Phase 3 — Full CD (→ 10/10)

- [ ] **Deploy to a real environment:**
  - Option A: SSH into a VPS, pull and restart container
  - Option B: Deploy to AWS ECS / Fargate
  - Option C: Deploy to a PaaS like Render, Railway, or Fly.io
  - Option D: Kubernetes with GitHub Actions + kubeconfig
- [ ] **Add health check after deploy:**
  ```yaml
  - name: Health Check
    run: curl --retry 5 --retry-delay 5 http://<deploy-url>/
  ```
- [ ] **Add `/health` endpoint** to `app.js`
- [ ] **Add graceful shutdown** — handle `SIGTERM` in Express
- [ ] **Add git tag → release workflow** — auto-build and deploy on semver tags
- [ ] **Add monitoring** — uptime check, container restart policy, logging
- [ ] **Comprehensive README:**
  - Project description
  - Architecture diagram
  - Prerequisites (Node, Docker, GitHub account)
  - Local development setup
  - How to configure GitHub Secrets
  - How the CI/CD pipeline works
  - How to deploy and run

---

## 7. Summary

```
Current State:    4/10  →  Working CI/CD skeleton with basic Docker + Express
With Phase 1:     6/10  →  Tested, linted, security-hardened codebase
With Phase 2:     8/10  →  Professional pipeline with staging, scanning, PR workflow
With Phase 3:    10/10  →  Full production-grade CI/CD with deployment, monitoring, docs
```

The project demonstrates a correct understanding of CI/CD fundamentals, but lacks the completeness, safety, and polish expected of a production-ready or standout portfolio project. Each phase above adds a concrete layer of maturity.
