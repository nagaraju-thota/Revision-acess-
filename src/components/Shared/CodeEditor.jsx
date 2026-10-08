import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";

// One place mapping the app's language ids (see CodingPanel.jsx's LANGUAGES
// list, and the backend's PISTON_LANGUAGES in exam.routes.js) to their
// CodeMirror syntax-highlighting extension. Both places need to agree on
// these same ids.
const LANGUAGE_EXTENSIONS = {
  javascript: javascript(),
  python: python(),
  java: java(),
  cpp: cpp(),
};

// Thin wrapper around @uiw/react-codemirror so the rest of the app doesn't
// need to know about CodeMirror's extension/theme API directly -- gives
// syntax highlighting, auto-indent (after `{`, on Enter), and bracket
// matching "for free" instead of the plain <textarea> the coding panels
// used to use.
export default function CodeEditor({ value, onChange, language, height = "300px" }) {
  return (
    <CodeMirror
      value={value}
      height={height}
      theme={oneDark}
      extensions={LANGUAGE_EXTENSIONS[language] ? [LANGUAGE_EXTENSIONS[language]] : []}
      onChange={onChange}
      basicSetup={{ tabSize: 2, autocompletion: false }}
      className="rounded-md overflow-hidden border border-gray-300 dark:border-gray-700 text-sm"
    />
  );
}
