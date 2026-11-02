import { formatTime } from "../../src/utils/format";

describe("formatTime", () => {
  it("formats zero", () => expect(formatTime(0)).toBe("00:00"));
  it("pads seconds", () => expect(formatTime(5)).toBe("00:05"));
  it("rolls seconds into minutes", () => expect(formatTime(65)).toBe("01:05"));
  it("handles more than an hour as minutes", () => expect(formatTime(3725)).toBe("62:05"));
});
