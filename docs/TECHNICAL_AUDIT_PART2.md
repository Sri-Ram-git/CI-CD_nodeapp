# Enterprise CI/CD Pipeline with Automated Rollback — Technical Audit Report (Part 2)

---

## Section 13: Testing

### 13.1 Current Test Coverage

```
Tests:       3 passed, 3 total
Coverage:    74.35% statements, 58.33% functions, 74.35% lines

File       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines
app.js     |   70.58 |      100 |   54.54 |   70.58 | 92-93, 104-107, 112-115
logger.js  |     100 |      100 |     100 |     100 |
```

**What is covered:**
- GET / returns 200 with expected title text
- GET /health returns 200 with correct JSON structure
- GET /version returns 200 with correct app name

**What is NOT covered:**
- Lines 92-93: server listen block
- Lines 104-107: SIGTERM handler
- Lines 112-115: SIGINT handler

**Why not covered:** The `module.exports = app` is exported before `app.listen()`, so the listen block and signal handlers don't run during tests (supertest creates its own server).

### 13.2 How to Run Tests

```bash
# Run all tests with coverage
npm test

# Run in watch mode (development)
npx jest --watch

# Run with specific test file
npx jest tests/app.test.js

# Run with verbose output
npx jest --verbose

# Run without coverage
npx jest --no-coverage
```

### 13.3 Missing Tests

#### Unit Tests to Add

```javascript
// Example: Test error handler
describe("Error Handler", () => {
  it("returns 500 for unhandled errors", async () => {
    const res = await request(app).get("/error");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("status", "error");
  });
});

// Example: Test logger configuration
describe("Logger", () => {
  it("uses LOG_LEVEL env var", () => {
    process.env.LOG_LEVEL = "debug";
    const logger = require("../src/logger");
    expect(logger.level).toBe("debug");
  });
});

// Example: Test graceful shutdown
describe("Graceful Shutdown", () => {
  it("handles SIGTERM without hanging", (done) => {
    const server = require("../src/app").listen(0, () => {
      process.once("SIGTERM", () => {
        // If we reach here without timeout, test passes
        done();
      });
      process.kill(process.pid, "SIGTERM");
    });
  });
});
```

#### Integration Tests
- Full pipeline end-to-end test (requires Docker)
- Test that HEALTHCHECK passes in Docker
- Test graceful shutdown sends response before closing

#### Load Tests (using k6 or autocannon)

```bash
# Install autocannon
npm install -g autocannon

# Run load test
autocannon -c 100 -d 30 http://localhost:3000/health

# Expected output:
# 2xx: 100%, 3xx: 0%, 4xx: 0%, 5xx: 0%
# Latency: avg ~5ms, p95 ~15ms
# Throughput: ~5,000 req/s
```

#### Security Tests
- `npm audit` in CI (already configured)
- Dependency scanning with Snyk or Dependabot
- Container scanning with Trivy (already configured)
- OWASP ZAP for API security scanning

#### Chaos Tests
- Kill container -> verify Docker restart
- Disconnect network -> verify health check failure
- Fill memory -> verify OOM kill and restart

---

## Section 14: Debugging

### 14.1 Local Debugging

#### Debugging the App

```bash
# Run in development mode (pretty-printed logs)
NODE_ENV=development node src/app.js

# Run with debug logging
LOG_LEVEL=debug node src/app.js

# Run with Node.js inspector
node --inspect src/app.js
# Open chrome://inspect in Chrome

# Run with nodemon (auto-restart on changes)
npx nodemon src/app.js
```

#### Debugging Tests

```bash
# Run tests with verbose output
npx jest --verbose

# Run specific test
npx jest -t "returns 200 and contains CI/CD Pipeline Live"

# Run tests with coverage and see uncovered lines
npx jest --coverage --coverageReporters=text

# Debug tests with inspector
node --inspect node_modules/.bin/jest --runInBand
```

### 14.2 Docker Debugging

```bash
# Build the image locally
docker build -t node-ci-app-debug .

# Run container interactively
docker run -it --rm -p 3000:3000 node-ci-app-debug sh

# Check container logs
docker logs ci-cd-nodeapp
docker logs -f ci-cd-nodeapp  # Follow mode

# Execute commands inside running container
docker exec -it ci-cd-nodeapp sh

# Inspect container health status
docker inspect ci-cd-nodeapp --format='{{json .State.Health}}'

# Test health endpoint from inside container
docker exec ci-cd-nodeapp wget -qO- http://localhost:3000/health

# Check container resource usage
docker stats ci-cd-nodeapp
```

### 14.3 GitHub Actions Debugging

```bash
# Enable diagnostic logging
# Add to workflow:
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true

# Re-run failed jobs with debug logging
# GitHub UI: Actions -> failed run -> Re-run jobs -> Re-run with debug
```

#### Common GitHub Actions Failures

| Failure | Root Cause | Fix |
|---|---|---|
| npm ci fails | package-lock.json out of sync | Run npm install and commit lockfile |
| Docker build fails | Docker daemon out of memory | Use larger runner |
| SSH deploy fails | SSH key not configured | Check GitHub Secrets |
| Docker push fails | Docker Hub credentials invalid | Reset Docker Hub token |
| Trivy scan fails | CRITICAL vulnerability found | Fix or suppress known issue |

### 14.4 Common Failures and Solutions

#### Application Failures

**Failure:** Container exits immediately after start
**Root Cause:** App crashed on startup (port in use, missing dependency)
**Solution:**
```bash
docker logs ci-cd-nodeapp
docker run --rm -p 3000:3000 mrsridoc/node-ci-app
netstat -an | grep 3000
```

**Failure:** Health check failing
**Root Cause:** App is running but not healthy
**Solution:**
```bash
curl http://localhost:3000/health
docker logs ci-cd-nodeapp
docker exec ci-cd-nodeapp env | grep -E "PORT|NODE|APP"
```

#### Pipeline Failures

**Failure:** npm test fails in CI but passes locally
**Root Cause:** Environment differences (Node version, OS)
**Solution:**
```bash
nvm use 18
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Failure:** Docker build fails in CI
**Root Cause:** Build context too large, Docker Hub timeout
**Solution:** Ensure .dockerignore is correct, use cache-from

---

## Section 15: Error Handling

### 15.1 Runtime Error Scenarios

| Scenario | Error | Effect | Recovery |
|---|---|---|---|
| Port in use | EADDRINUSE | Server fails to start | Change PORT or kill existing process |
| Missing dependency | MODULE_NOT_FOUND | App crashes on startup | Run npm ci |
| Unhandled promise rejection | UnhandledRejection | Node.js warning | Add process.on('unhandledRejection') |
| Out of memory | JavaScript heap OOM | Process killed | Increase memory limit or fix leak |
| Disk full | ENOSPC | Cannot write logs | Clear logs, increase disk |

### 15.2 Deployment Failures

**Scenario:** docker pull fails
- Cause: Docker Hub down, image tag doesn't exist, network issue
- Effect: Deploy script exits (set -e)
- Recovery: Retry, check Docker Hub status, verify tag exists

**Scenario:** Container fails to start
- Cause: Invalid environment variables, app crash
- Effect: docker run succeeds but container exits immediately
- Recovery: Health check detects failure -> rollback triggers

**Scenario:** Health check fails after deployment
- Cause: App not responding, wrong port, firewall
- Effect: Deploy script exits 1 -> rollback job triggers
- Recovery: Automatic rollback to previous version

### 15.3 Rollback Failures

**Scenario:** Previous tag not found
- Cause: Docker Hub API returns no results, first deployment
- Effect: Rollback script uses "latest" fallback, which is the same broken version
- Recovery: Manual intervention with known-good image

**Scenario:** Rollback health check also fails
- Cause: Both new and old versions are broken
- Effect: Script exits 1, manual intervention required
- Recovery: SSH to server, manually deploy known-good image from backup

### 15.4 Recovery Process

```mermaid
flowchart TD
    A[Deployment Fails] --> B{Rollback Triggered?}
    B -->|Yes| C[Rollback to Previous Tag]
    B -->|No| D[Manual Debug]
    C --> E{Rollback Health Check}
    E -->|Passes| F[Rollback Successful]
    E -->|Fails| G[Manual Intervention]
    G --> H[SSH to Server]
    H --> I[Identify Working Image]
    I --> J[Manual docker pull/run]
    J --> K[Verify Health]
    F --> L[Notify Team]
```

---

## Section 16: Performance

### 16.1 Performance Characteristics

| Metric | Value | Notes |
|---|---|---|
| App startup time | ~500ms (Alpine) | vs ~3s (Debian) |
| Request latency (p50) | <5ms | Simple route handlers |
| Request latency (p95) | <15ms | Under normal load |
| Memory (idle) | ~35MB | Node.js baseline |
| Memory (under load) | ~50-80MB | 100 concurrent requests |
| CPU (idle) | ~0% | Event-driven, no polling |
| Throughput | ~5,000 req/s | Single instance, limited testing |
| Image size | ~190MB | Multi-stage Alpine |

### 16.2 Bottlenecks

1. **Single-threaded Node.js** — CPU-intensive operations block the event loop
2. **Synchronous health check** — No async dependency checking
3. **No connection pooling** — Each request is handled independently
4. **No caching** — Every request hits the handler fresh

### 16.3 Scaling Recommendations

| Strategy | Complexity | Impact |
|---|---|---|
| Horizontal scaling (Kubernetes) | Medium | Linear throughput increase |
| PM2 cluster mode | Low | Multi-core utilization |
| Nginx caching | Medium | Reduce request load |
| Redis caching | High | Cache frequent responses |
| Connection keep-alive | Low | Reduce TCP overhead |

### 16.4 Monitoring Commands

```bash
# Check memory usage
docker stats ci-cd-nodeapp

# Check CPU usage
docker stats --no-stream ci-cd-nodeapp | awk '{print $3}'

# Check Node.js heap usage
docker exec ci-cd-nodeapp node -e "console.log(process.memoryUsage())"

# Load testing with autocannon
npx autocannon -c 100 -d 30 http://localhost:3000/health
```

---

## Section 17: DevOps Best Practices

### 17.1 Practices Followed

| Practice | Implementation | Status |
|---|---|---|
| Infrastructure as Code | Docker, Docker Compose, K8s YAML | Yes |
| CI/CD | GitHub Actions pipeline | Yes |
| Immutable artifacts | Docker images with SHA tags | Yes |
| Principle of Least Privilege | Non-root container user | Yes |
| Shift left security | Lint, test, audit in CI | Yes |
| Health checks | Docker HEALTHCHECK, K8s probes | Yes |
| Graceful shutdown | SIGTERM/SIGINT handlers | Yes |
| Structured logging | Pino JSON output | Yes |
| Observability | Prometheus + Grafana | Yes |
| Dependency pinning | package-lock.json, npm ci | Yes |
| Secret management | GitHub Secrets | Yes |
| Automated rollback | Rollback job on failure | Yes |

### 17.2 Practices Missing

| Practice | Why Missing | Impact | Effort to Add |
|---|---|---|---|
| Terraform / Pulumi | Infrastructure not provisioned by code | Manual server setup | 1 week |
| Blue-green deployment | Single server target | Brief downtime during deploy | 2 weeks |
| Canary releases | No traffic splitting | Full risk on every deploy | 1 month |
| Feature flags | No flag management tool | Code changes directly visible | 1 week |
| Database migrations | App is stateless | N/A if app stays stateless | N/A |
| Chaos engineering | No chaos experiments | Unknown failure modes | 1 month |
| SLO/SLI monitoring | No formal SLO definitions | No reliability targets | 1 week |

### 17.3 Enterprise vs Current Comparison

| Aspect | Enterprise Standard | Current Implementation | Gap |
|---|---|---|---|
| Environment parity | Dev/Staging/Prod identical | Dev (compose) + Prod (SSH) | Missing staging |
| Deployment strategy | Blue-green or canary | Stop-start (downtime) | Significant |
| Secret rotation | Automated rotation | Manual GitHub Secrets | Low risk |
| Monitoring | Full observability stack | Prometheus config only | Needs app metrics |
| Alerting | PagerDuty/Opsgenie | Slack only | Medium |
| Disaster recovery | Multi-region, RTO < 1h | Single server | Critical gap |
| Access control | RBAC, SSO, audit logs | SSH key per server | Growing need |

---

## Section 18: Design Patterns

### 18.1 Software Design Patterns

| Pattern | Location | Purpose |
|---|---|---|
| Middleware (Chain of Responsibility) | app.js:8-16, app.js:62-67 | Request logging and error handling are Express middleware that process requests sequentially |
| Module Pattern | logger.js | Encapsulates logger configuration in a single exported module |
| Singleton | logger instance | Single logger instance shared across the app |
| Observer | res.on("finish", ...) | Listens for response completion event |
| Factory | express() | Express creates the app instance |
| Strategy | Pino transport selection | Different logging output based on NODE_ENV |

### 18.2 Architectural Patterns

| Pattern | Implementation |
|---|---|
| Layered Architecture | Routes -> Middleware -> Error Handler |
| Microservices-ready | Stateless app, containerized, API-based |
| Event-Driven | Graceful shutdown, request logging on finish event |
| Twelve-Factor App | Config via env vars, logs as streams, disposability |

### 18.3 DevOps Patterns

| Pattern | Implementation |
|---|---|
| Pipeline as Code | GitHub Actions YAML in version control |
| Immutable Infrastructure | Docker containers, never mutate server |
| Infrastructure as Code | Dockerfile, docker-compose, K8s YAML |
| Shift Left | Lint/test/audit run before build |
| Self-Healing | Docker restart policy, K8s liveness probes |
| Rollback Pattern | Automatic rollback on health check failure |

---

## Section 19: Dependencies

### 19.1 Production Dependencies

| Package | Version | Purpose | Size | Alternatives |
|---|---|---|---|---|
| express | ^5.2.1 | HTTP framework | ~2MB | Fastify (faster), Koa (lighter), Hapi (more features) |
| pino | ^9.0.0 | Structured logging | ~1MB | Winston (popular), Bunyan (JSON-native) |
| pino-pretty | ^11.0.0 | Dev log formatting | ~0.5MB | (dev dependency in practice) |

**Why Express 5?**
- Express 5 is the latest major version (vs Express 4)
- Native async error handling (no need for express-async-errors)
- Path matching improvements
- **Risk:** Express 5 has fewer community resources than Express 4

**Why Pino over Winston?**
- 5x faster throughput
- Lower memory overhead
- JSON by default (no wrapper needed)
- Large plugin ecosystem

### 19.2 Dev Dependencies

| Package | Version | Purpose | Alternatives |
|---|---|---|---|
| jest | ^29.7.0 | Test framework | Mocha + Chai, Vitest, Ava |
| supertest | ^7.0.0 | HTTP assertion library | node-fetch + assert, chai-http |
| eslint | ^8.57.0 | Static analysis | JSHint, standard, biome |
| prettier | ^3.2.0 | Code formatting | standard (auto-formatter), eslint --fix |

### 19.3 Security Risks from Dependencies

| Risk | Severity | Mitigation |
|---|---|---|
| Express 5 is new | Medium | Fewer security audits than Express 4 |
| Pino dependencies | Low | Well-maintained, active community |
| ESLint 8 (not 9) | Low | LTS version |
| Transitive dependencies | Medium | Mitigated by npm audit + Trivy |

---

## Section 20: Interview Preparation

### 20.1 Beginner Questions (First 20 of 100)

**Q1: What is this project?**
A: This is a CI/CD pipeline built around a Node.js Express application. It automates building, testing, scanning, deploying, and rolling back containerized applications using GitHub Actions, Docker, and Docker Hub.

**Q2: What is Node.js?**
A: Node.js is a JavaScript runtime built on Chrome's V8 engine that allows running JavaScript on the server side, outside of a browser. It uses an event-driven, non-blocking I/O model.

**Q3: What is Express?**
A: Express is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications — middleware, routing, and error handling.

**Q4: What is a middleware?**
A: Middleware functions have access to the request object (req), response object (res), and the next middleware function in the application's request-response cycle. They can execute code, modify req/res, end the cycle, or call the next middleware.

**Q5: What does `npm ci` do?**
A: `npm ci` performs a clean installation of dependencies exactly as specified in package-lock.json. It's faster than `npm install` and fails if the lockfile is out of sync with package.json.

**Q6: What is Docker?**
A: Docker is a containerization platform that packages applications and their dependencies into lightweight, portable containers that can run consistently across any environment.

**Q7: What is a Dockerfile?**
A: A Dockerfile is a text file containing instructions to build a Docker image. Each instruction creates a layer in the image.

**Q8: What is the difference between COPY and ADD in Docker?**
A: Both copy files from the host to the container. ADD additionally supports URL downloads and automatic tar extraction. Best practice is to use COPY unless you specifically need ADD features.

**Q9: What is GitHub Actions?**
A: GitHub Actions is a CI/CD platform that automates software workflows directly from GitHub repositories using YAML files to define jobs and steps.

**Q10: What is a workflow?**
A: A workflow is an automated process defined in YAML that runs one or more jobs when triggered by events like push, pull request, or schedule.

**Q11: What is the difference between a job and a step?**
A: A job is a group of steps that run on the same runner. Steps are individual commands or actions within a job.

**Q12: What is a Docker image vs a container?**
A: An image is a lightweight, standalone, executable package. A container is a runtime instance of an image.

**Q13: What does EXPOSE do in a Dockerfile?**
A: EXPOSE documents which port the container listens on. It does not publish the port — that requires `-p` flag during `docker run`.

**Q14: What does the WORKDIR instruction do?**
A: WORKDIR sets the working directory for subsequent RUN, CMD, ENTRYPOINT, COPY, and ADD instructions.

**Q15: What is the HEALTHCHECK instruction?**
A: HEALTHCHECK tells Docker how to test if a container is working. Docker uses the exit code of the health check command.

**Q16: What is a pull request?**
A: A pull request is a GitHub feature that proposes changes to a repository, enabling code review before merging.

**Q17: What is a linter?**
A: A linter is a tool that analyzes source code to flag programming errors, bugs, stylistic errors, and suspicious constructs.

**Q18: What is a test framework?**
A: A test framework provides tools for writing and running automated tests, including assertions, mocks, and reporting.

**Q19: What is Jest?**
A: Jest is a JavaScript testing framework developed by Facebook, known for zero configuration, built-in coverage, and snapshot testing.

**Q20: What is Supertest?**
A: Supertest is a library for testing HTTP servers in Node.js. It wraps the app and allows making HTTP requests in tests without binding to a network port.

### 20.2 Intermediate Questions (First 20 of 100)

**Q1: Why multi-stage Docker builds?**
A: Multi-stage builds use multiple FROM statements to create a builder stage (with all build tools) and a final stage (with only runtime essentials). This reduces final image size dramatically — from ~900MB to ~190MB.

**Q2: Why use Alpine Linux for the base image?**
A: Alpine Linux is ~5MB compared to Debian's ~150MB. It has a minimal attack surface (fewer packages = fewer CVEs). Combined with Node.js, node:18-alpine is ~170MB vs node:18 at ~900MB.

**Q3: What does USER appuser do and why is it important?**
A: It runs the container as a non-root user. If an attacker compromises the container, they don't have root access, limiting their ability to install software, modify system files, or escalate privileges.

**Q4: How does the request logging middleware work?**
A: It captures Date.now() at the start, registers a "finish" event listener on the response, calls next() to continue, and when the response completes, calculates duration and logs a structured JSON entry.

**Q5: What is the difference between liveness and readiness probes in Kubernetes?**
A: Liveness probes determine if a pod should be restarted. Readiness probes determine if a pod should receive traffic. A pod can be alive but not ready.

**Q6: How does the rollback determine which tag to roll back to?**
A: It queries the Docker Hub API for the two most recent tags, sorted by last_updated. results[0] is the current tag, results[1] is the previous tag (rollback target).

**Q7: What is the purpose of the .dockerignore file?**
A: It excludes files from the Docker build context, preventing unnecessary files from being sent to the Docker daemon, speeding builds and reducing image size.

**Q8: Why `npm ci --only=production`?**
A: --only=production installs only dependencies listed in dependencies, not devDependencies. This excludes test frameworks and linters from the production image.

**Q9: What happens when a Docker HEALTHCHECK fails?**
A: After 3 consecutive failures (as configured), Docker marks the container as unhealthy. Docker doesn't automatically restart unhealthy containers — that requires --restart unless-stopped.

**Q10: Why is continue-on-error: true used on the deploy job?**
A: Without it, a failed deploy would immediately fail the entire workflow, preventing the rollback job from running. With continue-on-error, the deploy job records a failure outcome without failing the workflow.

**Q11: How does Pino's transport system work?**
A: Pino uses worker threads for transports to avoid blocking the main thread. pino-pretty runs in a separate thread, formatting JSON logs for human readability.

**Q12: What is the purpose of the needs keyword in GitHub Actions?**
A: needs creates a dependency between jobs. A job only runs after all its dependencies complete successfully.

**Q13: What does the if condition `always() && needs.deploy.result == 'failure'` mean?**
A: always() tells GitHub Actions to run the job even if upstream jobs failed. The second condition checks if the deploy job specifically failed (not skipped or cancelled).

**Q14: How does the request logger measure request duration?**
A: It captures Date.now() before the request is processed, then subtracts it from Date.now() when the response "finish" event fires. The difference is the duration in milliseconds.

**Q15: What is the significance of module.exports = app being before app.listen()?**
A: It allows Supertest to import the app and create its own test server, avoiding port conflicts and enabling parallel test execution.

**Q16: Why use `docker run --rm --network host curlimages/curl` for health checks?**
A: The --rm flag auto-removes the container. --network host allows localhost access from inside the container. curlimages/curl is a minimal 5MB image with just curl.

**Q17: What is the difference between `package.json` and `package-lock.json`?**
A: package.json specifies version ranges (e.g., ^1.0.0). package-lock.json locks exact versions for every transitive dependency, ensuring reproducible installs.

**Q18: What is the purpose of the environment keyword in GitHub Actions?**
A: It enables GitHub Environments features: required reviewers, deployment tracking, environment-specific secrets, and protection rules.

**Q19: How does `|| true` work in shell scripts for Docker?**
A: `command || true` ensures the script continues even if the command fails. Used for docker stop/rm on first deployment when no container exists.

**Q20: Why is `wget --spider` used for health checks instead of `curl`?**
A: --spider mode checks if the URL exists without downloading the content. It's faster and uses less memory than a full HTTP request.

### 20.3 Advanced Questions (First 20 of 100)

**Q1: How would you implement blue-green deployment with this project?**
A: I would modify the deploy script to run two containers on different ports (blue and green). Nginx would switch traffic to the new version after health check passes. Rollback would switch traffic back without stopping the old version. This requires dynamic Nginx config updates and shared external volumes.

**Q2: How would you handle database migrations during deployment?**
A: Add a pre-deploy step that runs migrations before starting the new container. If migrations fail, the deploy stops and rollback triggers. The migration script must be idempotent and backward-compatible with the old version.

**Q3: How would you implement canary releases?**
A: Use a Service Mesh (Istio/Linkerd) or an Ingress controller supporting traffic splitting. Deploy 10% of pods with the new version, monitor error rates for 5 minutes, then gradually increase to 100%.

**Q4: How would you add end-to-end encryption (TLS)?**
A: Add Nginx as a sidecar or ingress with Let's Encrypt certificates. Nginx terminates TLS and proxies to the app container on localhost. Use cert-manager in Kubernetes for automatic certificate renewal.

**Q5: How would you handle secrets rotation?**
A: Implement HashiCorp Vault or AWS Secrets Manager. The application authenticates to Vault at startup, retrieves secrets, and caches them in memory with periodic refresh. GitHub Actions retrieve short-lived tokens from Vault.

**Q6: How would you implement distributed tracing?**
A: Add OpenTelemetry instrumentation to Express via @opentelemetry/instrumentation-http and @opentelemetry/instrumentation-express. Export traces to Jaeger or Grafana Tempo. Each request gets a trace ID.

**Q7: How would you optimize the Docker build for a monorepo?**
A: Use Docker buildx's --build-context to share dependency layers across multiple images. Implement a base image with common dependencies. Use GitHub Actions cache with type=gha for faster builds across workflow runs.

**Q8: How would you implement policy-as-code for this pipeline?**
A: Add Open Policy Agent (OPA) or Kyverno to evaluate policies like "all images must pass Trivy scan", "deployments must have probes", and "images must be signed with Cosign".

**Q9: How would you implement cost monitoring for Docker Hub?**
A: Add a weekly GitHub Actions workflow that queries Docker Hub API for image pull counts and storage usage. Export to a cost-analysis dashboard in Grafana.

**Q10: How would you handle zero-downtime deployments with SSH-based approach?**
A: Run two containers simultaneously (v1 and v2). Use a shared Nginx container with dynamic config. On deploy: pull and start v2, wait for health check, update Nginx config to point to v2, reload Nginx (zero-downtime), stop v1.

**Q11: How does Node.js event loop interact with the request logger?**
A: The res.on("finish") callback is a microtask that runs after the current I/O operation completes. The event loop processes it in the poll phase, ensuring it doesn't block the main request handling.

**Q12: What happens if the Docker HEALTHCHECK uses wget but Alpine doesn't have wget?**
A: The node:18-alpine image includes wget. If using a minimal image without wget, use curl instead or install wget in the Dockerfile.

**Q13: How would you modify the pipeline to support multiple environments?**
A: Add environment-specific jobs (deploy-staging, deploy-prod) with different target servers and promotion gates. Use GitHub Environments for each stage.

**Q14: What is the security implication of docker run --network host?**
A: --network host gives the container full access to the host network stack. The container can access any port on the host. Only use for debugging/admin tasks, never for production containers.

**Q15: How would you implement image signing?**
A: Use Cosign to sign Docker images after build. Store the public key in GitHub Secrets. Verify signatures in the deploy job before pulling.

**Q16: How does the Trivy scanner know about vulnerabilities?**
A: Trivy maintains a local vulnerability database updated from multiple sources: NVD, Red Hat, Alpine, Debian, and GitHub Advisory Database. It compares package versions against this database.

**Q17: What happens if the rollback Docker Hub API call fails?**
A: The curl command would fail. Since no || true is used, the job fails and GitHub Actions reports a failure. The rollback doesn't execute.

**Q18: How would you improve the rollback tag resolution?**
A: Store the current production tag in a GitHub Environment variable. On successful deploy, update the variable. On rollback, read the previous value. This guarantees correct rollback target.

**Q19: What is the performance impact of Pino's transport system?**
A: Pino transports run in worker threads, so logging doesn't block the main thread. The main thread queues log entries and the worker processes them asynchronously.

**Q20: How would you add Prometheus metrics to the Express app?**
A: Use prom-client library to create metrics like http_request_duration_seconds, http_requests_total, and active_connections. Register a /metrics endpoint that Prometheus scrapes.

### 20.4 Scenario-Based Questions (First 10 of 50)

**Scenario 1: \"The deployment is stuck. What do you check first?\"**
A: First check GitHub Actions logs to see which job is failing. Then check SSH connection, Docker daemon status, container logs, disk space, and port availability.

**Scenario 2: \"The health check is failing after deployment. What could be wrong?\"**
A: App crashed on startup (check logs), port 3000 blocked by firewall, app starting slowly (increase start-period), environment variable misconfiguration, or dependencies failed.

**Scenario 3: \"The rollback brought down the app instead of fixing it.\"**
A: The previous tag is also broken. SSH to server, manually pull and run a known-good image, identify what changed in tags, and implement a stable release branch.

**Scenario 4: \"npm audit found a critical vulnerability. What do you do?\"**
A: Check if the vulnerability affects our code, update the dependency, use overrides in package.json if npm audit fix doesn't work, enable Dependabot for automatic PRs.

**Scenario 5: \"The SSH key for deployment was compromised. What's your response?\"**
A: Revoke the compromised key immediately, generate a new ed25519 key pair, update the public key on the server, update GitHub Secrets, audit SSH logs, implement key rotation policy.

**Scenario 6: \"The Docker build is taking 10+ minutes. How would you speed it up?\"**
A: Ensure proper layer caching (package.json changes infrequently), use Docker BuildKit with registry cache, optimize .dockerignore to minimize build context, use larger GitHub runner.

**Scenario 7: \"A developer pushed a breaking change to main. The pipeline passed but prod is broken.\"**
A: The tests didn't cover the breaking scenario. Add more comprehensive tests (integration, E2E), implement staging environment with mirror traffic, add feature flags for gradual rollout.

**Scenario 8: \"The monitoring stack shows increased error rates after deployment. What do you check?\"**
A: Check application logs for error patterns, check health endpoint response, compare current version metrics with previous version, check resource usage (CPU, memory), check upstream dependencies.

**Scenario 9: \"The pipeline is failing due to flaky tests. How do you handle it?\"**
A: Identify flaky tests by analyzing failure patterns, add retry logic for known flaky tests (Jest --retryTimes), quarantine flaky tests in a separate job that doesn't block deploy, fix root cause.

**Scenario 10: \"How do you ensure secrets are never exposed in GitHub Actions logs?\"**
A: GitHub Actions automatically masks secrets in logs. Audit logs for accidental exposure, use dedicated secret scanning tools (GitHub secret scanning, truffleHog), educate developers on best practices.

### 20.5 HR + Project Questions (First 10 of 50)

**Q1: \"Describe this project in 2 minutes.\"**
A: \"This is an enterprise-grade CI/CD pipeline built around a Node.js Express application. The pipeline automatically lints, tests, audits dependencies, builds a multi-stage Docker image, scans for vulnerabilities, deploys to production, and verifies health. The key feature is automatic rollback — if health check fails, it reverts to the previous version and notifies the team via Slack.\"

**Q2: \"What was the hardest problem you solved?\"**
A: \"The rollback mechanism. The challenge was determining the correct previous tag. I initially tried semantic versioning, but that required manual version bumps. The solution uses the Docker Hub API to find the second-most-recent tag by update time, combined with GitHub's commit SHA as an immutable tag.\"

**Q3: \"What would you improve if you had more time?\"**
A: \"Three things: blue-green deployment to eliminate downtime, actual Prometheus metrics instrumentation in the app, and Terraform to provision the infrastructure as code.\"

**Q4: \"How does this project demonstrate DevOps principles?\"**
A: \"It demonstrates CI/CD automation, Infrastructure as Code (Docker, K8s, compose), shift-left security (lint, test, audit before build), immutable infrastructure (container images), observability (logs, metrics, health checks), and self-healing (rollback, restart policies).\"

**Q5: \"What testing strategy did you implement?\"**
A: \"I implemented unit and integration tests with Jest and Supertest covering all three endpoints. The tests assert response status codes and JSON structure. Coverage is 74% — the uncovered lines are server startup and signal handlers that don't run in test mode.\"

**Q6: \"How would you deploy this in a team setting?\"**
A: \"The pipeline already supports pull requests — lint and test run on PRs, while the full pipeline including deploy runs on push to main. I would add branch protection rules requiring CI passes before merge, and use GitHub Environments with required reviewers for production deployments.\"

**Q7: \"What monitoring is in place?\"**
A: \"The application has structured JSON logging with Pino for log aggregation. Docker HEALTHCHECK monitors the /health endpoint. Prometheus and Grafana are configured for metrics collection and visualization. Kubernetes liveness and readiness probes provide pod-level health monitoring.\"

**Q8: \"How did you handle security?\"**
A: \"Multiple layers: npm audit for dependency vulnerabilities, Trivy for container image scanning, non-root user in Docker, .dockerignore to exclude sensitive files, .gitignore to block credentials, GitHub Secrets for all credentials, and no hardcoded secrets.\"

**Q9: \"What would you do differently if starting from scratch?\"**
A: \"I would use TypeScript instead of JavaScript for type safety, add database integration to make the app more realistic, implement Terraform for infrastructure provisioning from the start, and use ArgoCD for GitOps-based Kubernetes deployments.\"

**Q10: \"Who is the target audience for this project?\"**
A: \"DevOps Engineers and Platform Engineers as a reference architecture, Software Engineers learning CI/CD practices, and interviewers evaluating DevOps skills. The project is designed to be discussed confidently in FAANG-level technical interviews.\"

### 20.6 Cross Questions (First 10 of 50)

**Q1: \"Compare your approach to ArgoCD. When would you use each?\"**
A: \"My pipeline is push-based — GitHub Actions pushes the deployment. ArgoCD is pull-based — it watches Git and syncs the cluster. My approach is simpler for single-server. ArgoCD is better for Kubernetes with GitOps. For a startup, my pipeline is faster to set up. For 50+ microservices, ArgoCD is more scalable.\"

**Q2: \"How would this differ if you used GitLab CI?\"**
A: \"Concepts are identical — jobs, stages, artifacts, caching. GitLab CI has a built-in container registry (no Docker Hub login). GitLab's environment management is more mature (auto rollback, deploy boards). GitHub Actions has a better marketplace and simpler YAML.\"

**Q3: \"How would you add Terraform to this project?**\"
A: \"Create a terraform/ directory with modules for compute (EC2), network (VPC, security groups), DNS (Route53), and monitoring. State stored in S3 with DynamoDB locking. CI runs terraform plan first, then applies, then deploys the app.\"

**Q4: \"Express vs Fastify — which is better and why did you choose Express?\"**
A: \"Fastify is 2x faster and has schema-based validation. I chose Express because it has the largest ecosystem, the most community resources, and is most commonly used in enterprise Node.js apps. For a portfolio project targeting FAANG interviews, Express is more recognizable.\"

**Q5: \"Pino vs Winston — when would you choose Winston?\"**
A: \"Winston is better when you need custom transports (database, file, email) without additional libraries. Winston has more built-in formatting options. I chose Pino for this project because of its 5x performance advantage and JSON-native output.\"

**Q6: \"How would you convert this to a TypeScript project?\"**
A: \"Add tsconfig.json, install typescript and @types/express, rename files to .ts, add build script (tsc), update Dockerfile to build TypeScript and run compiled JS. The pipeline would add tsc --noEmit for type checking in the lint job.\"

**Q7: \"Docker vs Podman — what's the difference and would you switch?\"**
A: \"Podman is daemonless, runs rootless by default, and supports Kubernetes YAML generation. Docker has better ecosystem support and is more widely used. I would stick with Docker for compatibility with GitHub Actions and Docker Hub.\"

**Q8: \"Nginx vs Traefik — when would you use Traefik?\"**
A: \"Traefik is better for dynamic environments where services are added/removed frequently (auto-discovers from Docker labels or K8s annotations). Nginx is better for static configurations and when you need fine-grained control over routing rules.\"

**Q9: \"Multi-stage vs distroless images — which is more secure?\"**
A: \"Distroless images contain only the application and its runtime dependencies — no shell, no package manager, no utilities. This reduces the attack surface further. However, debugging is harder (no shell access). For production, distroless is more secure. For development, multi-stage Alpine is better.\"

**Q10: \"Jest vs Vitest — which is faster and why?\"**
A: \"Vitest is significantly faster because it uses Vite's transform pipeline and native ESM. Jest is more mature with a larger ecosystem. For this project's scale, the performance difference is negligible. I chose Jest for its wider adoption and community support.\"

---

## Section 21: How to Present This Project

### 21.1 Two-Minute Version (Recruiter / General Audience)

\"**What is it?** An automated system that builds, tests, and deploys a web application whenever code changes are pushed.

**How does it work?** When a developer pushes code to GitHub, an automated pipeline runs. It checks code quality, runs tests, scans for security vulnerabilities, builds a Docker container, and deploys it to a server. If the deployment fails, it automatically reverts to the previous working version.

**Why is it impressive?** It demonstrates end-to-end DevOps — from code to production — with enterprise-grade safety features like automatic rollback, security scanning, and monitoring.\"

### 21.2 Five-Minute Version (Technical Interviewer)

\"**Architecture:** A Node.js Express application with 3 endpoints serving HTML and JSON. The app is containerized using a multi-stage Docker build — Alpine Linux reduces image size from 900MB to 190MB, and a non-root user improves security.

**Pipeline:** The GitHub Actions workflow has 7 jobs: lint, test, audit, build, scan, deploy, notify. Lint, test, and audit run in parallel. After building and pushing the Docker image with 3 tags (SHA, latest, version), a Trivy scan checks for CVEs. Only if the scan passes does the deploy job trigger — it SSH into a server, pulls the image, stops the old container, starts the new one, and performs a health check with 5 retries.

**Rollback:** If health check fails, a rollback job queries Docker Hub API for the previous tag, SSH into the server, and deploys the previous version. A Slack notification is sent for every event.\"

### 21.3 Ten-Minute Version (Senior Engineer)

Walk through the codebase file by file:

1. **src/app.js** — Request logger middleware, 3 routes, error handler, graceful shutdown, module export pattern
2. **src/logger.js** — Pino vs Winston, JSON structured logging, NODE_ENV transport selection
3. **tests/app.test.js** — Jest + Supertest, what each test covers, uncovered lines
4. **.github/workflows/ci.yml** — DAG structure, needs dependencies, if conditions, BuildX, registry caching
5. **Dockerfile** — Multi-stage build, layer caching, Alpine advantages, non-root user, HEALTHCHECK
6. **scripts/deploy.sh** — set -e, parameter expansion, health check loop, || true pattern
7. **scripts/rollback.sh** — Rollback tag resolution, notification webhook
8. **kubernetes/deployment.yml** — RollingUpdate strategy, liveness vs readiness probes, resource limits
9. **monitoring/** — Prometheus scrape config, Grafana provisioning
10. **.dockerignore, .gitignore, .eslintrc.json, .prettierrc** — Security and quality practices

### 21.4 Fifteen-Minute Version (Architect / Principal Engineer)

Deeper into trade-offs and alternatives:

- **Why Express 5 and not Fastify?** Express has the largest ecosystem. For this demo, Express 5's async error handling is cleaner. For production at scale, Fastify's 2x performance and schema-based validation might be preferable.
- **Why SSH-based deployment and not Kubernetes?** SSH targets single server, appropriate for this scale. K8s manifests are provided for when the app outgrows single-server.
- **Why Pino over Winston?** 5x faster, JSON-native. Winston has more plugins but at the cost of performance.
- **Why fixed retry intervals instead of exponential backoff?** Fixed intervals fail fast. Exponential backoff would delay rollback by 30+ seconds.
- **Why npm ci instead of npm install?** 2x faster, respects lockfile, fails if out of sync.

### 21.5 By Audience

| Audience | Focus |
|---|---|
| Recruiter | Business value, automation benefits, team productivity |
| Technical Interviewer | Architecture decisions, code quality, system design |
| Engineering Manager | Reliability, team velocity, production safety |
| Principal Architect | Trade-offs, scalability, enterprise integration |
| SRE | Monitoring, rollback, error handling, SLIs |
| Product Manager | Time-to-market, deployment frequency, failure recovery |

---

## Section 22: Project Defense

### 22.1 Attack Vectors and Defenses

**Attack 1: \"The project is too simple. It's just a Hello World app with a pipeline.\"**

**Defense:** \"The simplicity of the application is intentional. The value is not in the application logic — it's in the infrastructure, automation, and DevOps practices surrounding it. In a real enterprise, the application would be complex microservices, but the CI/CD patterns demonstrated here (multi-stage builds, immutable tags, health checks, automated rollback, vulnerability scanning) are exactly what those services would use.\"

**Attack 2: \"There's no staging environment.\"**

**Defense:** \"That's a valid observation. The current implementation deploys directly to production after CI passes. In production, I would add a staging deployment that mirrors production with the same server specs, same environment variables (with test secrets), and run integration tests before promoting to production.\"

**Attack 3: \"The rollback tag resolution is fragile — it assumes the previous tag is safe.\"**

**Defense:** \"You're right. The current approach queries Docker Hub API for the second-most-recent tag. A more robust approach would maintain a separate 'production' tag that only updates on successful deployments, and always roll back to that tag. I would implement this using GitHub Environments.\"

**Attack 4: \"Why use SSH instead of a proper deployment tool?\"**

**Defense:** \"SSH is used for simplicity and portability. It works on any Linux server without additional tooling. For a single-server deployment, it's the most reliable approach — there's no additional layer that could fail. The Kubernetes manifests provided show I understand container orchestration for when scaling requires it.\"

**Attack 5: \"The tests don't cover the error handler or graceful shutdown.\"**

**Defense:** \"The uncovered lines are the server.listen block and signal handlers. These don't run during tests because Supertest creates its own server. I would add specific tests for graceful shutdown using a separate server instance and testing that in-flight requests complete before exit.\"

**Attack 6: \"Why not use a managed container service like AWS ECS instead of Docker Compose?\"**

**Defense:** \"Docker Compose is used for local development and simple deployments. The Kubernetes manifests provided are for production orchestration. AWS ECS, EKS, or any managed service would use the same Docker images. The deployment target is abstracted — the same image runs everywhere.\"

**Attack 7: \"The version in the pipeline is hardcoded as 1.0.0.\"**

**Defense:** \"The version is hardcoded because the app is not under active development. In production, the version would be read from package.json, extracted from a git tag, or auto-incremented by semantic-release. The pipeline architecture supports this — the APP_VERSION env var is already configurable.\"

**Attack 8: \"There's no rollback for infrastructure changes.\"**

**Defense:** \"Infrastructure is managed through Docker images which are versioned and immutable. If the infrastructure needs to change, it happens through a new Dockerfile version, not by mutating the server. For Kubernetes, the deployment YAML changes are reverted via git revert.\"

---

## Section 23: Resume Explanation

### 23.1 One-Line Description

\"Enterprise CI/CD pipeline with automated rollback, multi-stage Docker builds, and comprehensive security scanning.\"

### 23.2 Two-Line Description

\"Built a production-grade CI/CD platform using GitHub Actions, Docker, and Kubernetes that automatically builds, tests, scans, deploys, and rolls back a Node.js application with zero manual intervention.\"

### 23.3 Resume Bullet Points

- **CI/CD Pipeline:** Designed and implemented a 7-job GitHub Actions workflow with parallel linting, testing, dependency auditing, multi-stage Docker builds, Trivy vulnerability scanning, SSH-based deployment, automatic rollback, and Slack notifications.
- **Containerization:** Built multi-stage Dockerfiles using Alpine Linux achieving 80% image size reduction (from 900MB to 190MB), implemented non-root user security, Docker HEALTHCHECK, and registry-based layer caching.
- **Automated Rollback:** Engineered an automatic rollback mechanism that queries Docker Hub API for previous stable tags, redeploys the last known-good version, verifies health, and sends Slack notifications — all without human intervention.
- **Application Development:** Built a Node.js Express application with structured JSON logging (Pino), health check endpoint (/health), graceful shutdown signal handling, and comprehensive error handling middleware.
- **Infrastructure as Code:** Created Kubernetes deployment manifests with rolling update strategy, liveness/readiness probes, and resource limits; Docker Compose configurations for development, production, and monitoring stacks.
- **Monitoring & Observability:** Configured Prometheus for metrics collection and Grafana for visualization with auto-provisioned datasources and dashboards.
- **Testing & Quality:** Implemented Jest + Supertest test suite with 74% coverage, ESLint for static analysis, and Prettier for code formatting, all enforced in CI pipeline.
- **Security:** Integrated npm audit for dependency vulnerability scanning, Trivy for container image CVE scanning, GitHub Secrets for credential management, and .gitignore/.dockerignore for sensitive file exclusion.

### 23.4 LinkedIn Description

\"Building production-grade CI/CD infrastructure that makes deployment boring. Designed an automated pipeline that transforms code push into production deployment with built-in safety nets — automatic rollback, vulnerability scanning, and health verification. Proficient in Docker, Kubernetes, GitHub Actions, and Node.js.\"

### 23.5 Portfolio Description

\"This project is a complete CI/CD platform demonstrating enterprise DevOps practices. When developers push code, a 7-stage pipeline automatically lints, tests, security audits, builds a multi-stage Docker image, scans for CVEs, deploys to production, and performs health checks. If deployment fails, the system automatically rolls back to the previous stable version. The application itself includes structured logging, health endpoints, and graceful shutdown. Monitoring is handled by Prometheus and Grafana.\"

---

## Section 24: Future Improvements

### 24.1 High Priority

| Improvement | Complexity | Impact | Description |
|---|---|---|---|
| Blue-green deployment | Medium | High | Eliminate downtime by running two versions simultaneously with Nginx traffic switching |
| Staging environment | Medium | High | Add a staging deploy that mirrors production before the production deploy |
| Prometheus metrics in app | Low | High | Instrument Express with prom-client to expose request count, latency, error rate |
| Terraform provisioning | High | High | Define server, network, and DNS as code |

### 24.2 Medium Priority

| Improvement | Complexity | Impact | Description |
|---|---|---|---|
| Semantic release automation | Medium | Medium | Auto-increment version based on commit messages (semantic-release) |
| Canary deployments | High | Medium | Gradual traffic shifting with automated rollback on error rate increase |
| Database migrations | Medium | Medium | Add migration scripts and pre-deploy migration job |
| PagerDuty integration | Low | Medium | Add PagerDuty alerts for production incidents |
| Load testing in CI | Medium | Medium | Add k6 load tests that must pass before deployment |

### 24.3 Low Priority

| Improvement | Complexity | Impact | Description |
|---|---|---|---|
| Feature flags | Medium | Low | Integrate LaunchDarkly or Flagsmith for gradual feature rollout |
| Chaos engineering | High | Low | Add Chaos Monkey experiments to test system resilience |
| Synthetic monitoring | Medium | Low | Add external health checks from multiple geographic locations |
| SBOM generation | Low | Low | Generate Software Bill of Materials for supply chain transparency |

---

## Section 25: Final Project Review

### 25.1 Scoring Breakdown

| Category | Score (out of 10) | Explanation |
|---|---|---|
| **Architecture** | 7 | Well-layered with clear separation of concerns. Pipeline DAG is well-structured. Missing staging environment and blue-green deployment. |
| **Code Quality** | 7 | Clean, modular code with ESLint + Prettier enforcement. Could benefit from TypeScript. Error handler is minimal. |
| **Docker** | 9 | Multi-stage, Alpine, non-root, HEALTHCHECK, .dockerignore — all best practices followed. Could add distroless alternative. |
| **CI/CD** | 8 | Comprehensive 7-job pipeline with dependencies, caching, and environment gates. Hardcoded version and Docker Hub API tag resolution are weak points. |
| **Security** | 7 | Strong layering (audit, scan, non-root, secrets). Missing TLS, secret rotation, and SBOM. |
| **Scalability** | 6 | Horizontal scaling via Kubernetes but single-server SSH deploy limits initial scaling. |
| **Maintainability** | 8 | Well-documented, clear file structure, standard tooling. AGENT.md provides roadmap. |
| **Readability** | 8 | Clean code with descriptive variable names. Consistent formatting enforced by Prettier. |
| **Deployment** | 7 | Automated but causes brief downtime. Rollback is automatic but tag resolution could be improved. |
| **Monitoring** | 6 | Prometheus/Grafana configured but no app-level metrics. Health endpoint is excellent. |
| **Testing** | 6 | 3 passing tests with 74% coverage. Missing tests for error handler, graceful shutdown, integration, and load. |
| **Documentation** | 8 | AGENT.md, REPORT.md, this audit report. README is missing. |
| **Production Readiness** | 7 | Would work for low-traffic production with monitoring and rollback. Needs blue-green, staging, and TLS for enterprise. |
| **Portfolio Value** | 9 | Excellent portfolio project — demonstrates CI/CD, Docker, K8s, security, monitoring, and rollback. |
| **Interview Value** | 9 | Rich material for technical discussions — every decision has trade-offs to discuss. |

### 25.2 Overall Score: 7.3 / 10

### 25.3 Summary

This project successfully demonstrates a **complete, production-oriented CI/CD ecosystem** that goes far beyond a tutorial-grade pipeline. It includes:

- **CI:** Parallel linting, testing, dependency auditing
- **CD:** Automated SSH-based deployment with health verification
- **Safety:** Automatic rollback with Docker Hub API tag resolution
- **Security:** npm audit, Trivy scanning, non-root containers, secrets management
- **Containerization:** Multi-stage builds, Alpine, HEALTHCHECK, .dockerignore
- **Orchestration:** Kubernetes manifests with rolling updates and probes
- **Observability:** Prometheus + Grafana configuration, structured logging
- **Code Quality:** ESLint, Prettier, conventional commits
- **Notifications:** Slack integration for pipeline events

The project would score higher with blue-green deployment, proper staging environment, app-level Prometheus metrics, and a comprehensive README. It is currently a **strong portfolio project** that provides extensive material for technical interviews and demonstrates genuine DevOps engineering capability.

### 25.4 Key Strengths

1. **Automatic rollback** is the standout feature — a production-grade safety mechanism
2. **Multi-stage Docker build** with Alpine reduces image size by 80%
3. **7-job pipeline** with proper dependency gating and environment management
4. **Security layering** shows defense-in-depth thinking
5. **Graceful shutdown and health checks** demonstrate production awareness

### 25.5 Key Weaknesses

1. **No blue-green deployment** — causes brief downtime during deploys
2. **Hardcoded version** in pipeline tag generation
3. **Fragile rollback tag resolution** — relies on Docker Hub API sort order
4. **No staging environment** — deploys directly to production
5. **No app-level Prometheus metrics** — monitoring config only

---

## Appendix: Glossary

| Term | Definition |
|---|---|
| CI/CD | Continuous Integration and Continuous Deployment |
| DAG | Directed Acyclic Graph — workflow structure where jobs depend on each other |
| Docker Hub | Cloud-based container image registry |
| GitHub Actions | GitHub's CI/CD platform |
| HEALTHCHECK | Docker instruction that tests if container is working |
| Kubernetes | Container orchestration platform |
| Liveness Probe | K8s probe that determines if a pod should be restarted |
| Pino | Fast Node.js structured logger |
| Readiness Probe | K8s probe that determines if a pod should receive traffic |
| Rolling Update | K8s deployment strategy that updates pods gradually |
| Trivy | Open-source container vulnerability scanner |

---

## Appendix: References

1. Docker multi-stage builds: https://docs.docker.com/build/building/multi-stage/
2. GitHub Actions workflow syntax: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
3. Express error handling: https://expressjs.com/en/guide/error-handling.html
4. Pino documentation: https://getpino.io/
5. Trivy documentation: https://trivy.dev/
6. Kubernetes probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
7. Prometheus configuration: https://prometheus.io/docs/prometheus/latest/configuration/configuration/
8. Twelve-Factor App: https://12factor.net/
9. OWASP Top 10: https://owasp.org/www-project-top-ten/
10. Alpine Linux: https://alpinelinux.org/
