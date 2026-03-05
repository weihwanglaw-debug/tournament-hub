import { useState, useMemo } from "react";
import { Plus, Edit2, Key, Trash2, Eye, EyeOff, Check, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { mockUserStore } from "@/data/mockUsers";
import type { AdminUser } from "@/types/config";

type ModalMode = "create" | "edit" | "reset" | null;

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [, forceRender] = useState(0);
  const refresh = () => forceRender(n => n + 1);
  const users = mockUserStore.getAll();

  const [modal, setModal] = useState<ModalMode>(null);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [delConf, setDelConf] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);

  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole, setFRole] = useState<"superadmin" | "eventadmin">("eventadmin");
  const [fPass, setFPass] = useState("");
  const [fPass2, setFPass2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = () => { setTarget(null); setFName(""); setFEmail(""); setFRole("eventadmin"); setFPass(""); setFPass2(""); setErrors({}); setModal("create"); };
  const openEdit = (u: AdminUser) => { setTarget(u); setFName(u.name); setFEmail(u.email); setFRole(u.role); setFPass(""); setFPass2(""); setErrors({}); setModal("edit"); };
  const openReset = (u: AdminUser) => { setTarget(u); setFPass(""); setFPass2(""); setErrors({}); setModal("reset"); };

  const validate = (mode: ModalMode) => {
    const e: Record<string, string> = {};
    if (mode !== "reset") {
      if (!fName.trim()) e.name = "Required";
      if (!fEmail.trim()) e.email = "Required";
      else if (!/\S+@\S+\.\S+/.test(fEmail)) e.email = "Invalid email";
      const emailExists = mockUserStore.getAll().some(u => u.email === fEmail && u.id !== target?.id);
      if (emailExists) e.email = "Email already in use";
    }
    if (mode === "create" || mode === "reset") {
      if (!fPass.trim()) e.pass = "Required";
      else if (fPass.length < 8) e.pass = "Min 8 characters";
      if (fPass !== fPass2) e.pass2 = "Passwords do not match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate(modal)) return;
    if (modal === "create") { mockUserStore.add({ id: `u${Date.now()}`, name: fName, email: fEmail, role: fRole, password: fPass, lastLogin: "" }); }
    else if (modal === "edit" && target) { mockUserStore.update(target.id, { name: fName, email: fEmail, role: fRole }); }
    else if (modal === "reset" && target) { mockUserStore.update(target.id, { password: fPass }); }
    refresh(); setModal(null);
  };

  const handleDelete = () => { if (delConf) { mockUserStore.remove(delConf); refresh(); } setDelConf(null); };

  const isSelf = (u: AdminUser) => u.id === currentUser?.id;
  const roleLabel = (r: string) => r === "superadmin" ? "Super Admin" : "Event Admin";
  const roleBadge = (r: string) => ({ bg: r === "superadmin" ? "var(--color-primary)" : "var(--badge-soon-bg)", text: r === "superadmin" ? "var(--color-hero-text)" : "var(--badge-soon-text)" });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-bold text-2xl">User Management</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"><Plus className="h-4 w-4" /> Add User</button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: "var(--color-primary)", color: "var(--color-hero-text)" }}>Super Admin</span>
          <span className="opacity-60">Full access</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>Event Admin</span>
          <span className="opacity-60">Events, registrations, fixtures only</span>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="trs-table w-full">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => {
              const rb = roleBadge(u.role);
              return (
                <tr key={u.id}>
                  <td className="font-medium text-sm">{u.name}{isSelf(u) && <span className="ml-2 text-xs opacity-40">(you)</span>}</td>
                  <td className="text-sm opacity-70 font-mono">{u.email}</td>
                  <td><span className="inline-flex px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: rb.bg, color: rb.text }}>{roleLabel(u.role)}</span></td>
                  <td className="text-xs opacity-50">{u.lastLogin || "Never"}</td>
                  <td>
                    <div className="flex items-center gap-0">
                      <IABtn label="Edit" onClick={() => openEdit(u)}><Edit2 className="h-4 w-4" /></IABtn>
                      <IABtn label="Reset Password" onClick={() => openReset(u)}><Key className="h-4 w-4" /></IABtn>
                      <IABtn label={isSelf(u) ? "Cannot delete self" : "Delete"} danger disabled={isSelf(u)} onClick={() => !isSelf(u) && setDelConf(u.id)}><Trash2 className="h-4 w-4" /></IABtn>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && <tr><td colSpan={5} className="text-center py-10 opacity-40">No users.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {users.map(u => {
          const rb = roleBadge(u.role);
          return (
            <div key={u.id} className="p-5" style={{ border: "1px solid var(--color-table-border)" }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{u.name}{isSelf(u) && <span className="ml-2 text-xs opacity-40">(you)</span>}</p>
                  <p className="text-xs opacity-60 font-mono">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: rb.bg, color: rb.text }}>{roleLabel(u.role)}</span>
                  <div className="relative">
                    <button onClick={() => setOpenAction(openAction === u.id ? null : u.id)} className="p-1.5 opacity-50"><MoreVertical className="h-4 w-4" /></button>
                    {openAction === u.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 shadow-lg z-20 py-1"
                        style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
                        <button onClick={() => { openEdit(u); setOpenAction(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:opacity-70">Edit User</button>
                        <button onClick={() => { openReset(u); setOpenAction(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:opacity-70">Reset Password</button>
                        {!isSelf(u) && <button onClick={() => { setDelConf(u.id); setOpenAction(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:opacity-70" style={{ color: "var(--badge-open-text)" }}>Delete</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs opacity-50">Last login: {u.lastLogin || "Never"}</p>
            </div>
          );
        })}
      </div>

      {/* Modals (same as before, condensed) */}
      <Dialog open={modal === "create" || modal === "edit"} onOpenChange={v => { if (!v) setModal(null); }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0"><DialogTitle className="font-bold text-xl">{modal === "create" ? "Add User" : `Edit User — ${target?.name}`}</DialogTitle></DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <FF label="Full Name *" error={errors.name}><input className="field-input" value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Jane Tan" /></FF>
            <FF label="Email *" error={errors.email}><input className="field-input" type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="jane@example.com" /></FF>
            <FF label="Role"><select className="field-input" value={fRole} onChange={e => setFRole(e.target.value as "superadmin" | "eventadmin")}><option value="eventadmin">Event Admin</option><option value="superadmin">Super Admin</option></select></FF>
            {modal === "create" && (
              <><FF label="Password *" error={errors.pass}><div className="flex"><input className="field-input flex-1" type={showPass ? "text" : "password"} value={fPass} onChange={e => setFPass(e.target.value)} placeholder="Min. 8 characters" /><button onClick={() => setShowPass(!showPass)} className="px-3 opacity-50 hover:opacity-80" style={{ border: "1px solid var(--color-table-border)", borderLeft: "none" }}>{showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></FF>
              <FF label="Confirm Password *" error={errors.pass2}><input className="field-input" type={showPass ? "text" : "password"} value={fPass2} onChange={e => setFPass2(e.target.value)} placeholder="Re-enter" /></FF></>
            )}
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">{modal === "create" ? "Create User" : "Save Changes"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "reset"} onOpenChange={v => { if (!v) setModal(null); }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0"><DialogTitle className="font-bold text-xl">Reset Password — {target?.name}</DialogTitle></DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <div className="p-3 text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>Setting a new password will immediately invalidate the current one.</div>
            <FF label="New Password *" error={errors.pass}><div className="flex"><input className="field-input flex-1" type={showPass ? "text" : "password"} value={fPass} onChange={e => setFPass(e.target.value)} placeholder="Min. 8 characters" /><button onClick={() => setShowPass(!showPass)} className="px-3 opacity-50" style={{ border: "1px solid var(--color-table-border)", borderLeft: "none" }}>{showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></FF>
            <FF label="Confirm *" error={errors.pass2}><input className="field-input" type={showPass ? "text" : "password"} value={fPass2} onChange={e => setFPass2(e.target.value)} placeholder="Re-enter" /></FF>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">Reset Password</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delConf} onOpenChange={v => { if (!v) setDelConf(null); }}>
        <DialogContent className="max-w-sm p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0"><DialogTitle className="font-bold text-xl">Delete User?</DialogTitle></DialogHeader>
          <div className="p-8 pt-4"><p className="text-sm opacity-70">This will permanently delete <strong>{users.find(u => u.id === delConf)?.name}</strong>.</p></div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setDelConf(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleDelete} className="px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: "var(--badge-open-text)", color: "var(--color-hero-text)" }}>Delete User</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FF({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (<div><label className="block text-xs font-semibold mb-2 opacity-70">{label}</label>{children}{error && <p className="text-xs mt-1" style={{ color: "var(--badge-open-text)" }}>{error}</p>}</div>);
}

function IABtn({ label, onClick, danger = false, disabled = false, children }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button title={label} onClick={onClick} disabled={disabled}
      className="p-2 transition-opacity hover:opacity-60 disabled:opacity-20 disabled:cursor-not-allowed"
      style={{ color: danger ? "var(--badge-open-text)" : "var(--color-primary)" }}>{children}</button>
  );
}
