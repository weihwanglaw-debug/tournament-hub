import { useState } from "react";
import { Save, Check, Plus, Trash2, Edit2, X } from "lucide-react";
import config from "@/data/config.json";

// ── Flatten ALL master config into a single key-value table ──────────────────
// Each row: group | key | label | value | type (text | url | textarea | color)
interface ConfigRow {
  id:    string;
  group: string;
  label: string;
  value: string;
  type:  "text" | "url" | "textarea";
}

const INITIAL_ROWS: ConfigRow[] = [
  // Branding
  { id: "branding.appName",   group: "Branding",  label: "Application Name",  value: config.branding.appName,  type: "text"     },
  { id: "branding.logoUrl",   group: "Branding",  label: "Logo URL",           value: config.branding.logoUrl,  type: "url"      },
  // Hero
  { id: "hero.title",         group: "Hero",      label: "Hero Title",         value: config.hero.title,        type: "text"     },
  { id: "hero.subtitle",      group: "Hero",      label: "Hero Subtitle",      value: config.hero.subtitle,     type: "textarea" },
  // Payment
  { id: "payment.currency",   group: "Payment",   label: "Currency Code",      value: config.payment.currency,  type: "text"     },
  // Footer
  { id: "footer.contactEmail",  group: "Footer",  label: "Contact Email",      value: config.footer.contactEmail,  type: "text" },
  { id: "footer.copyrightText", group: "Footer",  label: "Copyright Text",     value: config.footer.copyrightText, type: "text" },
  // Consent
  { id: "consentText",          group: "Consent", label: "Consent Statement (applies to all events)", value: config.consentText, type: "textarea" },
];

const GROUPS = ["Branding", "Hero", "Payment", "Footer", "Consent"];

export default function MasterConfig() {
  const [rows,      setRows]      = useState<ConfigRow[]>(INITIAL_ROWS);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saved,     setSaved]     = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState("All");

  const startEdit = (row: ConfigRow) => {
    setEditId(row.id);
    setEditValue(row.value);
  };

  const commitEdit = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, value: editValue } : r));
    setEditId(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 2000);
  };

  const cancelEdit = () => setEditId(null);

  const groups = ["All", ...GROUPS];
  const visible = rows.filter(r => activeGroup === "All" || r.group === activeGroup);

  // Group rows for display
  const byGroup: Record<string, ConfigRow[]> = {};
  visible.forEach(r => { if (!byGroup[r.group]) byGroup[r.group] = []; byGroup[r.group].push(r); });

  return (
    <div>
      <h1 className="font-bold text-2xl mb-8">Master Configuration</h1>

      {/* Group filter tabs */}
      <div className="flex flex-wrap gap-0 mb-8" style={{ borderBottom: "2px solid var(--color-table-border)" }}>
        {groups.map(g => (
          <button key={g} onClick={() => setActiveGroup(g)}
            className="px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{
              color: activeGroup === g ? "var(--color-primary)" : "var(--color-body-text)",
              borderBottom: activeGroup === g ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: "-2px",
            }}>
            {g}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {Object.entries(byGroup).map(([group, groupRows]) => (
          <div key={group}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3 pb-2 opacity-60"
              style={{ borderBottom: "1px solid var(--color-table-border)" }}>
              {group}
            </p>
            <div style={{ border: "1px solid var(--color-table-border)" }}>
              <table className="trs-table w-full">
                <thead>
                  <tr>
                    <th style={{ width: "30%" }}>Setting</th>
                    <th>Value</th>
                    <th style={{ width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <p className="text-sm font-medium">{row.label}</p>
                        <p className="text-xs opacity-40 font-mono mt-0.5">{row.id}</p>
                      </td>
                      <td>
                        {editId === row.id ? (
                          row.type === "textarea" ? (
                            <textarea className="field-input text-sm w-full" rows={3}
                              value={editValue} onChange={e => setEditValue(e.target.value)}
                              autoFocus />
                          ) : (
                            <input className="field-input text-sm w-full"
                              value={editValue} onChange={e => setEditValue(e.target.value)}
                              autoFocus
                              onKeyDown={e => { if (e.key === "Enter") commitEdit(row.id); if (e.key === "Escape") cancelEdit(); }} />
                          )
                        ) : (
                          <div className="flex items-start justify-between gap-2 group">
                            <span className={`text-sm ${row.type === "textarea" ? "whitespace-pre-wrap" : "truncate max-w-md"} ${!row.value ? "opacity-30 italic" : ""}`}>
                              {row.value || "(empty)"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        {editId === row.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => commitEdit(row.id)} title="Save"
                              className="p-1.5 transition-opacity hover:opacity-70"
                              style={{ color: "var(--badge-open-text)" }}>
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEdit} title="Cancel"
                              className="p-1.5 opacity-40 hover:opacity-80">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(row)} title="Edit"
                            className="p-1.5 transition-opacity hover:opacity-70"
                            style={{ color: saved === row.id ? "var(--badge-open-text)" : "var(--color-primary)" }}>
                            {saved === row.id ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--color-table-border)" }}>
        <p className="text-xs opacity-40">Click any ✏️ to edit inline. Changes are saved immediately per row. In production, values are persisted via PUT /api/config.</p>
      </div>
    </div>
  );
}