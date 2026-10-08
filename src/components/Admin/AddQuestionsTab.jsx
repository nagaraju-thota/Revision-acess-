import { useState } from "react";
import { ListChecks, PenLine, Code2 } from "lucide-react";
import McqPanel from "./McqPanel";
import FillBlankPanel from "./FillBlankPanel";
import CodingPanel from "./CodingPanel";

const TYPES = [
  { id: "mcq", label: "Multiple choice", icon: ListChecks },
  { id: "fill-blank", label: "Fill in the blank", icon: PenLine },
  { id: "coding", label: "Coding", icon: Code2 },
];

// All three question types now go through the real backend: MCQ was already
// wired, and Fill in the Blank / Coding call their matching endpoints too
// (see api/client.js's getFillBlankQuestions/publishFillBlankQuestions/
// deleteFillBlankQuestion and getCodingQuestions/addCodingQuestion/
// deleteCodingQuestion).
export default function AddQuestionsTab({ domains }) {
  const [domainId, setDomainId] = useState(domains[0]?.id || "");
  const [type, setType] = useState("mcq");
  const domainName = domains.find((d) => d.id === domainId)?.name || "";

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Domain</label>
          <select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="h-9 px-3 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900"
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          {TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setType(id)}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-colors ${
                type === id
                  ? "bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {type === "mcq" && <McqPanel domainId={domainId} domainName={domainName} />}
      {type === "fill-blank" && <FillBlankPanel domainId={domainId} domainName={domainName} />}
      {type === "coding" && <CodingPanel domainId={domainId} domainName={domainName} />}
    </div>
  );
}
