// The ONE place to change the portal's logo and name.
//
// To use a different logo:
//   1. Drop the new image file into the /public folder (e.g. next to the
//      existing logo.png).
//   2. Change LOGO_PATH below to point at it (e.g. "/new-logo.png").
//   3. Rebuild/reload the app.
//
// That's it — no admin screen, no upload, no database. The moment the app
// loads, it reads whatever image LOGO_PATH points to and automatically:
//   - re-derives the portal's entire accent color (buttons, active tabs,
//     badges, links, the exam watermark's ink) from that image's own
//     dominant color — see context/BrandContext.jsx and utils/brandTheme.js
//   - sets the browser tab's favicon to the same image (also in
//     BrandContext.jsx, since <head> is outside anything React renders)
// Every on-screen logo (navbar/header on every page, footer, dashboards,
// login/register) renders through components/Shared/BrandMark.jsx, which
// reads LOGO_PATH — there is no second hardcoded <img> anywhere in the app.
// Update COMPANY_NAME too if the name should change along with it; it's
// shown in the footer and (split into lines) in the exam watermark.
export const LOGO_PATH = "/exam_logo.png";

export const COMPANY_NAME = "AssessmentPortal";


