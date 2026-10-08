import { useBrand } from "../../context/BrandContext";

// Renders the active logo (defaults to the Koundinyasa Technology Services
// wordmark; see context/BrandContext.jsx for how an admin-uploaded logo +
// name replace it, and utils/brandTheme.js for how the app's colors are
// then derived from it). Sits comfortably at header-bar height (~h-6 to
// h-8) or larger on the login/register cards where there's more room.
export default function BrandMark({ className = "h-6" }) {
  const { logoSrc, companyName } = useBrand();
  return (
    <img
      src={logoSrc}
      alt={`${companyName} logo`}
      className={`${className} w-auto object-contain`}
    />
  );
}
