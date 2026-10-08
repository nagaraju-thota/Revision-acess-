import BrandMark from "./BrandMark";
import { useBrand } from "../../context/BrandContext";

export default function Footer() {
  const { companyName } = useBrand();
  return (
    <footer className="mt-auto pt-8 pb-6 flex flex-col items-center gap-2">
      <BrandMark className="h-5 opacity-80" />
      <p className="text-[11px] text-gray-400 dark:text-gray-600">Built under {companyName}</p>
    </footer>
  );
}
