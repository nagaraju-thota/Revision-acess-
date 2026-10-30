jest.mock("../../data/db");
const request = require("supertest");
const db = require("../../data/db");
const { appWith } = require("../helpers/app");

const app = appWith("/api/auth", require("../../routes/auth.routes"));

beforeEach(() => jest.resetAllMocks());

describe("POST /api/auth/student/register", () => {
  it("returns the new student on success", async () => {
    db.registerStudent.mockResolvedValue({ student: { id: "E1", name: "Ann", password: "secret" } });
    const res = await request(app).post("/api/auth/student/register").send({ id: "e1", email: "a@b.co", name: "Ann", password: "secret" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, student: { id: "E1", name: "Ann" } }); // password never echoed
  });

  it("returns 409 when the ID is already registered", async () => {
    db.registerStudent.mockResolvedValue({ error: "This Employee ID is already registered. Sign in instead." });
    const res = await request(app).post("/api/auth/student/register").send({});
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for other validation errors", async () => {
    db.registerStudent.mockResolvedValue({ error: "Enter a valid email address." });
    const res = await request(app).post("/api/auth/student/register").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Enter a valid email address.");
  });

  it("returns 500 when the db throws", async () => {
    db.registerStudent.mockRejectedValue(new Error("db down"));
    const res = await request(app).post("/api/auth/student/register").send({});
    expect(res.status).toBe(500);
  });
});

describe("POST /api/auth/student/login", () => {
  it("400 when id or password is missing", async () => {
    expect((await request(app).post("/api/auth/student/login").send({ id: "S1" })).status).toBe(400);
    expect((await request(app).post("/api/auth/student/login").send({ password: "x" })).status).toBe(400);
    expect(db.findStudent).not.toHaveBeenCalled();
  });

  it("401 on bad credentials", async () => {
    db.findStudent.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/student/login").send({ id: "S1", password: "bad" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Invalid student ID or password." });
  });

  it("trims + upper-cases the id and returns hasAttempted without the password", async () => {
    db.findStudent.mockResolvedValue({ id: "S1", name: "Ann", password: "pw", hasAttempted: true });
    const res = await request(app).post("/api/auth/student/login").send({ id: "  s1 ", password: "pw" });
    expect(db.findStudent).toHaveBeenCalledWith("S1", "pw");
    expect(res.body).toEqual({ success: true, student: { id: "S1", name: "Ann", hasAttempted: true } });
  });

  it("500 when the db throws", async () => {
    db.findStudent.mockRejectedValue(new Error("x"));
    expect((await request(app).post("/api/auth/student/login").send({ id: "S1", password: "pw" })).status).toBe(500);
  });
});

describe("POST /api/auth/admin/login", () => {
  it("400 when fields are missing", async () => {
    const res = await request(app).post("/api/auth/admin/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Admin ID and password/);
  });

  it("401 on bad credentials", async () => {
    db.findAdmin.mockResolvedValue(null);
    expect((await request(app).post("/api/auth/admin/login").send({ id: "a", password: "b" })).status).toBe(401);
  });

  it("returns the admin on success (id normalised)", async () => {
    db.findAdmin.mockResolvedValue({ id: "ADMIN1", name: "Portal Admin", password: "admin123" });
    const res = await request(app).post("/api/auth/admin/login").send({ id: " admin1", password: "admin123" });
    expect(db.findAdmin).toHaveBeenCalledWith("ADMIN1", "admin123");
    expect(res.body).toEqual({ success: true, admin: { id: "ADMIN1", name: "Portal Admin" } });
  });

  it("500 when the db throws", async () => {
    db.findAdmin.mockRejectedValue(new Error("x"));
    expect((await request(app).post("/api/auth/admin/login").send({ id: "a", password: "b" })).status).toBe(500);
  });
});
