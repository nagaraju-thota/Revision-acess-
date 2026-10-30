jest.mock("../../data/db");
const request = require("supertest");
const db = require("../../data/db");
const { appWith } = require("../helpers/app");

const app = appWith("/api/domains", require("../../routes/domain.routes"));

beforeEach(() => jest.resetAllMocks());

describe("GET /api/domains", () => {
  it("lists domains", async () => {
    db.getDomains.mockResolvedValue([{ id: "java" }]);
    const res = await request(app).get("/api/domains");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ domains: [{ id: "java" }] });
  });

  it("500 on db failure", async () => {
    db.getDomains.mockRejectedValue(new Error("x"));
    expect((await request(app).get("/api/domains")).status).toBe(500);
  });
});

describe("GET /api/domains/:domainId/exam", () => {
  it("returns the exam", async () => {
    db.getExamForStudent.mockResolvedValue({ domainId: "java", questions: [] });
    const res = await request(app).get("/api/domains/java/exam");
    expect(db.getExamForStudent).toHaveBeenCalledWith("java");
    expect(res.body).toEqual({ exam: { domainId: "java", questions: [] } });
  });

  it("404 for an unknown domain", async () => {
    db.getExamForStudent.mockResolvedValue(null);
    const res = await request(app).get("/api/domains/nope/exam");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Domain not found.");
  });

  it("500 on db failure", async () => {
    db.getExamForStudent.mockRejectedValue(new Error("x"));
    expect((await request(app).get("/api/domains/java/exam")).status).toBe(500);
  });
});
