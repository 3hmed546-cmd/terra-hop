"use client";

import { useEffect, useState, useRef } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Clock,
  RefreshCw,
  Search,
  Upload,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  History,
  Lock,
  Pencil,
} from "lucide-react";
import { apiFetch } from "@/lib/admin-auth";

interface ManagerItem {
  id: string;
  email: string;
  username: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  isMaster: boolean;
}

interface AuditLogItem {
  id: number;
  actor: string;
  action: string;
  actionTitle: string;
  entity: string;
  entityId: string | null;
  date: string;
  time: string;
  rawAt: string;
  ip: string;
}

export function ManagersManager() {
  const [activeTab, setActiveTab] = useState<"managers" | "logs">("managers");
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isMaster, setIsMaster] = useState(true);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchLog, setSearchLog] = useState("");

  // Add Manager Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formAvatar, setFormAvatar] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Manager Modal state
  const [editTarget, setEditTarget] = useState<ManagerItem | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingEditAvatar, setUploadingEditAvatar] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation state
  const [deleteTarget, setDeleteTarget] = useState<ManagerItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Global Notification
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Managers
  async function fetchManagers() {
    setLoadingManagers(true);
    try {
      const res = await apiFetch("/api/admin/managers");
      const data = await res.json();
      if (res.ok && data.ok) {
        setManagers(data.data.managers || []);
        setIsMaster(Boolean(data.data.isMaster));
      }
    } catch (err) {
      console.error("Failed to fetch managers:", err);
    } finally {
      setLoadingManagers(false);
    }
  }

  // Fetch Audit Logs
  async function fetchAuditLogs() {
    setLoadingLogs(true);
    try {
      const res = await apiFetch("/api/admin/audit-logs?limit=100");
      const data = await res.json();
      if (res.ok && data.ok) {
        setLogs(data.data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    fetchManagers();
  }, []);

  useEffect(() => {
    if (activeTab === "logs") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  // Handle Avatar File Upload
  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    setModalError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("/api/admin/assets", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.data?.url) {
        throw new Error(data?.error?.message || data?.error || "فشل رفع الصورة.");
      }
      setFormAvatar(data.data.url);
    } catch (err: any) {
      setModalError(err?.message || "حدث خطأ أثناء رفع الصورة.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Handle Add Manager Submit
  async function handleCreateManager(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      const res = await apiFetch("/api/admin/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formUsername.trim(),
          email: formEmail.trim(),
          password: formPassword,
          avatarUrl: formAvatar.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "فشل إضافة المسؤول.");
      }

      setNotification({
        type: "success",
        text: `تمت إضافة المسؤول (${formUsername}) بنجاح! يمكنه الآن تسجيل الدخول بكامل صلاحيات الإدارة.`,
      });
      setShowAddModal(false);
      setFormUsername("");
      setFormEmail("");
      setFormPassword("");
      setFormAvatar("");
      fetchManagers();
    } catch (err: any) {
      setModalError(err?.message || "حدث خطأ أثناء إضافة المسؤول.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Edit Modal Open
  function openEditModal(mgr: ManagerItem) {
    setEditTarget(mgr);
    setEditUsername(mgr.username || "");
    setEditEmail(mgr.email || "");
    setEditPassword("");
    setEditAvatar(mgr.avatarUrl || "");
    setShowEditPassword(false);
    setEditError(null);
  }

  // Handle Edit Avatar Upload
  async function handleEditAvatarUpload(file: File) {
    setUploadingEditAvatar(true);
    setEditError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("/api/admin/assets", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.data?.url) {
        throw new Error(data?.error?.message || data?.error || "فشل رفع الصورة.");
      }
      setEditAvatar(data.data.url);
    } catch (err: any) {
      setEditError(err?.message || "حدث خطأ أثناء رفع الصورة.");
    } finally {
      setUploadingEditAvatar(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  }

  // Handle Save Edit Submit
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      const payload: any = {
        username: editUsername.trim(),
        email: editEmail.trim(),
        avatarUrl: editAvatar.trim(),
      };
      if (editPassword) {
        if (editPassword.length < 8) {
          throw new Error("يجب ألا تقل كلمة المرور عن 8 أحرف.");
        }
        payload.password = editPassword;
      }

      const res = await apiFetch(`/api/admin/managers/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "فشل تحديث البيانات.");
      }

      setNotification({
        type: "success",
        text: `تم تحديث بيانات المسؤول (${editUsername}) بنجاح!`,
      });
      setEditTarget(null);
      fetchManagers();
    } catch (err: any) {
      setEditError(err?.message || "حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setSavingEdit(false);
    }
  }

  // Handle Delete Manager
  async function handleDeleteManager() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/managers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "فشل حذف المسؤول.");
      }

      setNotification({
        type: "success",
        text: `تم حذف حساب المسؤول (${deleteTarget.username || deleteTarget.email}) بنجاح.`,
      });
      setDeleteTarget(null);
      fetchManagers();
    } catch (err: any) {
      setNotification({
        type: "error",
        text: err?.message || "حدث خطأ أثناء حذف المسؤول.",
      });
    } finally {
      setDeleting(false);
    }
  }

  const filteredLogs = logs.filter((item) => {
    if (!searchLog) return true;
    const q = searchLog.toLowerCase();
    return (
      item.actor.toLowerCase().includes(q) ||
      item.actionTitle.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q) ||
      item.date.includes(q) ||
      item.time.includes(q)
    );
  });

  return (
    <div className="space-y-6 pt-1 text-neutral-900">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium shadow-sm transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-950"
              : "bg-red-50 border border-red-300 text-red-950"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-neutral-500 hover:text-black text-xs font-bold px-2 py-1"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Header Info & Role Badge */}
      <div className="bg-neutral-50/70 border border-neutral-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-800" />
            إدارة مسؤولي المتجر وسجل العمليات
          </h3>
          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
            يمكنك إضافة مسؤولين بصورهم وبياناتهم للتحكم بالمتجر، ومتابعة سجل العمليات الموثق بالساعة والتاريخ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isMaster ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-900 text-white shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              أنت: مسؤول رئيسي (Master Admin)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-200 text-neutral-800">
              <ShieldAlert className="w-3.5 h-3.5 text-neutral-600" />
              أنت: مسؤول متجر (Manager)
            </span>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-neutral-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("managers")}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors cursor-pointer ${
            activeTab === "managers"
              ? "border-black text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          <Users className="w-4 h-4" />
          قائمة المسؤولين ({managers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors cursor-pointer ${
            activeTab === "logs"
              ? "border-black text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          <History className="w-4 h-4" />
          سجل العمليات (Audit Log)
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: MANAGERS LIST & ADD MANAGER */}
      {/* ============================================================== */}
      {activeTab === "managers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-neutral-900">المسؤولين المسجلين حالياً</h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                المسؤولون يمتلكون صلاحيات إدارة المنتجات والطلبات والإعدادات بالكامل.
              </p>
            </div>

            {isMaster ? (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                إضافة مسؤول جديد
              </button>
            ) : (
              <div className="text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                فقط المسؤول الرئيسي يمكنه إضافة أو حذف مسؤولين
              </div>
            )}
          </div>

          {loadingManagers ? (
            <div className="py-12 flex justify-center items-center text-neutral-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {managers.map((mgr) => (
                <div
                  key={mgr.id}
                  className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-xs hover:border-neutral-300 transition-all"
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    {/* Avatar */}
                    {mgr.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mgr.avatarUrl}
                        alt={mgr.username}
                        className="w-12 h-12 rounded-full object-cover border border-neutral-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-neutral-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                        {(mgr.username || mgr.email).slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900 truncate">
                          {mgr.username || "مسؤول"}
                        </span>
                        {mgr.isMaster ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white shrink-0">
                            رئيسي
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300 shrink-0">
                            مسؤول
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-neutral-500 font-mono truncate mt-0.5" dir="ltr">
                        {mgr.email}
                      </div>

                      <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        مسجل منذ: {new Date(mgr.createdAt).toLocaleDateString("ar-EG")}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(mgr)}
                      className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                      title="تعديل بيانات الحساب"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {isMaster && !mgr.isMaster && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(mgr)}
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف المسؤول"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: AUDIT LOG (12-HOUR FORMAT & RESPONSIVE) */}
      {/* ============================================================== */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="بحث في سجل العمليات (الاسم، العملية، التاريخ)..."
                className="w-full bg-white border border-neutral-300 rounded-lg pr-9 pl-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs placeholder:text-neutral-400"
              />
            </div>

            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={loadingLogs}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-neutral-300 text-neutral-800 text-xs font-semibold hover:bg-neutral-100 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
              تحديث السجل
            </button>
          </div>

          {loadingLogs ? (
            <div className="py-12 flex justify-center items-center text-neutral-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-xs sm:text-sm text-neutral-500 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-300 p-8">
              لا توجد عمليات مسجلة مطابقة للبحث.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-neutral-200 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs hover:border-neutral-300 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-neutral-900">
                        {item.actionTitle}
                      </span>
                      <span className="text-[11px] font-mono bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded border border-neutral-200">
                        {item.action}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-600 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-neutral-800">{item.actor}</span>
                      <span className="text-neutral-400">•</span>
                      <span className="text-neutral-500 font-mono text-[11px]" dir="ltr">
                        IP: {item.ip}
                      </span>
                    </div>
                  </div>

                  {/* 12-Hour Formatted Time Badge */}
                  <div className="self-end sm:self-center shrink-0 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 bg-neutral-100 border border-neutral-200 text-neutral-900 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{item.time}</span>
                      <span className="text-neutral-400">|</span>
                      <span>{item.date}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD NEW MANAGER */}
      {/* ============================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-300 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-base sm:text-lg text-neutral-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-neutral-800" />
                إضافة مسؤول جديد للمتجر
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-black font-bold p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManager} className="space-y-4">
              {/* Avatar Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-800">
                  صورة المسؤول (Avatar)
                </label>
                <div className="flex items-center gap-3">
                  {formAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formAvatar}
                      alt="معاينة"
                      className="w-14 h-14 rounded-full object-cover border border-neutral-300 shadow-2xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 text-xs">
                      بدون صورة
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold border border-neutral-300 transition-colors cursor-pointer"
                    >
                      {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingAvatar ? "جاري الرفع..." : "رفع صورة من جهازك"}
                    </button>
                    {formAvatar && (
                      <button
                        type="button"
                        onClick={() => setFormAvatar("")}
                        className="block text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        إزالة الصورة
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800">
                  اسم المستخدم (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="مثال: ahmed_ops أو mohamed"
                  className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800">
                  البريد الإلكتروني (Email) *
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="manager@terra-hop.com"
                  className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-neutral-900 font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800">
                  كلمة المرور (Password) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    dir="ltr"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل..."
                    className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 pl-9 text-xs sm:text-sm text-neutral-900 font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  تنبيه أمان: يتم تشفير كلمة المرور فورياً بأعلى معايير الأمان (Bcrypt $2b$10$) لحماية الحساب.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  تأكيد وإضافة المسؤول
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT MANAGER / ADMIN */}
      {/* ============================================================== */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-300 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 text-neutral-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <Pencil className="w-5 h-5 text-neutral-800" />
                تعديل بيانات الحساب ({editTarget.username || editTarget.email})
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-neutral-400 hover:text-black font-bold p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Avatar Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-800">
                  صورة المسؤول (Avatar)
                </label>
                <div className="flex items-center gap-3">
                  {editAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editAvatar}
                      alt="معاينة"
                      className="w-14 h-14 rounded-full object-cover border border-neutral-300 shadow-2xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 text-xs">
                      بدون صورة
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      type="file"
                      ref={editFileInputRef}
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleEditAvatarUpload(e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={uploadingEditAvatar}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold border border-neutral-300 transition-colors cursor-pointer"
                    >
                      {uploadingEditAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingEditAvatar ? "جاري الرفع..." : "تغيير الصورة"}
                    </button>
                    {editAvatar && (
                      <button
                        type="button"
                        onClick={() => setEditAvatar("")}
                        className="block text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        إزالة الصورة
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800">
                  اسم المستخدم (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="مثال: ahmed_ops أو mohamed"
                  className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800">
                  البريد الإلكتروني (Email) *
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="manager@terra-hop.com"
                  className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-neutral-900 font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                />
              </div>

              {/* New Password (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800">
                  كلمة المرور الجديدة (اختياري)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    minLength={8}
                    dir="ltr"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="اتركها فارغة للإبقاء على كلمة المرور الحالية..."
                    className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 pl-9 text-xs sm:text-sm text-neutral-900 font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs placeholder:text-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black p-1 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  ملاحظة أمان: اترك هذا الحقل فارغاً إذا كنت لا ترغب بتغيير كلمة المرور. إذا قمت بإدخال كلمة مرور جديدة فسيتم تشفيرها وتحديثها فورياً.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DIALOG: CONFIRM DELETE MANAGER */}
      {/* ============================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-300 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-neutral-900">
                تأكيد حذف حساب المسؤول
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف حساب المسؤول (<strong>{deleteTarget.username || deleteTarget.email}</strong>)؟
              سيتم إنهاء جميع جلساته النشطة فورياً ولن يتمكن من الدخول للمتجر مجدداً.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteManager}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                نعم، احذف الحساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
