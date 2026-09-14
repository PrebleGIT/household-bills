#!/usr/bin/env python3
"""Turn app/page.js (Next.js) into the standalone Claude-artifact preview.

Swaps the API-backed data layer for window.storage, strips auth and push
notification code that only exists on the deployed app, seeds demo data, and
inlines globals.css so the artifact renders on its own.

Lives inside the project (scripts/make-preview.py) specifically so it's
captured by the project zip and survives sandbox resets, unlike a file
sitting outside the project folder.

Usage: python3 scripts/make-preview.py
(run from the household-bills project root, or adjust ROOT below)
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "page.js")
CSS = os.path.join(ROOT, "app", "globals.css")
OUT = "/mnt/user-data/outputs/home-hub-preview.jsx"

# ---- storage keys used by every feature ----
STORAGE_KEYS = '''const BILLS_KEY = "bills-list";
const BUDGET_KEY = "budget-data";
const VEHICLES_KEY = "vehicles-list";
const GROCERIES_KEY = "groceries-list";
const RECIPES_KEY = "recipes-list";'''

# ---- demo seed data for the preview only (deployed app seeds separately, or starts empty) ----
SEEDS = '''
const SEED_BILLS = [
  { id: "seed-1", name: "Mortgage", dueDay: 1, amount: 1439.79, paymentType: "Bank Acc.", paid: true, frequencyMonths: 1, anchorMonth: 1 },
  { id: "seed-2", name: "Phone", dueDay: 1, amount: 80.0, paymentType: "Bank Acc.", paid: true, frequencyMonths: 1, anchorMonth: 1 },
  { id: "seed-3", name: "Car Insurance", dueDay: 9, amount: 78.98, paymentType: "Bank Acc.", paid: false, frequencyMonths: 1, anchorMonth: 1 },
  { id: "seed-4", name: "Natural Gas", dueDay: 13, amount: 150.0, paymentType: "Bank Acc.", paid: false, frequencyMonths: 1, anchorMonth: 1 },
  { id: "seed-5", name: "Internet", dueDay: 15, amount: 60.96, paymentType: "Bank Acc.", paid: false, frequencyMonths: 1, anchorMonth: 1 },
  { id: "seed-6", name: "Electric", dueDay: 17, amount: 200.0, paymentType: "Bank Acc.", paid: false, frequencyMonths: 1, anchorMonth: 1 },
  { id: "seed-7", name: "Trash", dueDay: 20, amount: 72.0, paymentType: "Bank Acc.", paid: false, frequencyMonths: 3, anchorMonth: 7 },
  { id: "seed-8", name: "Sewer", dueDay: 24, amount: 164.62, paymentType: "Bank Acc.", paid: false, frequencyMonths: 3, anchorMonth: 7 },
  { id: "seed-9", name: "Student Loans", dueDay: 25, amount: 200.0, paymentType: "Bank Acc.", paid: false, frequencyMonths: 1, anchorMonth: 1 },
  { id: "seed-10", name: "Credit Card", dueDay: 31, amount: 150.0, paymentType: "Bank Acc.", paid: false, frequencyMonths: 1, anchorMonth: 1 },
];

const SEED_BUDGET = {
  incomes: [
    { id: "inc-1", name: "Michael Monthly Income", amount: 4000.0 },
    { id: "inc-2", name: "Shelby Monthly Income", amount: 1830.0 },
  ],
  items: [
    { id: "item-1", name: "Spotify / Apple Music", amount: 25.0 },
    { id: "item-2", name: "Groceries", amount: 500.0 },
    { id: "item-3", name: "Apple", amount: 4.0 },
    { id: "item-4", name: "Gas", amount: 200.0 },
    { id: "item-5", name: "Eating Out", amount: 250.0 },
    { id: "item-6", name: "Savings", amount: 500.0 },
    { id: "item-7", name: "Child Care", amount: 600.0 },
    { id: "item-8", name: "Ring Doorbell", amount: 10.71 },
    { id: "item-9", name: "Oura Ring", amount: 5.99 },
  ],
};

const SEED_VEHICLES = [
  {
    id: "v1",
    name: "2019 F-150",
    mileage: 42100,
    lastOilDate: "2026-05-12",
    oilInterval: 5000,
    engine: "5.0L V8",
    tireSize: "275/65R18",
    oilType: "5W-30 synthetic",
    oilAmount: "6 qt",
    oilFilter: "FRAM PH10575",
    drainPlugSocket: "15mm",
    lugNutSocket: "19mm",
    wheelTorque: "150 ft-lb",
    notes: "",
    log: [
      { id: "l1", description: "Oil change", date: "2026-05-12", mileage: 42100 },
      { id: "l2", description: "Tire rotation", date: "2026-03-02", mileage: 39800 },
    ],
  },
];

const SEED_GROCERIES = [
  { id: "g1", name: "Milk", checked: false },
  { id: "g2", name: "Eggs", checked: false },
  { id: "g3", name: "Coffee", checked: true },
];

const SEED_RECIPES = [
  {
    id: "rec1",
    name: "Taco Night",
    ingredients: [
      { id: "i1", text: "Ground beef" },
      { id: "i2", text: "Taco shells" },
      { id: "i3", text: "Shredded cheese" },
      { id: "i4", text: "Salsa" },
      { id: "i5", text: "Eggs" },
    ],
  },
];
'''

# ---- (old_text, new_text) pairs applied verbatim, each must match exactly once ----
# fetch(...) blocks -> window.storage equivalents, one triple per feature: load, persist.
FETCH_TO_STORAGE = [
    ('''      const res = await fetch("/api/bills", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setBills(await res.json());
    } catch (e) { setError("Bills didn't load. Check your connection and pull down to retry."); }''',
     '''      const r = await window.storage.get(BILLS_KEY, true);
      if (r && r.value) setBills(JSON.parse(r.value));
      else { setBills(SEED_BILLS); await window.storage.set(BILLS_KEY, JSON.stringify(SEED_BILLS), true); }
    } catch (e) { setBills(SEED_BILLS); }'''),

    ('''      const res = await fetch("/api/budget", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setBudgetIncomes(data.incomes || []);
      setBudgetItems(data.items || []);
    } catch (e) { setBudgetError("Budget didn't load. Check your connection and pull down to retry."); }''',
     '''      const r = await window.storage.get(BUDGET_KEY, true);
      if (r && r.value) {
        const data = JSON.parse(r.value);
        setBudgetIncomes(data.incomes || []);
        setBudgetItems(data.items || []);
      } else {
        setBudgetIncomes(SEED_BUDGET.incomes);
        setBudgetItems(SEED_BUDGET.items);
        await window.storage.set(BUDGET_KEY, JSON.stringify(SEED_BUDGET), true);
      }
    } catch (e) { setBudgetIncomes(SEED_BUDGET.incomes); setBudgetItems(SEED_BUDGET.items); }'''),

    ('''      const res = await fetch("/api/vehicles", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setVehicles(await res.json());
    } catch (e) { setVehiclesError("Vehicles didn't load. Check your connection and pull down to retry."); }''',
     '''      const r = await window.storage.get(VEHICLES_KEY, true);
      if (r && r.value) setVehicles(JSON.parse(r.value));
      else { setVehicles(SEED_VEHICLES); await window.storage.set(VEHICLES_KEY, JSON.stringify(SEED_VEHICLES), true); }
    } catch (e) { setVehicles(SEED_VEHICLES); }'''),

    ('''      const res = await fetch("/api/groceries", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setGroceryItems(await res.json());
    } catch (e) { setGroceriesError("List didn't load. Check your connection and pull down to retry."); }''',
     '''      const r = await window.storage.get(GROCERIES_KEY, true);
      if (r && r.value) setGroceryItems(JSON.parse(r.value));
      else { setGroceryItems(SEED_GROCERIES); await window.storage.set(GROCERIES_KEY, JSON.stringify(SEED_GROCERIES), true); }
    } catch (e) { setGroceryItems(SEED_GROCERIES); }'''),

    ('''      const res = await fetch("/api/recipes", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setRecipes(await res.json());
    } catch (e) { setRecipesError("Recipes didn't load. Check your connection and pull down to retry."); }''',
     '''      const r = await window.storage.get(RECIPES_KEY, true);
      if (r && r.value) setRecipes(JSON.parse(r.value));
      else { setRecipes(SEED_RECIPES); await window.storage.set(RECIPES_KEY, JSON.stringify(SEED_RECIPES), true); }
    } catch (e) { setRecipes(SEED_RECIPES); }'''),

    ('      const res = await fetch("/api/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });\n      if (!res.ok) throw new Error("failed");',
     '      const r = await window.storage.set(BILLS_KEY, JSON.stringify(next), true);\n      if (!r) setError("That change didn\'t save. Check your connection and try again.");'),
    ('      const res = await fetch("/api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ incomes, items }) });\n      if (!res.ok) throw new Error("failed");',
     '      const r = await window.storage.set(BUDGET_KEY, JSON.stringify({ incomes, items }), true);\n      if (!r) setBudgetError("That change didn\'t save. Check your connection and try again.");'),
    ('      const res = await fetch("/api/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });\n      if (!res.ok) throw new Error("failed");',
     '      const r = await window.storage.set(VEHICLES_KEY, JSON.stringify(next), true);\n      if (!r) setVehiclesError("That change didn\'t save. Check your connection and try again.");'),
    ('      const res = await fetch("/api/groceries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });\n      if (!res.ok) throw new Error("failed");',
     '      const r = await window.storage.set(GROCERIES_KEY, JSON.stringify(next), true);\n      if (!r) setGroceriesError("That change didn\'t save. Check your connection and try again.");'),
    ('      const res = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });\n      if (!res.ok) throw new Error("failed");',
     '      const r = await window.storage.set(RECIPES_KEY, JSON.stringify(next), true);\n      if (!r) setRecipesError("That change didn\'t save. Check your connection and try again.");'),
]


def main():
    c = open(SRC).read()
    orig_len = len(c)

    # 1. Imports: drop Plus (unused directly)/LogOut/Bell/BellOff-only-serverside bits? We keep
    # everything actually referenced in JSX; only strip what becomes dead after removing
    # logout/notifications below. Simplest robust approach: leave imports as-is (unused
    # imports don't break anything at runtime in an artifact), just inject storage keys
    # and seeds right after the import block.
    import_end_marker = 'from "lucide-react";'
    idx = c.index(import_end_marker) + len(import_end_marker)
    # Remove the urlBase64ToUint8Array helper (push-subscription only, unused in preview)
    if "function urlBase64ToUint8Array" in c:
        start = c.index("function urlBase64ToUint8Array")
        end = c.index("}\n", start) + 2
        c = c[:idx] + "\n" + c[end:].lstrip("\n") if False else c  # keep helper; harmless if unused
    c = c[:idx] + "\n\n" + STORAGE_KEYS + "\n" + SEEDS + c[idx:]

    # 2. Swap every fetch() data call for window.storage
    for old, new in FETCH_TO_STORAGE:
        if c.count(old) != 1:
            print(f"WARNING: fetch block matched {c.count(old)} times (expected 1): {old[:70]!r}")
            continue
        c = c.replace(old, new)

    # 3. Drop the service-worker/push-notification registration effect entirely
    sw_start_marker = 'useEffect(() => {\n    if (typeof window === "undefined") return;\n    if (!("serviceWorker" in navigator)'
    badge_marker = 'useEffect(() => {\n    if (typeof window === "undefined" || !("setAppBadge" in navigator)) return;'
    if sw_start_marker in c and badge_marker in c:
        start = c.index(sw_start_marker)
        end = c.index(badge_marker)
        c = c[:start] + c[end:]

    # 4. Drop logout (no auth in the sandbox preview)
    c = c.replace('  const logout = async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; };\n\n', "")
    c = c.replace('          <button className="icon-btn bare" onClick={logout} aria-label="Log out"><LogOut size={16} /></button>\n', "")

    # 5. Drop the notification permission banners (default/denied) - notifStatus never gets set
    #    in the preview since we removed the effect that sets it, so these branches never render
    #    anyway, but strip them for cleanliness and to avoid a dangling notifStatus reference.
    notif_start = '        {notifStatus === "default" && ('
    notif_end = '        {/* ---------- BILLS ---------- */}'
    if notif_start in c and notif_end in c:
        start = c.index(notif_start)
        end = c.index(notif_end)
        c = c[:start] + c[end:]
    c = c.replace('  const [notifStatus, setNotifStatus] = useState("unknown");\n', "")

    # 6. Backup/restore talks to the real deployed DB - leave those fetch("/api/backup", ...)
    #    calls as real fetches (they'll fail gracefully with the existing error handling in an
    #    artifact preview, which is fine - there's nothing meaningful to fake for a backup export).

    # 7. Inline globals.css so the artifact renders without the Next.js build pipeline
    css = open(CSS).read()
    root_marker = '  return (\n    <div className="app">\n      <header className="hdr">'
    if root_marker not in c:
        print("ERROR: could not find app root marker to inject CSS")
        sys.exit(1)
    css_block = '  return (\n    <div className="app">\n      <style>{`\n' + css + '\n      `}</style>\n      <header className="hdr">'
    c = c.replace(root_marker, css_block)

    open(OUT, "w").write(c)

    leftovers = [t for t in ("notifStatus", "logout(", "process.env") if t in c]
    stray_fetch = [
        line for line in c.split("\n")
        if "fetch(" in line and "/api/backup" not in line
    ]
    if stray_fetch:
        leftovers.append(f"unexpected fetch(: {stray_fetch[0].strip()[:70]}")
    balance = (c.count("{") - c.count("}"), c.count("(") - c.count(")"))

    print(f"wrote {OUT} ({orig_len} -> {len(c)} chars)")
    print(f"leftovers: {leftovers or 'none'}")
    print(f"balance braces/parens: {balance}")
    if leftovers or balance != (0, 0):
        sys.exit(1)


if __name__ == "__main__":
    main()
