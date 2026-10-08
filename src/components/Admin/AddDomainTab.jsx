import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// One row in the domain list. Handles its own edit-in-place and
// delete-confirm state so the parent list doesn't need to track which row is
// active — each row is fully self-contained.
function DomainRow({ domain, onChanged }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(domain.name);
  const [description, setDescription] = useState(domain.description);
  const [minutes, setMinutes] = useState(Math.round(domain.duration / 60));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setName(domain.name);
    setDescription(domain.description);
    setMinutes(Math.round(domain.duration / 60));
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Domain name is required.");
      return;
    }
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) {
      setError("Enter a whole number of minutes greater than 0.");
      return;
    }
    setSaving(true);
    try {
      await api.updateDomain(domain.id, { name: name.trim(), description: description.trim(), duration: mins * 60 });
      setEditing(false);
      toast.success(`Updated "${name.trim()}"`);
      onChanged?.();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.deleteDomain(domain.id);
      toast.success(`Deleted "${domain.name}"`);
      onChanged?.();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (editing) {
    return (
      <div className="px-4 py-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-9 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full p-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-20 h-9 px-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">min</span>
          <button
            disabled={saving}
            onClick={save}
            className="h-9 px-3 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {domain.name}{" "}
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">({domain.id})</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{domain.description || "No description"}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {domain.questionCount} questions · {Math.round(domain.duration / 60)} min
          </p>
        </div>

        {confirmingDelete ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-red-600 dark:text-red-400">Delete this domain?</span>
            <button
              disabled={deleting}
              onClick={remove}
              className="h-8 px-3 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
              aria-label="Cancel delete"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={startEdit}
              className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// Domain management: list of existing domains (each editable/deletable in
// place) plus a form to create a new one. New domains start with zero
// questions — the "Add questions" tab is where the admin fills in its bank.
export default function AddDomainTab({ domains, onAdded }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const handleNameChange = (value) => {
    setName(value);
    if (!idTouched) setId(slugify(value));
  };

  const reset = () => {
    setName("");
    setId("");
    setIdTouched(false);
    setDescription("");
    setMinutes(20);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setCreated(null);
    if (!name.trim()) {
      setError("Domain name is required.");
      return;
    }
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) {
      setError("Enter a whole number of minutes greater than 0.");
      return;
    }
    setSaving(true);
    try {
      const { domain } = await api.addDomain({
        id: id.trim() || undefined,
        name: name.trim(),
        description: description.trim(),
        duration: mins * 60,
      });
      setCreated(domain);
      toast.success(`Added domain "${domain.name}"`);
      reset();
      onAdded?.();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {domains.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Existing domains</p>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
            {domains.map((d) => (
              <DomainRow key={d.id} domain={d} onChanged={onAdded} />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-md">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Add a new domain</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          It starts with zero questions — use "Add questions" afterward to build its question bank.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Domain name</label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. DevOps"
              className="w-full h-9 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">ID (auto-filled, editable)</label>
            <input
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setIdTouched(true);
              }}
              placeholder="devops"
              className="w-full h-9 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What this domain covers"
              className="w-full p-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Timer (minutes)</label>
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-24 h-9 px-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {created && (
            <p className="text-sm text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
              <Check size={14} /> Added "{created.name}" ({created.id})
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add domain"}
          </button>
        </form>
      </div>
    </div>
  );
}
