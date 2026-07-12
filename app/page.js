"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, RotateCcw, X, Check, Wallet, ChevronDown, LogOut, Lock } from "lucide-react";

const PAYMENT_TYPES = ["Bank Acc.", "Autopay", "Check", "Cash", "Credit Card"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FREQUENCIES = [
  { label: "Monthly", value: 1 },
  { label: "Every 3 Mo", value: 3 },
  { label: "Every 6 Mo", value: 6 },
  { label: "Yearly", value: 12 },
];

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// A bill is "active" this month if it's monthly, or if this month falls on
// its recurring cycle counting from its anchor month.
const isBillActiveThisMonth = (bill, currentMonth) => {
  const freq = bill.frequencyMonths || 1;
  if (freq <= 1) return true;
  const anchor = bill.anchorMonth || currentMonth;
  const diff = ((currentMonth - anchor) % freq + freq) % freq;
  return diff === 0;
};

const dueMonthsLabel = (frequencyMonths, anchorMonth) => {
  if (frequencyMonths <= 1) return "Every month";
  const months = [];
  for (let m = 1; m <= 12; m++) {
    if (((m - anchorMonth) % frequencyMonths + frequencyMonths) % frequencyMonths === 0) {
      months.push(MONTH_NAMES[m - 1].slice(0, 3));
    }
  }
  return "Due in: " + months.join(", ");
};

const emptyBillForm = { name: "", dueDay: "", amount: "", paymentType: "Bank Acc.", frequencyMonths: 1, anchorMonth: new Date().getMonth() + 1 };
const emptySimpleForm = { name: "", amount: "" };

function ProgressRing({ pct, label = "Paid" }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C15F3C" />
            <stop offset="100%" stopColor="#D9825C" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={r} fill="none" stroke="#F0EDE5" strokeWidth="11" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display tabular leading-none" style={{ fontSize: 28, fontWeight: 700, color: "#2D2A26" }}>
          {pct}%
        </span>
        <span className="text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default function BillTracker() {
  const [view, setView] = useState("bills");
  const [editMode, setEditMode] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bills", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setBills(data);
    } catch (e) {
      setError("Couldn't load bills. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBudget = useCallback(async () => {
    setBudgetLoading(true);
    setBudgetError(null);
    try {
      const res = await fetch("/api/budget", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setBudgetIncomes(data.incomes || []);
      setBudgetItems(data.items || []);
    } catch (e) {
      setBudgetError("Couldn't load budget. Check your connection and try again.");
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadBudget();
  }, [load, loadBudget]);

  const persist = async (next) => {
    setBills(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("failed");
    } catch (e) {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const persistBudget = async (incomes, items) => {
    setBudgetIncomes(incomes);
    setBudgetItems(items);
    setBudgetSaving(true);
    setBudgetError(null);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incomes, items }),
      });
      if (!res.ok) throw new Error("failed");
    } catch (e) {
      setBudgetError("Couldn't save. Check your connection and try again.");
    } finally {
      setBudgetSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyBillForm);
    setShowForm(true);
  };
  const openEdit = (bill) => {
    setEditingId(bill.id);
    setForm({
      name: bill.name,
      dueDay: String(bill.dueDay),
      amount: String(bill.amount),
      paymentType: bill.paymentType,
      frequencyMonths: bill.frequencyMonths || 1,
      anchorMonth: bill.anchorMonth || new Date().getMonth() + 1,
    });
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyBillForm);
  };
  const submitForm = () => {
    const name = form.name.trim();
    const dueDay = Math.min(31, Math.max(1, parseInt(form.dueDay, 10) || 1));
    const amount = parseFloat(form.amount) || 0;
    const frequencyMonths = form.frequencyMonths || 1;
    const anchorMonth = form.anchorMonth || new Date().getMonth() + 1;
    if (!name) return;
    if (editingId) {
      const next = bills.map((b) => (b.id === editingId ? { ...b, name, dueDay, amount, paymentType: form.paymentType, frequencyMonths, anchorMonth } : b));
      persist(next);
    } else {
      const next = [...bills, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, dueDay, amount, paymentType: form.paymentType, frequencyMonths, anchorMonth, paid: false }];
      persist(next);
    }
    closeForm();
  };
  const togglePaid = (id) => {
    const next = bills.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b));
    persist(next);
  };
  const deleteBill = (id) => {
    const next = bills.filter((b) => b.id !== id);
    persist(next);
  };
  const resetMonth = () => {
    const next = bills.map((b) => ({ ...b, paid: false }));
    persist(next);
    setConfirmReset(false);
  };

  const openAddIncome = () => {
    setEditingIncomeId(null);
    setIncomeForm(emptySimpleForm);
    setShowIncomeForm(true);
  };
  const openEditIncome = (inc) => {
    setEditingIncomeId(inc.id);
    setIncomeForm({ name: inc.name, amount: String(inc.amount) });
    setShowIncomeForm(true);
  };
  const closeIncomeForm = () => {
    setShowIncomeForm(false);
    setEditingIncomeId(null);
    setIncomeForm(emptySimpleForm);
  };
  const submitIncomeForm = () => {
    const name = incomeForm.name.trim();
    const amount = parseFloat(incomeForm.amount) || 0;
    if (!name) return;
    if (editingIncomeId) {
      const next = budgetIncomes.map((i) => (i.id === editingIncomeId ? { ...i, name, amount } : i));
      persistBudget(next, budgetItems);
    } else {
      const next = [...budgetIncomes, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, amount }];
      persistBudget(next, budgetItems);
    }
    closeIncomeForm();
  };
  const deleteIncome = (id) => {
    const next = budgetIncomes.filter((i) => i.id !== id);
    persistBudget(next, budgetItems);
  };

  const openAddItem = () => {
    setEditingItemId(null);
    setItemForm(emptySimpleForm);
    setShowItemForm(true);
  };
  const openEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm({ name: item.name, amount: String(item.amount) });
    setShowItemForm(true);
  };
  const closeItemForm = () => {
    setShowItemForm(false);
    setEditingItemId(null);
    setItemForm(emptySimpleForm);
  };
  const submitItemForm = () => {
    const name = itemForm.name.trim();
    const amount = parseFloat(itemForm.amount) || 0;
    if (!name) return;
    if (editingItemId) {
      const next = budgetItems.map((i) => (i.id === editingItemId ? { ...i, name, amount } : i));
      persistBudget(budgetIncomes, next);
    } else {
      const next = [...budgetItems, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, amount }];
      persistBudget(budgetIncomes, next);
    }
    closeItemForm();
  };
  const deleteItem = (id) => {
    const next = budgetItems.filter((i) => i.id !== id);
    persistBudget(budgetIncomes, next);
  };

  const currentMonth = new Date().getMonth() + 1;
  const activeBills = bills.filter((b) => isBillActiveThisMonth(b, currentMonth));
  const inactiveBills = bills.filter((b) => !isBillActiveThisMonth(b, currentMonth));
  const unpaid = activeBills.filter((b) => !b.paid).sort((a, b) => a.dueDay - b.dueDay);
  const paid = activeBills.filter((b) => b.paid).sort((a, b) => a.dueDay - b.dueDay);
  const total = activeBills.reduce((sum, b) => sum + b.amount, 0);
  const paidTotal = activeBills.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0);
  const remaining = total - paidTotal;
  const progressPct = total > 0 ? Math.round((paidTotal / total) * 100) : 0;
  const today = new Date().getDate();
  const nextBill = unpaid.find((b) => b.dueDay >= today) || (unpaid.length ? unpaid[0] : null);
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const totalIncome = budgetIncomes.reduce((s, i) => s + i.amount, 0);
  const otherExpensesTotal = budgetItems.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = total + otherExpensesTotal;
  const leftover = totalIncome - totalExpenses;
  const weeklyLeftover = leftover / 4;
  const allocatedPct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
  const leftoverColor = leftover >= 0 ? "#6E8F6C" : "#A8492C";

  const BillRow = ({ bill }) => (
    <div className="relative card row-shadow rounded-2xl overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 3, backgroundColor: bill.paid ? "#6E8F6C" : "#C15F3C" }} />
      <div className="flex items-stretch" style={{ paddingLeft: 3 }}>
        <button onClick={() => togglePaid(bill.id)} className="shrink-0 flex items-center justify-center active:opacity-60" style={{ width: 64 }}>
          <span
            className="rounded-full flex items-center justify-center"
            style={{ width: 28, height: 28, border: bill.paid ? "2px solid #6E8F6C" : "2px solid #E5D9CF", backgroundColor: bill.paid ? "#6E8F6C" : "#ffffff" }}
          >
            {bill.paid && <Check size={15} color="#ffffff" strokeWidth={3} />}
          </span>
        </button>
        <div className="flex-1 py-3.5 pr-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold truncate" style={{ color: bill.paid ? "#A39D8E" : "#2D2A26", textDecoration: bill.paid ? "line-through" : "none" }}>
                {bill.name}
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                Due the {ordinal(bill.dueDay)} · {bill.paymentType}
                {(bill.frequencyMonths || 1) > 1 && ` · ${dueMonthsLabel(bill.frequencyMonths, bill.anchorMonth)}`}
              </div>
            </div>
            <div className="tabular font-semibold shrink-0" style={{ fontSize: 16, color: bill.paid ? "#A39D8E" : "#2D2A26" }}>
              ${bill.amount.toFixed(2)}
            </div>
          </div>
        </div>
        {editMode && (
          <div className="flex flex-col border-hair" style={{ borderLeftWidth: 1, borderLeftStyle: "solid" }}>
            <button onClick={() => openEdit(bill)} className="flex-1 px-3 flex items-center justify-center active:bg-black/5" style={{ color: "#B5AFA1" }}>
              <Pencil size={14} />
            </button>
            <button onClick={() => deleteBill(bill.id)} className="flex-1 px-3 flex items-center justify-center border-hair active:bg-black/5" style={{ color: "#B5AFA1", borderTopWidth: 1, borderTopStyle: "solid" }}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const SimpleRow = ({ name, amount, onEdit, onDelete, accent }) => (
    <div className="relative card row-shadow rounded-2xl overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 3, backgroundColor: accent }} />
      <div className="flex items-stretch" style={{ paddingLeft: 3 }}>
        <div className="flex-1 py-3.5 px-4 min-w-0 flex items-center justify-between gap-2">
          <div className="font-semibold truncate" style={{ color: "#2D2A26" }}>{name}</div>
          <div className="tabular font-semibold shrink-0" style={{ fontSize: 16, color: "#2D2A26" }}>${amount.toFixed(2)}</div>
        </div>
        {editMode && (
          <div className="flex flex-col border-hair" style={{ borderLeftWidth: 1, borderLeftStyle: "solid" }}>
            <button onClick={onEdit} className="flex-1 px-3 flex items-center justify-center active:bg-black/5" style={{ color: "#B5AFA1" }}>
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="flex-1 px-3 flex items-center justify-center border-hair active:bg-black/5" style={{ color: "#B5AFA1", borderTopWidth: 1, borderTopStyle: "solid" }}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream text-ink font-sans pb-28">
      <div className="px-5 pt-7 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-gradient rounded-xl flex items-center justify-center" style={{ width: 40, height: 40 }}>
            <Wallet size={19} color="#ffffff" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "#2D2A26", lineHeight: 1.2 }}>Bills</h1>
            <p className="text-muted" style={{ fontSize: 11, lineHeight: 1.2 }}>Household tracker</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted card" style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 999 }}>{monthLabel}</span>
          <button
            onClick={() => setEditMode((e) => !e)}
            className={editMode ? "btn-gradient" : "card"}
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, color: editMode ? "#ffffff" : "#5B564C", display: "flex", alignItems: "center", gap: 4 }}
          >
            {editMode ? <Check size={13} /> : <Lock size={13} />}
            {editMode ? "Done" : "Edit"}
          </button>
          <button onClick={logout} className="text-muted" style={{ padding: 6 }} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="card flex" style={{ borderRadius: 14, padding: 4 }}>
          <button
            onClick={() => setView("bills")}
            className={`flex-1 rounded-xl ${view === "bills" ? "btn-gradient" : ""}`}
            style={{ padding: "9px 0", fontSize: 13, fontWeight: 600, color: view === "bills" ? "#ffffff" : "#8C8577" }}
          >
            Bills
          </button>
          <button
            onClick={() => setView("budget")}
            className={`flex-1 rounded-xl ${view === "budget" ? "btn-gradient" : ""}`}
            style={{ padding: "9px 0", fontSize: 13, fontWeight: 600, color: view === "budget" ? "#ffffff" : "#8C8577" }}
          >
            Budget
          </button>
        </div>
      </div>

      {view === "bills" ? (
        <>
          <div className="mx-5 mt-4 card card-shadow" style={{ borderRadius: 24, padding: 20 }}>
            <div className="flex items-center gap-5">
              <ProgressRing pct={progressPct} label="Paid" />
              <div className="flex-1" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#2D2A26" }} />
                    <span className="text-muted" style={{ fontSize: 12 }}>Total</span>
                  </div>
                  <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: "#2D2A26" }}>${total.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#6E8F6C" }} />
                    <span className="text-muted" style={{ fontSize: 12 }}>Paid</span>
                  </div>
                  <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: "#6E8F6C" }}>${paidTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#C15F3C" }} />
                    <span className="text-muted" style={{ fontSize: 12 }}>Remaining</span>
                  </div>
                  <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: "#C15F3C" }}>${remaining.toFixed(2)}</span>
                </div>
              </div>
            </div>
            {nextBill && (
              <div className="flex items-center justify-between border-hair" style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopStyle: "solid" }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Next up</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2D2A26", marginTop: 2 }}>{nextBill.name} · due the {ordinal(nextBill.dueDay)}</div>
                </div>
                <div className="tabular" style={{ fontSize: 14, fontWeight: 600, color: "#2D2A26" }}>${nextBill.amount.toFixed(2)}</div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-5 mt-4 px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: "#FBEAE4", border: "1px solid #EFC6B6", color: "#A8492C" }}>{error}</div>
          )}

          <div className="px-5 mt-6">
            {loading ? (
              <div className="text-center text-muted text-sm py-10">Loading…</div>
            ) : bills.length === 0 ? (
              <div className="text-center text-muted text-sm py-12 rounded-2xl" style={{ border: "1px dashed #E5E0D5" }}>No bills yet. Tap + Add Bill to start your list.</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Upcoming ({unpaid.length})</span>
                </div>
                <div className="space-y-2.5">
                  {unpaid.length === 0 ? (
                    <div className="text-center text-muted text-sm py-8 rounded-2xl" style={{ border: "1px dashed #E5E0D5" }}>Nothing left to pay this month</div>
                  ) : (
                    unpaid.map((bill) => <BillRow key={bill.id} bill={bill} />)
                  )}
                </div>
                {paid.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowPaid((s) => !s)} className="w-full flex items-center justify-between mb-2.5">
                      <span className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Paid ({paid.length})</span>
                      <ChevronDown size={15} color="#8C8577" style={{ transition: "transform 0.2s", transform: showPaid ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>
                    {showPaid && <div className="space-y-2.5">{paid.map((bill) => <BillRow key={bill.id} bill={bill} />)}</div>}
                  </div>
                )}
                {inactiveBills.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowInactive((s) => !s)} className="w-full flex items-center justify-between mb-2.5">
                      <span className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Not Due This Month ({inactiveBills.length})</span>
                      <ChevronDown size={15} color="#8C8577" style={{ transition: "transform 0.2s", transform: showInactive ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>
                    {showInactive && (
                      <div className="space-y-2.5">
                        {[...inactiveBills].sort((a, b) => a.dueDay - b.dueDay).map((bill) => <BillRow key={bill.id} bill={bill} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mx-5 mt-4 card card-shadow" style={{ borderRadius: 24, padding: 20 }}>
            <div className="flex items-center gap-5">
              <ProgressRing pct={allocatedPct} label="Spent" />
              <div className="flex-1" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#2D2A26" }} />
                    <span className="text-muted" style={{ fontSize: 12 }}>Income</span>
                  </div>
                  <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: "#2D2A26" }}>${totalIncome.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#C15F3C" }} />
                    <span className="text-muted" style={{ fontSize: 12 }}>Expenses</span>
                  </div>
                  <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: "#C15F3C" }}>${totalExpenses.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: leftoverColor }} />
                    <span className="text-muted" style={{ fontSize: 12 }}>Leftover</span>
                  </div>
                  <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: leftoverColor }}>${leftover.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-hair" style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopStyle: "solid" }}>
              <div>
                <div className="text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Per week</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2D2A26", marginTop: 2 }}>Leftover to spend</div>
              </div>
              <div className="tabular" style={{ fontSize: 14, fontWeight: 600, color: leftoverColor }}>${weeklyLeftover.toFixed(2)}</div>
            </div>
          </div>

          {budgetError && (
            <div className="mx-5 mt-4 px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: "#FBEAE4", border: "1px solid #EFC6B6", color: "#A8492C" }}>{budgetError}</div>
          )}

          {budgetLoading ? (
            <div className="text-center text-muted text-sm py-10">Loading…</div>
          ) : (
            <>
              <div className="px-5 mt-6">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Income ({budgetIncomes.length})</span>
                  {editMode && <button onClick={openAddIncome} style={{ color: "#C15F3C", fontSize: 12, fontWeight: 600 }}>+ Add</button>}
                </div>
                <div className="space-y-2.5">
                  {budgetIncomes.length === 0 ? (
                    <div className="text-center text-muted text-sm py-8 rounded-2xl" style={{ border: "1px dashed #E5E0D5" }}>No income sources yet.</div>
                  ) : (
                    budgetIncomes.map((inc) => (
                      <SimpleRow key={inc.id} name={inc.name} amount={inc.amount} accent="#6E8F6C" onEdit={() => openEditIncome(inc)} onDelete={() => deleteIncome(inc.id)} />
                    ))
                  )}
                </div>
              </div>

              <div className="px-5 mt-6">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Bills This Month ({activeBills.length})</span>
                  {editMode && <button onClick={openAdd} style={{ color: "#C15F3C", fontSize: 12, fontWeight: 600 }}>+ Add</button>}
                </div>
                <p className="text-muted" style={{ fontSize: 11, marginBottom: 10 }}>
                  Same bills as the Bills tab — edit one here and it updates there too. Quarterly/yearly bills only appear in the months they're due.
                </p>
                <div className="space-y-2.5">
                  {activeBills.length === 0 ? (
                    <div className="text-center text-muted text-sm py-8 rounded-2xl" style={{ border: "1px dashed #E5E0D5" }}>No bills due this month.</div>
                  ) : (
                    [...activeBills]
                      .sort((a, b) => a.dueDay - b.dueDay)
                      .map((bill) => (
                        <SimpleRow key={bill.id} name={bill.name} amount={bill.amount} accent="#6E8F6C" onEdit={() => openEdit(bill)} onDelete={() => deleteBill(bill.id)} />
                      ))
                  )}
                </div>
              </div>

              <div className="px-5 mt-6">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Other Expenses ({budgetItems.length})</span>
                  {editMode && <button onClick={openAddItem} style={{ color: "#C15F3C", fontSize: 12, fontWeight: 600 }}>+ Add</button>}
                </div>
                <div className="space-y-2.5">
                  {budgetItems.length === 0 ? (
                    <div className="text-center text-muted text-sm py-8 rounded-2xl" style={{ border: "1px dashed #E5E0D5" }}>No other expenses yet.</div>
                  ) : (
                    budgetItems.map((item) => (
                      <SimpleRow key={item.id} name={item.name} amount={item.amount} accent="#C15F3C" onEdit={() => openEditItem(item)} onDelete={() => deleteItem(item.id)} />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!editMode ? (
        <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center border-hair" style={{ backgroundColor: "rgba(250,249,245,0.95)", backdropFilter: "blur(6px)", padding: "16px 20px", borderTopWidth: 1, borderTopStyle: "solid" }}>
          <span className="text-muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={13} />
            Tap Edit to make changes
          </span>
        </div>
      ) : view === "bills" ? (
        <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-hair" style={{ backgroundColor: "rgba(250,249,245,0.95)", backdropFilter: "blur(6px)", padding: "12px 20px", borderTopWidth: 1, borderTopStyle: "solid" }}>
          <button onClick={() => setConfirmReset(true)} className="card flex items-center justify-center gap-2 active:opacity-70" style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 500, color: "#5B564C" }}>
            <RotateCcw size={15} />
            Reset
          </button>
          <button onClick={openAdd} className="btn-gradient flex-1 flex items-center justify-center gap-2 active:opacity-90" style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
            <Plus size={16} />
            Add Bill
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-hair" style={{ backgroundColor: "rgba(250,249,245,0.95)", backdropFilter: "blur(6px)", padding: "12px 20px", borderTopWidth: 1, borderTopStyle: "solid" }}>
          <button onClick={openAddIncome} className="card flex items-center justify-center gap-2 active:opacity-70" style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 500, color: "#5B564C" }}>
            <Plus size={15} />
            Income
          </button>
          <button onClick={openAddItem} className="btn-gradient flex-1 flex items-center justify-center gap-2 active:opacity-90" style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      )}

      {(saving || budgetSaving) && (
        <div style={{ position: "fixed", bottom: 72, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <span className="text-muted" style={{ fontSize: 11, backgroundColor: "rgba(250,249,245,0.9)", padding: "0 8px" }}>saving…</span>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 flex items-end z-20" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full bg-white px-5 pt-5 pb-8" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)", maxHeight: "88vh", overflowY: "auto" }}>
            <div className="mx-auto mb-4" style={{ width: 40, height: 4, backgroundColor: "#E5E0D5", borderRadius: 999 }} />
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "#2D2A26" }}>{editingId ? "Edit Bill" : "Add Bill"}</h2>
              <button onClick={closeForm} className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "#F5F3EE", color: "#8C8577" }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Bill name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Electric" className="input-field w-full mt-1 rounded-xl px-3 py-3" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Due day</label>
                  <input type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} placeholder="15" className="input-field w-full mt-1 rounded-xl px-3 py-3" />
                </div>
                <div className="flex-1">
                  <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Amount</label>
                  <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="input-field w-full mt-1 rounded-xl px-3 py-3" />
                </div>
              </div>
              <div>
                <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Payment type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {PAYMENT_TYPES.map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, paymentType: t })} className={`chip ${form.paymentType === t ? "active" : ""} rounded-lg`} style={{ padding: "8px 0", fontSize: 12, fontWeight: 500 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Frequency</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {FREQUENCIES.map((f) => (
                    <button key={f.value} onClick={() => setForm({ ...form, frequencyMonths: f.value })} className={`chip ${form.frequencyMonths === f.value ? "active" : ""} rounded-lg`} style={{ padding: "8px 0", fontSize: 11, fontWeight: 500 }}>{f.label}</button>
                  ))}
                </div>
              </div>
              {form.frequencyMonths > 1 && (
                <div>
                  <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>One month it's due</label>
                  <select
                    value={form.anchorMonth}
                    onChange={(e) => setForm({ ...form, anchorMonth: parseInt(e.target.value, 10) })}
                    className="input-field w-full mt-1 rounded-xl px-3 py-3"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i} value={i + 1}>{name}</option>
                    ))}
                  </select>
                  <p className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>{dueMonthsLabel(form.frequencyMonths, form.anchorMonth)}</p>
                </div>
              )}
              <button onClick={submitForm} disabled={!form.name.trim()} className="btn-gradient w-full mt-2 rounded-xl" style={{ padding: "14px 0", fontSize: 14, fontWeight: 600, color: "#ffffff", opacity: !form.name.trim() ? 0.4 : 1 }}>
                {editingId ? "Save changes" : "Add bill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIncomeForm && (
        <div className="fixed inset-0 flex items-end z-20" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full bg-white px-5 pt-5 pb-8" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)" }}>
            <div className="mx-auto mb-4" style={{ width: 40, height: 4, backgroundColor: "#E5E0D5", borderRadius: 999 }} />
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "#2D2A26" }}>{editingIncomeId ? "Edit Income" : "Add Income"}</h2>
              <button onClick={closeIncomeForm} className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "#F5F3EE", color: "#8C8577" }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Source name</label>
                <input type="text" value={incomeForm.name} onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })} placeholder="e.g. Michael Monthly Income" className="input-field w-full mt-1 rounded-xl px-3 py-3" />
              </div>
              <div>
                <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Amount</label>
                <input type="number" step="0.01" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} placeholder="0.00" className="input-field w-full mt-1 rounded-xl px-3 py-3" />
              </div>
              <button onClick={submitIncomeForm} disabled={!incomeForm.name.trim()} className="btn-gradient w-full mt-2 rounded-xl" style={{ padding: "14px 0", fontSize: 14, fontWeight: 600, color: "#ffffff", opacity: !incomeForm.name.trim() ? 0.4 : 1 }}>
                {editingIncomeId ? "Save changes" : "Add income"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showItemForm && (
        <div className="fixed inset-0 flex items-end z-20" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full bg-white px-5 pt-5 pb-8" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)" }}>
            <div className="mx-auto mb-4" style={{ width: 40, height: 4, backgroundColor: "#E5E0D5", borderRadius: 999 }} />
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "#2D2A26" }}>{editingItemId ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={closeItemForm} className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "#F5F3EE", color: "#8C8577" }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Expense name</label>
                <input type="text" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Groceries" className="input-field w-full mt-1 rounded-xl px-3 py-3" />
              </div>
              <div>
                <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>Amount</label>
                <input type="number" step="0.01" value={itemForm.amount} onChange={(e) => setItemForm({ ...itemForm, amount: e.target.value })} placeholder="0.00" className="input-field w-full mt-1 rounded-xl px-3 py-3" />
              </div>
              <button onClick={submitItemForm} disabled={!itemForm.name.trim()} className="btn-gradient w-full mt-2 rounded-xl" style={{ padding: "14px 0", fontSize: 14, fontWeight: 600, color: "#ffffff", opacity: !itemForm.name.trim() ? 0.4 : 1 }}>
                {editingItemId ? "Save changes" : "Add expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="fixed inset-0 flex items-center justify-center z-20 px-6" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-6" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "#2D2A26", marginBottom: 8 }}>Reset for new month?</h3>
            <p style={{ fontSize: 14, color: "#5B564C", marginBottom: 24 }}>This marks every bill as unpaid again. Your bill list stays exactly the same — nothing gets deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl" style={{ padding: "10px 0", border: "1px solid #E5E0D5", color: "#5B564C", fontSize: 14, fontWeight: 500 }}>Cancel</button>
              <button onClick={resetMonth} className="btn-gradient flex-1 rounded-xl" style={{ padding: "10px 0", color: "#ffffff", fontSize: 14, fontWeight: 600 }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
