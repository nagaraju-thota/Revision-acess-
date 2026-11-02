import { watermarkLinesFromName, watermarkStyle } from "../../src/utils/watermark";

describe("watermarkLinesFromName", () => {
  it("splits the default company name into two lines", () => {
    expect(watermarkLinesFromName("Koundinyasa Technology Services Pvt. Ltd.")).toEqual([
      "KOUNDINYASA",
      "TECHNOLOGY SERVICES",
    ]);
  });
  it("strips legal suffixes", () => expect(watermarkLinesFromName("Acme Corp")).toEqual(["ACME"]));
  it("uses one line for a single word", () => expect(watermarkLinesFromName("AssessmentPortal")).toEqual(["ASSESSMENTPORTAL"]));
  it("falls back to PORTAL for empty / undefined names", () => {
    expect(watermarkLinesFromName("")).toEqual(["PORTAL"]);
    expect(watermarkLinesFromName(undefined)).toEqual(["PORTAL"]);
  });
});

describe("watermarkStyle", () => {
  afterEach(() => document.documentElement.style.removeProperty("--color-brand-900"));

  it("returns a repeating svg background", () => {
    const style = watermarkStyle(false, "My Company");
    expect(style.backgroundImage).toContain("data:image/svg+xml");
    expect(style.backgroundRepeat).toBe("repeat");
    expect(style.backgroundSize).toBe("280px 150px");
  });

  it("uses the fallback ink when no brand variable is set", () => {
    const style = watermarkStyle(false, "My Company");
    expect(decodeURIComponent(style.backgroundImage)).toContain("rgb(15,23,42)");
  });

  it("reads the live brand colour variable", () => {
    document.documentElement.style.setProperty("--color-brand-900", "1 2 3");
    const style = watermarkStyle(false, "My Company");
    expect(decodeURIComponent(style.backgroundImage)).toContain("rgb(1,2,3)");
  });

  it("uses a slightly stronger opacity in dark mode", () => {
    expect(decodeURIComponent(watermarkStyle(true, "X").backgroundImage)).toContain('fill-opacity="0.11"');
    expect(decodeURIComponent(watermarkStyle(false, "X").backgroundImage)).toContain('fill-opacity="0.09"');
  });
});
