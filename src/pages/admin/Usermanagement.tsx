import { useState } from "react";
import { Plus, Edit2, Key, Trash2, Check, X, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface User {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "eventadmin";
  passwordHash: string;   // in real app this would be a hash; we store display placeholder
  lastLogin?: string;
}

const INIT_USERS: User[] = [
  { id: "u1", name: "System Admin",  email: "admin@trs.com",       role: "superadmin",  passwordHash: "••••••••", lastLogin: "2026-03-04" },
  { id: "u2", name: "Event Manager", email: "events@trs.com",      role: "eventadmin",  passwordHash: "••••••••", lastLogin: "2026-03-02" },
  { id: "u3", name: "Jane Tan",      email: "jane.tan@trs.com",    role: "eventadmin",  passwordHash: "••••••••", lastLogin: "" },
];

type ModalMode = "create" | "edit" | "reset" | null;

export default function UserManagement() {
  const [users,   setUsers]   = useState<User[]>(INIT_USERS);
  const [modal,   setModal]   = useState<ModalMode>(null);
  const [target,  setTarget]  = useState<User | null>(null);
  const [delConf, setDelConf] = useState<string | null>(null);

  // Form state
  const [fName,  setFName]  = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole,  setFRole]  = useState<"superadmin" | "eventadmin">("eventadmin");
  const [fPass,  setFPass]  = useState("");
  const [fPass2, setFPass2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]    = useState<Record<string, string>>({});

  const openCreate = () => {
    setTarget(null); setFName(""); setFEmail(""); setFRole("eventadmin"); setFPass(""); setFPass2(""); setErrors({});
    setModal("create");
  };

  const openEdit = (u: User) => {
    setTarget(u); setFName(u.name); setFEmail(u.email); setFRole(u.role); setFPass(""); setFPass2(""); setErrors({});
    setModal("edit");
  };

  const openReset = (u: User) => {
    setTarget(u); setFPass(""); setFPass2(""); setErrors({});
    setModal("reset");
  };

  const validate = (mode: ModalMode) => {
    const e: Record<string, string> = {};
    if (mode !== "reset") {
      if (!fName.trim())  e.name  = "Required";
      if (!fEmail.trim()) e.email = "Required";
      else if (!/\S+@\S+\.\S+/.test(fEmail)) e.email = "Invalid email";
    }
    if (mode === "create" || mode === "reset") {
      if (!fPass.trim())        e.pass  = "Required";
      else if (fPass.length < 8) e.pass = "Min 8 characters";
      if (fPass !== fPass2)     e.pass2 = "Passwords do not match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate(modal)) return;
    if (modal === "create") {
      setUsers(prev => [...prev, {
        id: `u${Date.now()}`, name: fName, email: fEmail, role: fRole, passwordHash: "••••••••",
      }]);
    } else if (modal === "edit" && target) {
      setUsers(prev => prev.map(u => u.id === target.id ? { ...u, name: fName, email: fEmail, role: fRole } : u));
    } else if (modal === "reset" && target) {
      // In real app: POST /api/users/:id/reset-password
      setUsers(prev => prev.map(u => u.id === target.id ? { ...u, passwordHash: "••••••••" } : u));
    }
    setModal(null);
  };

  const handleDelete = () => {
    setUsers(prev => prev.filter(u => u.id !== delConf));
    setDelConf(null);
  };

  const roleLabel = (r: string) => r === "superadmin" ? "Super Admin" : "Event Admin";
  const roleBadge = (r: string) => ({
    bg:   r === "superadmin" ? "var(--color-primary)"   : "var(--badge-soon-bg)",
    text: r === "superadmin" ? "var(--color-hero-text)" : "var(--badge-soon-text)",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-bold text-2xl">User Management</h1>
        <button onClick={openCreate}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* Role legend */}
      <div className="flex gap-4 mb-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-hero-text)" }}>Super Admin</span>
          <span className="opacity-60">Full access — events, registrations, fixtures, users, config</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>Event Admin</span>
          <span className="opacity-60">Events, registrations, fixtures only</span>
        </div>
      </div>

      <div style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="trs-table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const rb = roleBadge(u.role);
              return (
                <tr key={u.id}>
                  <td className="font-medium text-sm">{u.name}</td>
                  <td className="text-sm opacity-70 font-mono">{u.email}</td>
                  <td>
                    <span className="inline-flex px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: rb.bg, color: rb.text }}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="text-xs opacity-50">{u.lastLogin || "Never"}</td>
                  <td>
                    <div className="flex items-center gap-0">
                      <IABtn label="Edit User"           onClick={() => openEdit(u)}>  <Edit2 className="h-4 w-4" /></IABtn>
                      <IABtn label="Reset Password"      onClick={() => openReset(u)}> <Key   className="h-4 w-4" /></IABtn>
                      <IABtn label="Delete User" danger  onClick={() => setDelConf(u.id)}><Trash2 className="h-4 w-4" /></IABtn>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 opacity-40">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ══ Create / Edit Modal ══ */}
      <Dialog open={modal === "create" || modal === "edit"}
        onOpenChange={v => { if (!v) setModal(null); }}>
        <DialogContent className="max-w-md p-0"
          style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-bold text-xl">
              {modal === "create" ? "Add User" : `Edit User — ${target?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <FF label="Full Name *" error={errors.name}>
              <input className="field-input" value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Jane Tan" />
            </FF>
            <FF label="Email Address *" error={errors.email}>
              <input className="field-input" type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="jane@example.com" />
            </FF>
            <FF label="Role">
              <select className="field-input" value={fRole} onChange={e => setFRole(e.target.value as any)}>
                <option value="eventadmin">Event Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </FF>
            {modal === "create" && (
              <>
                <FF label="Password *" error={errors.pass}>
                  <div className="flex">
                    <input className="field-input flex-1" type={showPass ? "text" : "password"}
                      value={fPass} onChange={e => setFPass(e.target.value)} placeholder="Min. 8 characters" />
                    <button onClick={() => setShowPass(!showPass)}
                      className="px-3 opacity-50 hover:opacity-80"
                      style={{ border: "1px solid var(--color-table-border)", borderLeft: "none" }}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FF>
                <FF label="Confirm Password *" error={errors.pass2}>
                  <input className="field-input" type={showPass ? "text" : "password"}
                    value={fPass2} onChange={e => setFPass2(e.target.value)} placeholder="Re-enter password" />
                </FF>
              </>
            )}
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">
              {modal === "create" ? "Create User" : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Reset Password Modal ══ */}
      <Dialog open={modal === "reset"} onOpenChange={v => { if (!v) setModal(null); }}>
        <DialogContent className="max-w-md p-0"
          style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-bold text-xl">Reset Password — {target?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <div className="p-3 text-sm"
              style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
              Setting a new password will immediately invalidate the current one.
            </div>
            <FF label="New Password *" error={errors.pass}>
              <div className="flex">
                <input className="field-input flex-1" type={showPass ? "text" : "password"}
                  value={fPass} onChange={e => setFPass(e.target.value)} placeholder="Min. 8 characters" />
                <button onClick={() => setShowPass(!showPass)}
                  className="px-3 opacity-50 hover:opacity-80"
                  style={{ border: "1px solid var(--color-table-border)", borderLeft: "none" }}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FF>
            <FF label="Confirm New Password *" error={errors.pass2}>
              <input className="field-input" type={showPass ? "text" : "password"}
                value={fPass2} onChange={e => setFPass2(e.target.value)} placeholder="Re-enter password" />
            </FF>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">
              Reset Password
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Delete Confirm ══ */}
      <Dialog open={!!delConf} onOpenChange={v => { if (!v) setDelConf(null); }}>
        <DialogContent className="max-w-sm p-0"
          style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-bold text-xl">Delete User?</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4">
            <p className="text-sm opacity-70">
              This will permanently delete <strong>{users.find(u => u.id === delConf)?.name}</strong>.
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setDelConf(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleDelete}
              className="px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--badge-open-text)", color: "#fff" }}>
              Delete User
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FF({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-2 opacity-70">{label}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: "var(--badge-open-text)" }}>{error}</p>}
    </div>
  );
}

function IABtn({ label, onClick, danger = false, children }: {
  label: string; onClick: () => void; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button title={label} onClick={onClick}
      className="p-2 transition-opacity hover:opacity-60"
      style={{ color: danger ? "var(--badge-open-text)" : "var(--color-primary)" }}>
      {children}
    </button>
  );
}