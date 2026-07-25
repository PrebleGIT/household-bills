"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, RotateCcw, X, Check, Wallet, PieChart, CheckSquare, Car,
  ChevronDown, ChevronLeft, ChevronRight, LogOut, Lock, Bell, BellOff, DownloadCloud,
} from "lucide-react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const PAYMENT_TYPES = ["Bank Acc.", "Autopay", "Check", "Cash", "Credit Card"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FREQUENCIES = [
  { label: "Monthly", value: 1 },
  { label: "Every 3 Mo", value: 3 },
  { label: "Every 6 Mo", value: 6 },
  { label: "Yearly", value: 12 },
];
const TABS = [
  { key: "bills", label: "Bills", icon: Wallet },
  { key: "budget", label: "Budget", icon: PieChart },
  { key: "reminders", label: "Reminders", icon: CheckSquare },
  { key: "vehicles", label: "Vehicles", icon: Car },
];
const REPEAT_OPTIONS = [
  { label: "None", value: null, unit: null },
  { label: "Weekly", value: 1, unit: "weeks" },
  { label: "Bi-Weekly", value: 2, unit: "weeks" },
  { label: "Monthly", value: 1, unit: "months" },
  { label: "Quarterly", value: 3, unit: "months" },
  { label: "Every 4 Mo", value: 4, unit: "months" },
  { label: "Every 6 Mo", value: 6, unit: "months" },
  { label: "Yearly", value: 1, unit: "years" },
  { label: "Every 2 Yr", value: 2, unit: "years" },
];

const money = (n) => `$${n.toFixed(2)}`;

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const isBillActiveThisMonth = (bill, month) => {
  const freq = bill.frequencyMonths || 1;
  if (freq <= 1) return true;
  const anchor = bill.anchorMonth || month;
  const diff = ((month - anchor) % freq + freq) % freq;
  return diff === 0;
};

const dueMonthsLabel = (frequencyMonths, anchorMonth) => {
  if (frequencyMonths <= 1) return "Every month";
  const months = [];
  for (let m = 1; m <= 12; m++) {
    if (((m - anchorMonth) % frequencyMonths + frequencyMonths) % frequencyMonths === 0) {
      months.push(MONTH_SHORT[m - 1]);
    }
  }
  return months.join(" · ");
};

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISODate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addInterval = (iso, value, unit) => {
  const d = parseISODate(iso);
  if (unit === "weeks") d.setDate(d.getDate() + value * 7);
  else if (unit === "months") d.setMonth(d.getMonth() + value);
  else if (unit === "years") d.setFullYear(d.getFullYear() + value);
  return toISODate(d);
};
const repeatLabelFor = (value, unit) => {
  const match = REPEAT_OPTIONS.find((o) => o.value === value && o.unit === unit);
  return match ? match.label : "One-time";
};
const groupLabelFor = (r) => (r.repeatUnit ? repeatLabelFor(r.repeatValue, r.repeatUnit) : "One-time");
const GROUP_ORDER = [...REPEAT_OPTIONS.slice(1).map((o) => o.label), "One-time"];
const relativeDateLabel = (iso, todayISO) => {
  const d = parseISODate(iso);
  const today = parseISODate(todayISO);
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  const withYear = d.getFullYear() !== today.getFullYear();
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}${withYear ? ` ${d.getFullYear()}` : ""}`;
};

// The single rule behind the home-screen badge. The cron job in
// app/api/cron/check-bills/route.js mirrors this exactly so the two never disagree.
const countNeedsAttention = (bills, reminders, day, month, todayISO) => {
  const billsDue = bills.filter(
    (b) => !b.paid && isBillActiveThisMonth(b, month) && b.dueDay <= day
  ).length;
  const remindersDue = reminders.filter(
    (r) => (r.repeatUnit || !r.done) && r.dueDate <= todayISO
  ).length;
  return billsDue + remindersDue;
};

const emptyBillForm = { name: "", dueDay: "", amount: "", paymentType: "Bank Acc.", frequencyMonths: 1, anchorMonth: new Date().getMonth() + 1 };
const emptySimpleForm = { name: "", amount: "" };
const emptyReminderForm = { name: "", dueDate: toISODate(new Date()), dueTime: "09:00", repeatValue: null, repeatUnit: null };
const emptyVehicleForm = { name: "", mileage: "", lastOilDate: "", oilInterval: "5000", engine: "", tireSize: "", oilType: "", oilAmount: "", oilFilter: "", drainPlugSocket: "", lugNutSocket: "", wheelTorque: "", notes: "" };

// Enter mileage only when you actually change the oil — the next change is
// just that number plus the interval. No separate "current" reading to track.
const oilDueAt = (v) => {
  if (v.mileage == null || !v.oilInterval) return null;
  return v.mileage + v.oilInterval;
};
const emptyLogForm = { description: "", date: toISODate(new Date()), mileage: "" };

const formatLogDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
};
const fmtMiles = (n) => (typeof n === "number" ? `${n.toLocaleString()} mi` : "");

const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

function Ring({ pct, label, tone }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const deg = (clamped / 100) * 360;
  const fill = tone
    ? `conic-gradient(${tone} 0deg ${deg}deg, #F0EDE5 ${deg}deg 360deg)`
    : `conic-gradient(#C15F3C 0deg, #D9825C ${deg}deg, #F0EDE5 ${deg}deg 360deg)`;
  return (
    <div className="ring" aria-hidden="true">
      <div className="ring-dial" style={{ background: fill }} />
      <div className="ring-hole" />
      <div className="ring-center">
        <span className="ring-num">{clamped}%</span>
        <span className="ring-label">{label}</span>
      </div>
    </div>
  );
}

export default function HomeHub() {
  const [view, setView] = useState("bills");
  const [editMode, setEditMode] = useState(false);
  const [notifStatus, setNotifStatus] = useState("unknown");
  const [showBackup, setShowBackup] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null); // holds parsed backup data awaiting confirmation

  const realNow = new Date();
  const realMonth = realNow.getMonth() + 1;
  const realYear = realNow.getFullYear();
  const realDay = realNow.getDate();
  const todayISO = toISODate(realNow);

  const [viewedMonth, setViewedMonth] = useState(realMonth);
  const [viewedYear, setViewedYear] = useState(realYear);
  const isCurrentMonth = viewedMonth === realMonth && viewedYear === realYear;

  const goPrevMonth = () => {
    if (viewedMonth === 1) { setViewedMonth(12); setViewedYear((y) => y - 1); } else { setViewedMonth((m) => m - 1); }
  };
  const goNextMonth = () => {
    if (viewedMonth === 12) { setViewedMonth(1); setViewedYear((y) => y + 1); } else { setViewedMonth((m) => m + 1); }
  };
  const goToday = () => { setViewedMonth(realMonth); setViewedYear(realYear); };

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBillForm);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [budgetIncomes, setBudgetIncomes] = useState([]);
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [incomeForm, setIncomeForm] = useState(emptySimpleForm);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(emptySimpleForm);

  const [reminders, setReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [remindersSaving, setRemindersSaving] = useState(false);
  const [remindersError, setRemindersError] = useState(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [reminderForm, setReminderForm] = useState(emptyReminderForm);
  const [showCompleted, setShowCompleted] = useState(false);

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesSaving, setVehiclesSaving] = useState(false);
  const [vehiclesError, setVehiclesError] = useState(null);
  const [expandedVehicleId, setExpandedVehicleId] = useState(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logVehicleId, setLogVehicleId] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const [logForm, setLogForm] = useState(emptyLogForm);

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bills", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setBills(await res.json());
    } catch (e) { setError("Bills didn't load. Check your connection and pull down to retry."); }
    finally { setLoading(false); }
  }, []);

  const loadBudget = useCallback(async (quiet) => {
    if (!quiet) setBudgetLoading(true);
    setBudgetError(null);
    try {
      const res = await fetch("/api/budget", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setBudgetIncomes(data.incomes || []);
      setBudgetItems(data.items || []);
    } catch (e) { setBudgetError("Budget didn't load. Check your connection and pull down to retry."); }
    finally { setBudgetLoading(false); }
  }, []);

  const loadReminders = useCallback(async (quiet) => {
    if (!quiet) setRemindersLoading(true);
    setRemindersError(null);
    try {
      const res = await fetch("/api/reminders", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setReminders(await res.json());
    } catch (e) { setRemindersError("Reminders didn't load. Check your connection and pull down to retry."); }
    finally { setRemindersLoading(false); }
  }, []);

  const loadVehicles = useCallback(async (quiet) => {
    if (!quiet) setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const res = await fetch("/api/vehicles", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setVehicles(await res.json());
    } catch (e) { setVehiclesError("Vehicles didn't load. Check your connection and pull down to retry."); }
    finally { setVehiclesLoading(false); }
  }, []);

  useEffect(() => { load(); loadBudget(); loadReminders(); loadVehicles(); }, [load, loadBudget, loadReminders, loadVehicles]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setNotifStatus("unsupported"); return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    setNotifStatus(Notification.permission);
  }, []);

  const enableNotifications = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setNotifStatus("unsupported"); return; }
      const permission = await Notification.requestPermission();
      setNotifStatus(permission);
      if (permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) { setNotifStatus("unsupported"); return; }
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) });
    } catch (e) {}
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("setAppBadge" in navigator)) return;
    if (loading || remindersLoading) return; // don't badge off half-loaded data
    const now = new Date();
    const waiting = countNeedsAttention(
      bills, reminders, now.getDate(), now.getMonth() + 1, toISODate(now)
    );
    if (waiting > 0) navigator.setAppBadge(waiting).catch(() => {});
    else if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
  }, [bills, reminders, loading, remindersLoading]);

  // Pull the latest from the shared database whenever the app comes back into
  // view, and every 45s while it's open, so both phones stay in step.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      load(true); loadBudget(true); loadReminders(true); loadVehicles(true);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 45000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [load, loadBudget, loadReminders, loadVehicles]);

  const persist = async (next) => {
    setBills(next); setSaving(true); setError(null);
    try {
      const res = await fetch("/api/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!res.ok) throw new Error("failed");
    } catch (e) { setError("That change didn't save. Check your connection and try again."); }
    finally { setSaving(false); }
  };

  const persistBudget = async (incomes, items) => {
    setBudgetIncomes(incomes); setBudgetItems(items); setBudgetSaving(true); setBudgetError(null);
    try {
      const res = await fetch("/api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ incomes, items }) });
      if (!res.ok) throw new Error("failed");
    } catch (e) { setBudgetError("That change didn't save. Check your connection and try again."); }
    finally { setBudgetSaving(false); }
  };

  const persistReminders = async (next) => {
    setReminders(next); setRemindersSaving(true); setRemindersError(null);
    try {
      const res = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!res.ok) throw new Error("failed");
    } catch (e) { setRemindersError("That change didn't save. Check your connection and try again."); }
    finally { setRemindersSaving(false); }
  };

  const persistVehicles = async (next) => {
    setVehicles(next); setVehiclesSaving(true); setVehiclesError(null);
    try {
      const res = await fetch("/api/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!res.ok) throw new Error("failed");
    } catch (e) { setVehiclesError("That change didn't save. Check your connection and try again."); }
    finally { setVehiclesSaving(false); }
  };

  const logout = async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; };

  // ---- Backup / restore ----
  const exportBackup = async () => {
    setBackupBusy(true); setBackupMessage(null);
    try {
      const res = await fetch("/api/backup", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = data.exportedAt ? data.exportedAt.slice(0, 10) : toISODate(new Date());
      a.href = url;
      a.download = `home-hub-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMessage({ type: "ok", text: "Backup downloaded." });
    } catch (e) {
      setBackupMessage({ type: "err", text: "Couldn't create a backup. Check your connection and try again." });
    } finally {
      setBackupBusy(false);
    }
  };

  const chooseRestoreFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    setBackupMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setConfirmRestore(data);
      } catch (err) {
        setBackupMessage({ type: "err", text: "That file doesn't look like a valid backup." });
      }
    };
    reader.readAsText(file);
  };

  const runRestore = async () => {
    if (!confirmRestore) return;
    setBackupBusy(true); setBackupMessage(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmRestore),
      });
      if (!res.ok) throw new Error("failed");
      setConfirmRestore(null);
      setBackupMessage({ type: "ok", text: "Restored. Reloading…" });
      await Promise.all([load(true), loadBudget(true), loadReminders(true), loadVehicles(true)]);
      setBackupMessage({ type: "ok", text: "Restored from backup." });
    } catch (e) {
      setBackupMessage({ type: "err", text: "Couldn't restore that backup. Check your connection and try again." });
    } finally {
      setBackupBusy(false);
    }
  };

  const openAdd = () => { setEditingId(null); setForm(emptyBillForm); setShowForm(true); };
  const openEdit = (bill) => {
    setEditingId(bill.id);
    setForm({ name: bill.name, dueDay: String(bill.dueDay), amount: String(bill.amount), paymentType: bill.paymentType, frequencyMonths: bill.frequencyMonths || 1, anchorMonth: bill.anchorMonth || new Date().getMonth() + 1 });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyBillForm); };
  const submitForm = () => {
    const name = form.name.trim();
    if (!name) return;
    const dueDay = Math.min(31, Math.max(1, parseInt(form.dueDay, 10) || 1));
    const amount = parseFloat(form.amount) || 0;
    const frequencyMonths = form.frequencyMonths || 1;
    const anchorMonth = form.anchorMonth || new Date().getMonth() + 1;
    if (editingId) {
      persist(bills.map((b) => (b.id === editingId ? { ...b, name, dueDay, amount, paymentType: form.paymentType, frequencyMonths, anchorMonth } : b)));
    } else {
      persist([...bills, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, dueDay, amount, paymentType: form.paymentType, frequencyMonths, anchorMonth, paid: false }]);
    }
    closeForm();
  };
  const togglePaid = (id) => persist(bills.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b)));
  const deleteBill = (id) => persist(bills.filter((b) => b.id !== id));
  const resetMonth = () => { persist(bills.map((b) => ({ ...b, paid: false }))); setConfirmReset(false); };

  const openAddIncome = () => { setEditingIncomeId(null); setIncomeForm(emptySimpleForm); setShowIncomeForm(true); };
  const openEditIncome = (inc) => { setEditingIncomeId(inc.id); setIncomeForm({ name: inc.name, amount: String(inc.amount) }); setShowIncomeForm(true); };
  const closeIncomeForm = () => { setShowIncomeForm(false); setEditingIncomeId(null); setIncomeForm(emptySimpleForm); };
  const submitIncomeForm = () => {
    const name = incomeForm.name.trim();
    if (!name) return;
    const amount = parseFloat(incomeForm.amount) || 0;
    if (editingIncomeId) persistBudget(budgetIncomes.map((i) => (i.id === editingIncomeId ? { ...i, name, amount } : i)), budgetItems);
    else persistBudget([...budgetIncomes, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, amount }], budgetItems);
    closeIncomeForm();
  };
  const deleteIncome = (id) => persistBudget(budgetIncomes.filter((i) => i.id !== id), budgetItems);

  const openAddItem = () => { setEditingItemId(null); setItemForm(emptySimpleForm); setShowItemForm(true); };
  const openEditItem = (item) => { setEditingItemId(item.id); setItemForm({ name: item.name, amount: String(item.amount) }); setShowItemForm(true); };
  const closeItemForm = () => { setShowItemForm(false); setEditingItemId(null); setItemForm(emptySimpleForm); };
  const submitItemForm = () => {
    const name = itemForm.name.trim();
    if (!name) return;
    const amount = parseFloat(itemForm.amount) || 0;
    if (editingItemId) persistBudget(budgetIncomes, budgetItems.map((i) => (i.id === editingItemId ? { ...i, name, amount } : i)));
    else persistBudget(budgetIncomes, [...budgetItems, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, amount }]);
    closeItemForm();
  };
  const deleteItem = (id) => persistBudget(budgetIncomes, budgetItems.filter((i) => i.id !== id));

  const openAddReminder = () => { setEditingReminderId(null); setReminderForm(emptyReminderForm); setShowReminderForm(true); };
  const openEditReminder = (item) => {
    setEditingReminderId(item.id);
    setReminderForm({ name: item.name, dueDate: item.dueDate, dueTime: item.dueTime || "09:00", repeatValue: item.repeatValue, repeatUnit: item.repeatUnit });
    setShowReminderForm(true);
  };
  const closeReminderForm = () => { setShowReminderForm(false); setEditingReminderId(null); setReminderForm(emptyReminderForm); };
  const submitReminderForm = () => {
    const name = reminderForm.name.trim();
    if (!name || !reminderForm.dueDate) return;
    const { repeatValue, repeatUnit, dueDate } = reminderForm;
    const dueTime = reminderForm.dueTime || "09:00";
    if (editingReminderId) {
      persistReminders(reminders.map((r) => (r.id === editingReminderId ? { ...r, name, dueDate, dueTime, repeatValue, repeatUnit } : r)));
    } else {
      persistReminders([...reminders, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, dueDate, dueTime, repeatValue, repeatUnit, done: false }]);
    }
    closeReminderForm();
  };
  const toggleReminder = (id) => {
    persistReminders(reminders.map((r) => {
      if (r.id !== id) return r;
      if (r.repeatUnit) return { ...r, dueDate: addInterval(r.dueDate, r.repeatValue, r.repeatUnit) };
      return { ...r, done: !r.done };
    }));
  };
  const deleteReminder = (id) => persistReminders(reminders.filter((r) => r.id !== id));

  // ---- Vehicle CRUD ----
  const openAddVehicle = () => { setEditingVehicleId(null); setVehicleForm(emptyVehicleForm); setShowVehicleForm(true); };
  const openEditVehicle = (v) => {
    setEditingVehicleId(v.id);
    setVehicleForm({
      name: v.name,
      mileage: String(v.mileage ?? ""),
      lastOilDate: v.lastOilDate || "",
      oilInterval: v.oilInterval != null ? String(v.oilInterval) : "5000",
      engine: v.engine || "",
      tireSize: v.tireSize || "",
      oilType: v.oilType || "",
      oilAmount: v.oilAmount || "",
      oilFilter: v.oilFilter || "",
      drainPlugSocket: v.drainPlugSocket || "",
      lugNutSocket: v.lugNutSocket || "",
      wheelTorque: v.wheelTorque || "",
      notes: v.notes || "",
    });
    setShowVehicleForm(true);
  };
  const closeVehicleForm = () => { setShowVehicleForm(false); setEditingVehicleId(null); setVehicleForm(emptyVehicleForm); };
  const submitVehicleForm = () => {
    const name = vehicleForm.name.trim();
    if (!name) return;
    const mileage = vehicleForm.mileage === "" ? 0 : parseInt(vehicleForm.mileage, 10) || 0;
    const lastOilDate = vehicleForm.lastOilDate || null;
    const oilInterval = parseInt(vehicleForm.oilInterval, 10) || 5000;
    const { engine, tireSize, oilType, oilAmount, oilFilter, drainPlugSocket, lugNutSocket, wheelTorque, notes } = vehicleForm;
    if (editingVehicleId) {
      persistVehicles(vehicles.map((v) => (v.id === editingVehicleId ? { ...v, name, mileage, lastOilDate, oilInterval, engine, tireSize, oilType, oilAmount, oilFilter, drainPlugSocket, lugNutSocket, wheelTorque, notes } : v)));
    } else {
      persistVehicles([...vehicles, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, mileage, lastOilDate, oilInterval, engine, tireSize, oilType, oilAmount, oilFilter, drainPlugSocket, lugNutSocket, wheelTorque, notes, log: [] }]);
    }
    closeVehicleForm();
  };
  const deleteVehicle = (id) => persistVehicles(vehicles.filter((v) => v.id !== id));

  // ---- Maintenance log CRUD (scoped to a vehicle) ----
  const openAddLog = (vehicleId) => { setLogVehicleId(vehicleId); setEditingLogId(null); setLogForm(emptyLogForm); setShowLogForm(true); };
  const openEditLog = (vehicleId, entry) => {
    setLogVehicleId(vehicleId);
    setEditingLogId(entry.id);
    setLogForm({ description: entry.description, date: entry.date, mileage: entry.mileage != null ? String(entry.mileage) : "" });
    setShowLogForm(true);
  };
  const closeLogForm = () => { setShowLogForm(false); setLogVehicleId(null); setEditingLogId(null); setLogForm(emptyLogForm); };
  const submitLogForm = () => {
    const description = logForm.description.trim();
    if (!description || !logForm.date) return;
    const mileage = logForm.mileage === "" ? null : parseInt(logForm.mileage, 10);
    persistVehicles(vehicles.map((v) => {
      if (v.id !== logVehicleId) return v;
      const log = v.log || [];
      if (editingLogId) {
        return { ...v, log: log.map((e) => (e.id === editingLogId ? { ...e, description, date: logForm.date, mileage } : e)) };
      }
      return { ...v, log: [...log, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), description, date: logForm.date, mileage }] };
    }));
    closeLogForm();
  };
  const deleteLog = (vehicleId, entryId) => {
    persistVehicles(vehicles.map((v) => (v.id === vehicleId ? { ...v, log: (v.log || []).filter((e) => e.id !== entryId) } : v)));
  };

  const activeBills = bills.filter((b) => isBillActiveThisMonth(b, viewedMonth));
  const inactiveBills = bills.filter((b) => !isBillActiveThisMonth(b, viewedMonth));
  const isPaidForView = (b) => b.paid && isCurrentMonth;
  const unpaid = activeBills.filter((b) => !isPaidForView(b)).sort((a, b) => a.dueDay - b.dueDay);
  const paidBills = activeBills.filter((b) => isPaidForView(b)).sort((a, b) => a.dueDay - b.dueDay);
  const total = activeBills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = activeBills.filter((b) => isPaidForView(b)).reduce((s, b) => s + b.amount, 0);
  const remaining = total - paidTotal;
  const progressPct = total > 0 ? Math.round((paidTotal / total) * 100) : 0;
  const today = realDay;
  const nextBill = isCurrentMonth ? unpaid.find((b) => b.dueDay >= today) || (unpaid.length ? unpaid[0] : null) : null;
  const monthLabel = `${MONTH_NAMES[viewedMonth - 1]} ${viewedYear}`;

  const totalIncome = budgetIncomes.reduce((s, i) => s + i.amount, 0);
  const otherExpensesTotal = budgetItems.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = total + otherExpensesTotal;
  const leftover = totalIncome - totalExpenses;
  const weeklyLeftover = leftover / 4;
  const allocatedPct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
  const combinedExpenses = [
    ...activeBills.map((b) => ({ id: b.id, name: b.name, amount: b.amount, kind: "bill", ref: b })),
    ...budgetItems.map((i) => ({ id: i.id, name: i.name, amount: i.amount, kind: "item", ref: i })),
  ].sort((a, b) => b.amount - a.amount);

  const needsAttention = countNeedsAttention(bills, reminders, realDay, realMonth, todayISO);
  const pendingReminders = reminders.filter((r) => r.repeatUnit || !r.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completedReminders = reminders.filter((r) => !r.repeatUnit && r.done).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const groupedReminders = GROUP_ORDER.map((label) => ({
    label,
    items: pendingReminders.filter((r) => groupLabelFor(r) === label),
  })).filter((g) => g.items.length > 0);

  const Tools = ({ onEdit, onDelete }) => (
    <div className="row-tools">
      <button className="row-tool" onClick={onEdit} aria-label="Edit"><Pencil size={14} /></button>
      <button className="row-tool" onClick={onDelete} aria-label="Delete"><Trash2 size={14} /></button>
    </div>
  );

  const BillRow = ({ bill }) => {
    const paidForView = bill.paid && isCurrentMonth;
    const pastDue = isCurrentMonth && !paidForView && bill.dueDay <= today;
    const cls = ["row", pastDue ? "is-alert" : "", paidForView ? "is-done" : "", isCurrentMonth ? "" : "is-locked"].filter(Boolean).join(" ");
    return (
      <div className={cls}>
        <button
          className="row-check"
          onClick={() => isCurrentMonth && togglePaid(bill.id)}
          aria-label={paidForView ? "Mark unpaid" : "Mark paid"}
          title={isCurrentMonth ? "" : "Switch to this month to mark bills paid"}
        >
          <span className={`box ${paidForView ? "on" : ""} ${pastDue ? "warn" : ""}`}>
            {paidForView && <Check size={13} color="#fff" strokeWidth={3} />}
          </span>
        </button>
        <div className="row-body">
          <div style={{ minWidth: 0 }}>
            <div className="row-name">{bill.name}</div>
            <div className="row-sub">
              {ordinal(bill.dueDay)} · {bill.paymentType}
              {(bill.frequencyMonths || 1) > 1 && ` · ${dueMonthsLabel(bill.frequencyMonths, bill.anchorMonth)}`}
            </div>
          </div>
          <div className="row-amt num">{money(bill.amount)}</div>
        </div>
        {editMode && <Tools onEdit={() => openEdit(bill)} onDelete={() => deleteBill(bill.id)} />}
      </div>
    );
  };

  const AmountRow = ({ name, amount, onEdit, onDelete }) => (
    <div className="row">
      <div className="row-body pad">
        <div className="row-name">{name}</div>
        <div className="row-amt num">{money(amount)}</div>
      </div>
      {editMode && <Tools onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );

  const ReminderRow = ({ item }) => {
    // Due today counts as needing attention, same as bills.
    const pastDue = !item.done && item.dueDate <= todayISO;
    const cls = ["row", pastDue ? "is-alert" : "", item.done ? "is-done" : ""].filter(Boolean).join(" ");
    return (
      <div className={cls}>
        <button className="row-check" onClick={() => toggleReminder(item.id)} aria-label={item.done ? "Mark not done" : "Mark done"}>
          <span className={`box ${item.done ? "on" : ""} ${pastDue ? "warn" : ""}`}>
            {item.done && <Check size={13} color="#fff" strokeWidth={3} />}
          </span>
        </button>
        <div className="row-body">
          <div style={{ minWidth: 0 }}>
            <div className="row-name">{item.name}</div>
            <div className="row-sub">
              {relativeDateLabel(item.dueDate, todayISO)}
              {item.dueTime && ` · ${formatTime(item.dueTime)}`}
            </div>
          </div>
        </div>
        {editMode && <Tools onEdit={() => openEditReminder(item)} onDelete={() => deleteReminder(item.id)} />}
      </div>
    );
  };

  const LogRow = ({ vehicleId, entry }) => (
    <div className="row">
      <div className="row-body pad">
        <div style={{ minWidth: 0 }}>
          <div className="row-name">{entry.description}</div>
          <div className="row-sub">
            {formatLogDate(entry.date)}
            {entry.mileage != null && ` · ${fmtMiles(entry.mileage)}`}
          </div>
        </div>
      </div>
      {editMode && <Tools onEdit={() => openEditLog(vehicleId, entry)} onDelete={() => deleteLog(vehicleId, entry.id)} />}
    </div>
  );

  const VehicleRow = ({ vehicle }) => {
    const expanded = expandedVehicleId === vehicle.id;
    const dueAt = oilDueAt(vehicle);
    const log = [...(vehicle.log || [])].sort((a, b) => b.date.localeCompare(a.date));
    return (
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row">
          <div
            className="row-body pad"
            onClick={() => setExpandedVehicleId(expanded ? null : vehicle.id)}
            style={{ cursor: "pointer" }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="row-name">{vehicle.name}</div>
              <div className="row-sub">{fmtMiles(vehicle.mileage)}{dueAt ? ` · Oil due at ${fmtMiles(dueAt)}` : ""}</div>
            </div>
            <ChevronDown size={16} color="var(--muted)" style={{ transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none", flex: "0 0 auto" }} />
          </div>
          {editMode && <Tools onEdit={() => openEditVehicle(vehicle)} onDelete={() => deleteVehicle(vehicle.id)} />}
        </div>
        {expanded && (
          <div style={{ borderTop: "1px solid var(--line)", padding: "18px 16px 16px" }}>
            {(vehicle.engine || vehicle.tireSize || vehicle.oilType || vehicle.oilAmount || vehicle.oilFilter || vehicle.drainPlugSocket || vehicle.lugNutSocket || vehicle.wheelTorque) && (
              <div style={{ marginBottom: 22 }}>
                <div className="eyebrow" style={{ marginBottom: 7 }}>Vehicle info</div>
                <div className="hero-stats">
                  {vehicle.engine && (
                    <div className="stat"><span className="stat-key">Engine</span><span className="stat-val">{vehicle.engine}</span></div>
                  )}
                  {vehicle.tireSize && (
                    <div className="stat"><span className="stat-key">Tires</span><span className="stat-val">{vehicle.tireSize}</span></div>
                  )}
                  {vehicle.oilType && (
                    <div className="stat"><span className="stat-key">Oil type</span><span className="stat-val">{vehicle.oilType}</span></div>
                  )}
                  {vehicle.oilAmount && (
                    <div className="stat"><span className="stat-key">Oil amount</span><span className="stat-val">{vehicle.oilAmount}</span></div>
                  )}
                  {vehicle.oilFilter && (
                    <div className="stat"><span className="stat-key">Filter</span><span className="stat-val">{vehicle.oilFilter}</span></div>
                  )}
                  {vehicle.drainPlugSocket && (
                    <div className="stat"><span className="stat-key">Drain plug socket</span><span className="stat-val">{vehicle.drainPlugSocket}</span></div>
                  )}
                  {vehicle.lugNutSocket && (
                    <div className="stat"><span className="stat-key">Lug nut socket</span><span className="stat-val">{vehicle.lugNutSocket}</span></div>
                  )}
                  {vehicle.wheelTorque && (
                    <div className="stat"><span className="stat-key">Wheel torque</span><span className="stat-val">{vehicle.wheelTorque}</span></div>
                  )}
                </div>
              </div>
            )}

            {vehicle.notes && (
              <div style={{ marginBottom: 22 }}>
                <div className="eyebrow" style={{ marginBottom: 7 }}>Notes</div>
                <div style={{ fontSize: 13.5, color: "var(--ink)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{vehicle.notes}</div>
              </div>
            )}

            <div className="hero-stats" style={{ marginBottom: 22 }}>
              <div className="stat">
                <span className="stat-key"><span className="dot" style={{ background: "var(--ink)" }} />Mileage</span>
                <span className="stat-val num">{fmtMiles(vehicle.mileage)}</span>
              </div>
              {vehicle.lastOilDate && (
                <div className="stat">
                  <span className="stat-key"><span className="dot" style={{ background: "var(--good)" }} />Oil changed</span>
                  <span className="stat-val">{formatLogDate(vehicle.lastOilDate)}</span>
                </div>
              )}
              <div className="stat">
                <span className="stat-key"><span className="dot" style={{ background: "var(--accent)" }} />Next oil change</span>
                <span className="stat-val num">{dueAt ? fmtMiles(dueAt) : "Set an interval"}</span>
              </div>
            </div>

            <div className="sec tight">
              <span className="eyebrow">Maintenance log · {log.length}</span>
              {editMode && <button className="link" onClick={() => openAddLog(vehicle.id)}>Add entry</button>}
            </div>
            {log.length === 0 ? (
              <div className="empty">No maintenance logged yet.</div>
            ) : (
              <div className="panel">{log.map((entry) => <LogRow key={entry.id} vehicleId={vehicle.id} entry={entry} />)}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const activeTab = TABS.find((t) => t.key === view);

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-left">
          <div className="hdr-badge">
            {activeTab && <activeTab.icon size={19} color="#fff" strokeWidth={2.2} />}
          </div>
          <div>
            <div className="hdr-title">Home Hub</div>
            <div className="hdr-sub">
              {needsAttention > 0
                ? `${needsAttention} need${needsAttention === 1 ? "s" : ""} attention`
                : "All caught up"}
            </div>
          </div>
        </div>
        <div className="hdr-actions">
          {view === "bills" && editMode && (
            <button className="icon-btn" onClick={() => setConfirmReset(true)} aria-label="Reset paid status"><RotateCcw size={14} /></button>
          )}
          <button className={`btn-ghost ${editMode ? "on" : ""}`} onClick={() => setEditMode((e) => !e)}>
            {editMode ? <Check size={13} /> : <Lock size={13} />}
            {editMode ? "Done" : "Edit"}
          </button>
          <button className="icon-btn bare" onClick={() => { setShowBackup(true); setBackupMessage(null); }} aria-label="Backup and restore"><DownloadCloud size={16} /></button>
          <button className="icon-btn bare" onClick={logout} aria-label="Log out"><LogOut size={16} /></button>
        </div>
      </header>

      {(view === "bills" || view === "budget") && (
        <div>
          <div className="monthbar">
            <button className="icon-btn" onClick={goPrevMonth} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <span className="monthbar-label">{monthLabel}</span>
            <button className="icon-btn" onClick={goNextMonth} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          {!isCurrentMonth && <button className="jump" onClick={goToday}>Back to {MONTH_NAMES[realMonth - 1]}</button>}
        </div>
      )}

      <div className="wrap">
        {!isCurrentMonth && (view === "bills" || view === "budget") && (
          <div className="notice">
            <span className="notice-text">Looking ahead. Checkboxes work in {MONTH_NAMES[realMonth - 1]} only.</span>
          </div>
        )}

        {notifStatus === "default" && (
          <div className="notice">
            <span className="notice-text" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Bell size={14} color="var(--signal)" /> Get a nudge the day a bill is due
            </span>
            <button className="btn-accent" onClick={enableNotifications}>Turn on</button>
          </div>
        )}
        {notifStatus === "denied" && (
          <div className="notice">
            <span className="notice-text" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <BellOff size={14} /> Notifications are off. Turn them on in your phone's Settings.
            </span>
          </div>
        )}

        {/* ---------- BILLS ---------- */}
        {view === "bills" && (
          <>
            <section className="hero">
              <div className="hero-top">
                <Ring pct={progressPct} label="Paid" />
                <div className="hero-stats">
                  <div className="stat">
                    <span className="stat-key"><span className="dot" style={{ background: "var(--ink)" }} />Total</span>
                    <span className="stat-val num">{money(total)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-key"><span className="dot" style={{ background: "var(--good)" }} />Paid</span>
                    <span className="stat-val num" style={{ color: "var(--good)" }}>{money(paidTotal)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-key"><span className="dot" style={{ background: "var(--accent)" }} />Remaining</span>
                    <span className="stat-val num" style={{ color: "var(--accent)" }}>{money(remaining)}</span>
                  </div>
                </div>
              </div>
              {nextBill && (
                <div className="hero-foot">
                  <div>
                    <div className="eyebrow">Next due</div>
                    <div className="hero-foot-name">{nextBill.name} · {ordinal(nextBill.dueDay)}</div>
                  </div>
                  <div className="row-amt num">{money(nextBill.amount)}</div>
                </div>
              )}
            </section>

            {error && <div className="notice-err">{error}</div>}

            {loading ? (
              <div className="empty" style={{ marginTop: 22 }}>Loading…</div>
            ) : bills.length === 0 ? (
              <div className="empty" style={{ marginTop: 22 }}>No bills yet. Tap Edit, then Add to build your list.</div>
            ) : (
              <>
                <div className="sec">
                  <span className="eyebrow">Unpaid · {unpaid.length}</span>
                  {editMode && <button className="link" onClick={openAdd}>Add bill</button>}
                </div>
                {unpaid.length === 0 ? (
                  <div className="empty">Everything's paid for {monthLabel}.</div>
                ) : (
                  <div className="panel">{unpaid.map((b) => <BillRow key={b.id} bill={b} />)}</div>
                )}

                {paidBills.length > 0 && (
                  <>
                    <button className="sec-toggle" onClick={() => setShowPaid((s) => !s)}>
                      <span className="eyebrow">Paid · {paidBills.length}</span>
                      <ChevronDown size={15} color="var(--muted)" style={{ transition: "transform .2s", transform: showPaid ? "rotate(180deg)" : "none" }} />
                    </button>
                    {showPaid && <div className="panel">{paidBills.map((b) => <BillRow key={b.id} bill={b} />)}</div>}
                  </>
                )}

                {inactiveBills.length > 0 && (
                  <>
                    <button className="sec-toggle" onClick={() => setShowInactive((s) => !s)}>
                      <span className="eyebrow">Not billed this month · {inactiveBills.length}</span>
                      <ChevronDown size={15} color="var(--muted)" style={{ transition: "transform .2s", transform: showInactive ? "rotate(180deg)" : "none" }} />
                    </button>
                    {showInactive && <div className="panel">{[...inactiveBills].sort((a, b) => a.dueDay - b.dueDay).map((b) => <BillRow key={b.id} bill={b} />)}</div>}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---------- BUDGET ---------- */}
        {view === "budget" && (
          <>
            <section className="hero">
              <div className="hero-top">
                <Ring pct={allocatedPct} label="Spent" tone={allocatedPct > 100 ? "var(--alert)" : undefined} />
                <div className="hero-stats">
                  <div className="stat">
                    <span className="stat-key"><span className="dot" style={{ background: "var(--ink)" }} />Income</span>
                    <span className="stat-val num">{money(totalIncome)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-key"><span className="dot" style={{ background: "var(--accent)" }} />Expenses</span>
                    <span className="stat-val num" style={{ color: "var(--accent)" }}>{money(totalExpenses)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-key"><span className="dot" style={{ background: leftover >= 0 ? "var(--good)" : "var(--alert)" }} />Left over</span>
                    <span className="stat-val num" style={{ color: leftover >= 0 ? "var(--good)" : "var(--alert)" }}>{money(leftover)}</span>
                  </div>
                </div>
              </div>
              <div className="hero-foot">
                <div>
                  <div className="eyebrow">Weekly</div>
                  <div className="hero-foot-name">Spending money</div>
                </div>
                <div className="row-amt num" style={{ color: leftover >= 0 ? "var(--good)" : "var(--alert)" }}>{money(weeklyLeftover)}</div>
              </div>
            </section>

            {budgetError && <div className="notice-err">{budgetError}</div>}

            {budgetLoading ? (
              <div className="empty" style={{ marginTop: 22 }}>Loading…</div>
            ) : (
              <>
                <div className="sec">
                  <span className="eyebrow">Income · {budgetIncomes.length}</span>
                  {editMode && <button className="link" onClick={openAddIncome}>Add income</button>}
                </div>
                {budgetIncomes.length === 0 ? (
                  <div className="empty">No income added yet.</div>
                ) : (
                  <div className="panel">
                    {budgetIncomes.map((inc) => <AmountRow key={inc.id} name={inc.name} amount={inc.amount} onEdit={() => openEditIncome(inc)} onDelete={() => deleteIncome(inc.id)} />)}
                  </div>
                )}

                <div className="sec">
                  <span className="eyebrow">Expenses · {combinedExpenses.length}</span>
                  {editMode && <button className="link" onClick={openAddItem}>Add expense</button>}
                </div>
                {combinedExpenses.length === 0 ? (
                  <div className="empty">No expenses added yet.</div>
                ) : (
                  <div className="panel">
                    {combinedExpenses.map((e) => (
                      <AmountRow
                        key={e.id}
                        name={e.name}
                        amount={e.amount}
                        onEdit={() => (e.kind === "bill" ? openEdit(e.ref) : openEditItem(e.ref))}
                        onDelete={() => (e.kind === "bill" ? deleteBill(e.id) : deleteItem(e.id))}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ---------- REMINDERS ---------- */}
        {view === "reminders" && (
          <>
            {remindersError && <div className="notice-err">{remindersError}</div>}

            <div className="sec tight">
              <span className="eyebrow">Scheduled · {pendingReminders.length}</span>
              {editMode && <button className="link" onClick={openAddReminder}>Add reminder</button>}
            </div>

            {remindersLoading ? (
              <div className="empty">Loading…</div>
            ) : pendingReminders.length === 0 ? (
              <div className="empty">Nothing scheduled. Tap Edit, then Add to set one up.</div>
            ) : (
              groupedReminders.map((group, i) => (
                <div key={group.label} style={{ marginTop: i === 0 ? 0 : 20 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>{group.label} · {group.items.length}</div>
                  <div className="panel">{group.items.map((item) => <ReminderRow key={item.id} item={item} />)}</div>
                </div>
              ))
            )}

            {completedReminders.length > 0 && (
              <>
                <button className="sec-toggle" onClick={() => setShowCompleted((s) => !s)}>
                  <span className="eyebrow">Done · {completedReminders.length}</span>
                  <ChevronDown size={15} color="var(--muted)" style={{ transition: "transform .2s", transform: showCompleted ? "rotate(180deg)" : "none" }} />
                </button>
                {showCompleted && <div className="panel">{completedReminders.map((item) => <ReminderRow key={item.id} item={item} />)}</div>}
              </>
            )}
          </>
        )}

        {/* ---------- VEHICLES ---------- */}
        {view === "vehicles" && (
          <>
            {vehiclesError && <div className="notice-err">{vehiclesError}</div>}

            <div className="sec tight">
              <span className="eyebrow">Garage · {vehicles.length}</span>
              {editMode && <button className="link" onClick={openAddVehicle}>Add vehicle</button>}
            </div>

            {vehiclesLoading ? (
              <div className="empty">Loading…</div>
            ) : vehicles.length === 0 ? (
              <div className="empty">No vehicles yet. Tap Edit, then Add to start tracking one.</div>
            ) : (
              vehicles.map((v) => <VehicleRow key={v.id} vehicle={v} />)
            )}
          </>
        )}
      </div>

      {(saving || budgetSaving || remindersSaving || vehiclesSaving) && (
        <div className="saving"><span className="meta">Saving…</span></div>
      )}

      <nav className="nav">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} className={`nav-item ${view === tab.key ? "on" : ""}`} onClick={() => setView(tab.key)}>
              <Icon size={19} strokeWidth={view === tab.key ? 2.3 : 1.9} />
              <span className="nav-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bill sheet */}
      {showForm && (
        <div className="scrim" onClick={closeForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="sheet-title">{editingId ? "Edit bill" : "New bill"}</span>
              <button className="sheet-close" onClick={closeForm} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Name</span>
              <input className="input" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Electric" />
            </div>
            <div className="field-row">
              <div className="field">
                <span className="eyebrow field-label">Day due</span>
                <input className="input" type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} placeholder="15" />
              </div>
              <div className="field">
                <span className="eyebrow field-label">Amount</span>
                <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Paid by</span>
              <div className="chips chips-3">
                {PAYMENT_TYPES.map((t) => (
                  <button key={t} className={`chip ${form.paymentType === t ? "on" : ""}`} onClick={() => setForm({ ...form, paymentType: t })}>{t}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Billed</span>
              <div className="chips chips-4">
                {FREQUENCIES.map((f) => (
                  <button key={f.value} className={`chip ${form.frequencyMonths === f.value ? "on" : ""}`} onClick={() => setForm({ ...form, frequencyMonths: f.value })}>{f.label}</button>
                ))}
              </div>
            </div>
            {form.frequencyMonths > 1 && (
              <div className="field">
                <span className="eyebrow field-label">A month it lands in</span>
                <select className="input" value={form.anchorMonth} onChange={(e) => setForm({ ...form, anchorMonth: parseInt(e.target.value, 10) })}>
                  {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
                </select>
                <div className="meta hint">Bills in {dueMonthsLabel(form.frequencyMonths, form.anchorMonth)}</div>
              </div>
            )}
            <button className="btn-primary" onClick={submitForm} disabled={!form.name.trim()}>{editingId ? "Save changes" : "Add bill"}</button>
          </div>
        </div>
      )}

      {/* Income sheet */}
      {showIncomeForm && (
        <div className="scrim" onClick={closeIncomeForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="sheet-title">{editingIncomeId ? "Edit income" : "New income"}</span>
              <button className="sheet-close" onClick={closeIncomeForm} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Source</span>
              <input className="input" type="text" value={incomeForm.name} onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })} placeholder="Paycheck" />
            </div>
            <div className="field">
              <span className="eyebrow field-label">Monthly amount</span>
              <input className="input" type="number" step="0.01" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} placeholder="0.00" />
            </div>
            <button className="btn-primary" onClick={submitIncomeForm} disabled={!incomeForm.name.trim()}>{editingIncomeId ? "Save changes" : "Add income"}</button>
          </div>
        </div>
      )}

      {/* Expense sheet */}
      {showItemForm && (
        <div className="scrim" onClick={closeItemForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="sheet-title">{editingItemId ? "Edit expense" : "New expense"}</span>
              <button className="sheet-close" onClick={closeItemForm} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Name</span>
              <input className="input" type="text" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Groceries" />
            </div>
            <div className="field">
              <span className="eyebrow field-label">Monthly amount</span>
              <input className="input" type="number" step="0.01" value={itemForm.amount} onChange={(e) => setItemForm({ ...itemForm, amount: e.target.value })} placeholder="0.00" />
            </div>
            <button className="btn-primary" onClick={submitItemForm} disabled={!itemForm.name.trim()}>{editingItemId ? "Save changes" : "Add expense"}</button>
          </div>
        </div>
      )}

      {/* Reminder sheet */}
      {showReminderForm && (
        <div className="scrim" onClick={closeReminderForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="sheet-title">{editingReminderId ? "Edit reminder" : "New reminder"}</span>
              <button className="sheet-close" onClick={closeReminderForm} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="field">
              <span className="eyebrow field-label">What needs doing</span>
              <input className="input" type="text" value={reminderForm.name} onChange={(e) => setReminderForm({ ...reminderForm, name: e.target.value })} placeholder="Change furnace filter" />
            </div>
            <div className="field-row">
              <div className="field">
                <span className="eyebrow field-label">First due</span>
                <input className="input" type="date" value={reminderForm.dueDate} onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })} />
              </div>
              <div className="field">
                <span className="eyebrow field-label">Notify at</span>
                <input className="input" type="time" value={reminderForm.dueTime} onChange={(e) => setReminderForm({ ...reminderForm, dueTime: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Repeats</span>
              <div className="chips chips-3">
                {REPEAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    className={`chip ${reminderForm.repeatValue === opt.value && reminderForm.repeatUnit === opt.unit ? "on" : ""}`}
                    onClick={() => setReminderForm({ ...reminderForm, repeatValue: opt.value, repeatUnit: opt.unit })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {reminderForm.repeatUnit && <div className="meta hint">Checking it off schedules the next one.</div>}
            </div>
            <button className="btn-primary" onClick={submitReminderForm} disabled={!reminderForm.name.trim() || !reminderForm.dueDate}>{editingReminderId ? "Save changes" : "Add reminder"}</button>
          </div>
        </div>
      )}

      {/* Vehicle sheet */}
      {showVehicleForm && (
        <div className="scrim" onClick={closeVehicleForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="sheet-title">{editingVehicleId ? "Edit vehicle" : "New vehicle"}</span>
              <button className="sheet-close" onClick={closeVehicleForm} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Name</span>
              <input className="input" type="text" value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} placeholder="2019 F-150" />
            </div>
            <div className="field-row">
              <div className="field">
                <span className="eyebrow field-label">Oil change mileage</span>
                <input className="input" type="number" value={vehicleForm.mileage} onChange={(e) => setVehicleForm({ ...vehicleForm, mileage: e.target.value })} placeholder="45230" />
              </div>
              <div className="field">
                <span className="eyebrow field-label">Date changed</span>
                <input className="input" type="date" value={vehicleForm.lastOilDate} onChange={(e) => setVehicleForm({ ...vehicleForm, lastOilDate: e.target.value })} />
              </div>
            </div>
            <div className="hint" style={{ marginTop: -8, marginBottom: 16 }}>
              Update these two whenever you change the oil — that's the only mileage this app needs.
            </div>
            <div className="field">
              <span className="eyebrow field-label">Change oil every (miles)</span>
              <input className="input" type="number" value={vehicleForm.oilInterval} onChange={(e) => setVehicleForm({ ...vehicleForm, oilInterval: e.target.value })} placeholder="5000" />
              <div className="hint">Next oil change = mileage above + this number.</div>
            </div>

            <div className="eyebrow" style={{ marginBottom: 10 }}>Vehicle info</div>
            <div className="field-row">
              <div className="field">
                <span className="eyebrow field-label">Engine</span>
                <input className="input" type="text" value={vehicleForm.engine} onChange={(e) => setVehicleForm({ ...vehicleForm, engine: e.target.value })} placeholder="5.0L V8" />
              </div>
              <div className="field">
                <span className="eyebrow field-label">Tires</span>
                <input className="input" type="text" value={vehicleForm.tireSize} onChange={(e) => setVehicleForm({ ...vehicleForm, tireSize: e.target.value })} placeholder="275/65R18" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <span className="eyebrow field-label">Oil type</span>
                <input className="input" type="text" value={vehicleForm.oilType} onChange={(e) => setVehicleForm({ ...vehicleForm, oilType: e.target.value })} placeholder="5W-30 synthetic" />
              </div>
              <div className="field">
                <span className="eyebrow field-label">Oil amount</span>
                <input className="input" type="text" value={vehicleForm.oilAmount} onChange={(e) => setVehicleForm({ ...vehicleForm, oilAmount: e.target.value })} placeholder="6 qt" />
              </div>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Oil filter</span>
              <input className="input" type="text" value={vehicleForm.oilFilter} onChange={(e) => setVehicleForm({ ...vehicleForm, oilFilter: e.target.value })} placeholder="FRAM PH10575" />
            </div>
            <div className="field-row">
              <div className="field">
                <span className="eyebrow field-label">Drain plug socket</span>
                <input className="input" type="text" value={vehicleForm.drainPlugSocket} onChange={(e) => setVehicleForm({ ...vehicleForm, drainPlugSocket: e.target.value })} placeholder="15mm" />
              </div>
              <div className="field">
                <span className="eyebrow field-label">Lug nut socket</span>
                <input className="input" type="text" value={vehicleForm.lugNutSocket} onChange={(e) => setVehicleForm({ ...vehicleForm, lugNutSocket: e.target.value })} placeholder="19mm" />
              </div>
            </div>
            <div className="field">
              <span className="eyebrow field-label">Wheel torque spec</span>
              <input className="input" type="text" value={vehicleForm.wheelTorque} onChange={(e) => setVehicleForm({ ...vehicleForm, wheelTorque: e.target.value })} placeholder="150 ft-lb" />
            </div>
            <div className="field">
              <span className="eyebrow field-label">Notes (anything else)</span>
              <textarea
                className="input"
                rows={3}
                value={vehicleForm.notes}
                onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                placeholder="Anything that doesn't fit above — known issues, part numbers, reminders for next time…"
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <button className="btn-primary" onClick={submitVehicleForm} disabled={!vehicleForm.name.trim()}>{editingVehicleId ? "Save changes" : "Add vehicle"}</button>
          </div>
        </div>
      )}

      {/* Maintenance log entry sheet */}
      {showLogForm && (
        <div className="scrim" onClick={closeLogForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="sheet-title">{editingLogId ? "Edit entry" : "Log maintenance"}</span>
              <button className="sheet-close" onClick={closeLogForm} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="field">
              <span className="eyebrow field-label">What was done</span>
              <input className="input" type="text" value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} placeholder="Oil change, tire rotation, brakes…" />
            </div>
            <div className="field-row">
              <div className="field">
                <span className="eyebrow field-label">Date</span>
                <input className="input" type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />
              </div>
              <div className="field">
                <span className="eyebrow field-label">Mileage</span>
                <input className="input" type="number" value={logForm.mileage} onChange={(e) => setLogForm({ ...logForm, mileage: e.target.value })} placeholder="45230" />
              </div>
            </div>
            <button className="btn-primary" onClick={submitLogForm} disabled={!logForm.description.trim() || !logForm.date}>{editingLogId ? "Save changes" : "Add entry"}</button>
          </div>
        </div>
      )}

      {/* Backup & restore sheet */}
      {showBackup && (
        <div className="scrim" onClick={() => setShowBackup(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="sheet-title">Backup & restore</span>
              <button className="sheet-close" onClick={() => setShowBackup(false)} aria-label="Close"><X size={17} /></button>
            </div>

            <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, marginBottom: 20 }}>
              This downloads everything — bills, budget, reminders, and vehicles — as one file you can save anywhere:
              your phone's Files app, email it to yourself, or drop it in Google Drive or iCloud. Do this every so often
              so your data lives in more than one place.
            </div>

            <button className="btn-primary" onClick={exportBackup} disabled={backupBusy}>
              {backupBusy ? "Working…" : "Download backup"}
            </button>

            <div style={{ height: 1, background: "var(--line)", margin: "22px 0" }} />

            <div className="eyebrow field-label">Restore from a backup file</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
              This replaces everything currently in the app with what's in the file. Use this if you ever need to move
              to a new database or undo something that went badly wrong.
            </div>
            <label className="btn-secondary" style={{ display: "block", textAlign: "center", cursor: "pointer" }}>
              Choose backup file…
              <input type="file" accept="application/json" onChange={chooseRestoreFile} style={{ display: "none" }} />
            </label>

            {backupMessage && (
              <div className={backupMessage.type === "err" ? "notice-err" : "notice"} style={{ marginTop: 16 }}>
                <span className={backupMessage.type === "err" ? "" : "notice-text"}>{backupMessage.text}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore confirm dialog */}
      {confirmRestore && (
        <div className="dialog" onClick={() => setConfirmRestore(null)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Replace everything with this backup?</div>
            <p className="dialog-body">
              This overwrites your current bills, budget, reminders, and vehicles with what's in the file
              {confirmRestore.exportedAt ? ` (backed up ${formatLogDate(confirmRestore.exportedAt.slice(0, 10))})` : ""}.
              This can't be undone.
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmRestore(null)}>Cancel</button>
              <button className="btn-confirm" onClick={runRestore} disabled={backupBusy}>{backupBusy ? "Restoring…" : "Restore"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset dialog */}
      {confirmReset && (
        <div className="dialog" onClick={() => setConfirmReset(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Start a new month?</div>
            <p className="dialog-body">Every bill goes back to unpaid. Your list stays exactly as it is.</p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn-confirm" onClick={resetMonth}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
