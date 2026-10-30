jest.mock("../data/db");
const request = require("supertest");
const app = require("../server");
const db = require("../data/db");

describe("server wiring", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Not found." });
  });

  it("mounts every route group under /api", async () => {
    db.getDomains.mockResolvedValue([]);
    db.getAllResults.mockResolvedValue([]);
    db.getResultsByStudent.mockResolvedValue([]);
    expect((await request(app).get("/api/domains")).status).toBe(200);
    expect((await request(app).get("/api/admin/results")).status).toBe(200);
    expect((await request(app).get("/api/exam/results/S1")).status).toBe(200);
    expect((await request(app).post("/api/auth/admin/login").send({})).status).toBe(400);
  });

  it("hides internal error details behind a generic 500", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    db.getDomains.mockRejectedValue(new Error("secret db password in message"));
    const res = await request(app).get("/api/domains");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error." });
    expect(JSON.stringify(res.body)).not.toMatch(/secret/);
  });

  it("rejects malformed JSON bodies with an error status", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(app).post("/api/auth/admin/login").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("sends CORS headers (open by default when CORS_ORIGIN is unset)", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
