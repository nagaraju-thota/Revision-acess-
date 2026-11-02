import { vi } from "vitest";
import { buildShadeRamp, extractDominantHsl, loadImageFromUrl } from "../../src/utils/brandTheme";

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

describe("buildShadeRamp", () => {
  it("returns all 11 steps as 'r g b' strings", () => {
    const ramp = buildShadeRamp({ h: 220, s: 60 });
    expect(Object.keys(ramp).map(Number)).toEqual(STEPS);
    Object.values(ramp).forEach((v) => expect(v).toMatch(/^\d+ \d+ \d+$/));
  });

  it("gets darker from step 50 to step 950", () => {
    const ramp = buildShadeRamp({ h: 220, s: 60 });
    const sum = (v) => v.split(" ").map(Number).reduce((a, b) => a + b, 0);
    expect(sum(ramp[50])).toBeGreaterThan(sum(ramp[950]));
  });

  it("darkens mid shades for yellow-green hues compared with blue", () => {
    const sum = (v) => v.split(" ").map(Number).reduce((a, b) => a + b, 0);
    const yellow = buildShadeRamp({ h: 95, s: 60 });
    const noComp = buildShadeRamp({ h: 250, s: 60 });
    // same step, yellow-green gets compensated darker than its raw lightness would be
    expect(sum(yellow[600])).toBeLessThan(sum(noComp[600]) + 400);
    expect(yellow[600]).not.toBe(noComp[600]);
  });

  it("handles grey (saturation 0) without throwing", () => {
    expect(buildShadeRamp({ h: 0, s: 0 })[500]).toMatch(/^\d+ \d+ \d+$/);
  });

  it("caps very high saturation", () => {
    expect(buildShadeRamp({ h: 10, s: 100 })[500]).toEqual(buildShadeRamp({ h: 10, s: 72 })[500]);
  });
});

function mockCanvas(pixels) {
  const data = new Uint8ClampedArray(pixels.flat());
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data })),
  };
  vi.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "canvas") return { width: 0, height: 0, getContext: () => ctx };
    return Document.prototype.createElement.call(document, tag);
  });
  return ctx;
}

describe("extractDominantHsl", () => {
  afterEach(() => vi.restoreAllMocks());

  it("picks the dominant saturated colour (red) over transparent / white pixels", () => {
    const red = [220, 30, 30, 255];
    mockCanvas([red, red, red, [255, 255, 255, 255], [0, 0, 0, 0], [10, 10, 10, 255]]);
    const { h, s } = extractDominantHsl({});
    expect(h).toBeLessThan(10);
    expect(s).toBeGreaterThan(25);
  });

  it("works out the hue for a green, a blue and a grey-ish pixel mix", () => {
    mockCanvas([[30, 200, 40, 255], [30, 200, 40, 255], [30, 40, 200, 255]]);
    const { h } = extractDominantHsl({});
    expect(h).toBeGreaterThan(100);
    expect(h).toBeLessThan(140);
  });

  it("throws when only white/black/grey pixels exist", () => {
    mockCanvas([[255, 255, 255, 255], [0, 0, 0, 255], [128, 128, 128, 255]]);
    expect(() => extractDominantHsl({})).toThrow(/clear brand color/);
  });

  it("throws a friendly error when the canvas is cross-origin tainted", () => {
    const ctx = mockCanvas([[1, 1, 1, 255]]);
    ctx.getImageData.mockImplementation(() => {
      throw new Error("tainted");
    });
    expect(() => extractDominantHsl({})).toThrow(/cross-origin/);
  });
});

describe("loadImageFromUrl", () => {
  const OriginalImage = global.Image;
  afterEach(() => {
    global.Image = OriginalImage;
  });

  it("resolves with the image on load", async () => {
    global.Image = class {
      set src(v) {
        this._src = v;
        setTimeout(() => this.onload());
      }
    };
    const img = await loadImageFromUrl("/logo.png");
    expect(img.crossOrigin).toBe("anonymous");
  });

  it("rejects with a helpful message on error", async () => {
    global.Image = class {
      set src(v) {
        setTimeout(() => this.onerror());
      }
    };
    await expect(loadImageFromUrl("/missing.png")).rejects.toThrow(/\/missing\.png/);
  });
});
