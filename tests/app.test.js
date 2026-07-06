const request = require("supertest");
const app = require("../src/app");

describe("GET /", () => {
  it("returns 200 and contains CI/CD Pipeline Live", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("CI/CD Pipeline Live");
  });
});

describe("GET /health", () => {
  it("returns 200 with healthy status and version", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "healthy");
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
  });
});

describe("GET /version", () => {
  it("returns 200 with version info", async () => {
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("name", "ci-cd_nodeapp");
  });
});
