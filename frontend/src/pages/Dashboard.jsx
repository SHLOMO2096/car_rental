// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { carsAPI } from "../api/cars";
import { bookingsAPI } from "../api/bookings";
import { settingsAPI } from "../api/settings";
import Confirm from "../components/ui/Confirm";
import BookingDeleteModal from "../features/bookings/components/BookingDeleteModal";
import { toast } from "../store/toast";
import { getUserFacingErrorMessage } from "../api/errors";
import { useIsMobile } from "../hooks/useIsMobile";
import { useDragScroll } from "../hooks/useDragScroll";
import { useAuthStore } from "../store/auth";
import { getJewishDayMeta } from "../utils/jewishCalendar";
import { PhotoMenu, CameraCaptureModal, ImageGallery } from "../components/photos/PhotoManagement";
import { createDashboardPermissionModel } from "./dashboardPermissions";

const DAY_NAMES   = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
const MODEL_COLOR_PALETTE = [
  { bg:"#dbeafe", border:"#3b82f6", text:"#1d4ed8" },
  { bg:"#dcfce7", border:"#22c55e", text:"#15803d" },
  { bg:"#ffedd5", border:"#f97316", text:"#c2410c" },
  { bg:"#ede9fe", border:"#8b5cf6", text:"#6d28d9" },
  { bg:"#fce7f3", border:"#ec4899", text:"#be185d" },
  { bg:"#cffafe", border:"#06b6d4", text:"#0e7490" },
  { bg:"#fef3c7", border:"#f59e0b", text:"#b45309" },
  { bg:"#e0f2fe", border:"#0284c7", text:"#0369a1" },
  { bg:"#ecfccb", border:"#84cc16", text:"#4d7c0f" },
  { bg:"#f3e8ff", border:"#a855f7", text:"#7e22ce" },
];

function addDays(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }
function pad2(n) { return String(n).padStart(2, "0"); }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function diffDays(startISO, endISO) {
  const ms = fromISO(endISO) - fromISO(startISO);
  return Math.round(ms / 86400000);
}
function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash) + value.charCodeAt(i);
  return Math.abs(hash);
}
function getModelTheme(model) {
  return MODEL_COLOR_PALETTE[hashString(model || "") % MODEL_COLOR_PALETTE.length];
}
// The `name` field is stored as "<make> <model>" (e.g. "טויוטה קורולה"); flip it to
// "<model> <make>" (e.g. "קורולה טויוטה") for clearer identification.
function modelBeforeMake(name, make) {
  const full = (name || "").trim();
  const mk = (make || "").trim();
  if (!mk) return full;
  if (full.toLowerCase().startsWith(mk.toLowerCase())) {
    const model = full.slice(mk.length).trim();
    return model ? `${model} ${mk}` : mk;
  }
  return full.toLowerCase().includes(mk.toLowerCase()) ? full : `${full} ${mk}`;
}
// Show the family name first so narrow cells surface the surname before the given name.
function surnameFirst(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "לקוח";
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, parts.length - 1);
  return [last, ...rest].join(" ");
}
function fmtDay(d) {
  const mn = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${mn[d.getMonth()]}`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile(900);
  const currentUser = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);
  const [kpis, setKpis]   = useState(null);
  const [cars, setCars]         = useState([]);
  const todayBase = new Date();
  todayBase.setHours(0,0,0,0);

  // Quick Search state (with localStorage)
  const [quickSearch, setQuickSearch] = useState(() => {
    try {
      return localStorage.getItem("dashboard_quick_search") || "";
    } catch {
      return "";
    }
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [hybridFilter, setHybridFilter] = useState("all"); // "all" | "hybrid" | "regular"
  const [rangeStart, setRangeStart] = useState(toISO(addDays(todayBase, -2)));
  // Default: 14 days visible (keep a small look-back like the previous behavior)
  const [rangeEnd, setRangeEnd]     = useState(toISO(addDays(todayBase, 11)));
  const [categories, setCategories] = useState([]);
  const [focusMode, setFocusMode]   = useState(false);

  // Bottom Sheet state (mobile only)
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [sheetStartY, setSheetStartY] = useState(0);
  const [sheetCurrentY, setSheetCurrentY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  // Ref for search input (keyboard shortcut)
  const searchInputRef = useRef(null);

  const modelOptions = useMemo(
    () => [...new Set(cars.filter(c => c.is_active).map(c => c.name))].sort((a, b) => a.localeCompare(b, "he")),
    [cars]
  );

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(quickSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [quickSearch]);

  // Save search to localStorage
  useEffect(() => {
    try {
      if (quickSearch) {
        localStorage.setItem("dashboard_quick_search", quickSearch);
      } else {
        localStorage.removeItem("dashboard_quick_search");
      }
    } catch (err) {
      console.warn("Failed to save search to localStorage", err);
    }
  }, [quickSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F or / = Focus search input
      if ((e.ctrlKey && e.key === 'f') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Escape = Clear search or close sheet
      if (e.key === 'Escape') {
        if (showFilterSheet) {
          setShowFilterSheet(false);
        } else if (document.activeElement === searchInputRef.current) {
          setQuickSearch("");
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilterSheet]);

  // Quick search filter function
  const quickSearchFilter = useMemo(() => {
    return (car) => {
      if (!debouncedSearch || debouncedSearch.trim() === "") return true;

      const term = debouncedSearch.toLowerCase().trim();
      const normalize = (str) => str?.toString().toLowerCase().replace(/[-\s#רכב]/g, '') || "";

      // Search by ID
      if (normalize(car.id) === normalize(term)) return true;

      // Search by plate
      if (normalize(car.plate).includes(normalize(term))) return true;

      // Search by name (model)
      if (normalize(car.name).includes(normalize(term))) return true;

      // Search by make (manufacturer)
      if (normalize(car.make).includes(normalize(term))) return true;

      // Search by group
      if (normalize(car.group) === normalize(term)) return true;

      // Search by category
      if (normalize(car.category).includes(normalize(term))) return true;

      return false;
    };
  }, [debouncedSearch]);

  const filteredCars = useMemo(
    () => cars.filter(c => {
      if (!c.is_active) return false;
      
      // Quick search filter (new!)
      if (!quickSearchFilter(c)) return false;

      // Multi-category filter
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(c.category || "");
      if (!matchesCategory) return false;

      // Multi-model filter
      const matchesModel = selectedModels.length === 0 || selectedModels.includes(c.name);
      if (!matchesModel) return false;

      // Hybrid filter
      if (hybridFilter === "hybrid" && !c.is_hybrid) return false;
      if (hybridFilter === "regular" && !!c.is_hybrid) return false;

      return true;
    }),
    [cars, quickSearchFilter, selectedModels, selectedCategories, hybridFilter]
  );
  const permissionModel = useMemo(
    () => createDashboardPermissionModel({ can, currentUser, isMobile }),
    [can, currentUser, isMobile]
  );
  const visibleDays = Math.max(diffDays(rangeStart, rangeEnd) + 1, 1);

  function toggleModel(model) {
    setSelectedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  }

  useEffect(() => {
    carsAPI.list().then(setCars).catch(() => setCars([]));
    settingsAPI.get("category_hierarchy").then(res => setCategories(res.value || [])).catch(() => {});
  }, []);

  useEffect(() => {
    // Dashboard shows only minimal KPIs for everyone (analytics are in Reports module, admin-only).
    bookingsAPI.kpi()
      .then(setKpis)
      .catch(() => setKpis({ total: 0, active: 0 }));
  }, []);

  function setStartAndKeepRange(nextStart) {
    setRangeStart(nextStart);
    if (nextStart > rangeEnd) setRangeEnd(nextStart);
  }

  function setEndWithGuard(nextEnd) {
    setRangeEnd(nextEnd < rangeStart ? rangeStart : nextEnd);
  }

  function applyPreset(days) {
    setRangeEnd(toISO(addDays(fromISO(rangeStart), days - 1)));
  }

  function shiftRange(days) {
    setRangeStart(prev => toISO(addDays(fromISO(prev), days)));
    setRangeEnd(prev => toISO(addDays(fromISO(prev), days)));
  }

  function clearAllFilters() {
    setQuickSearch("");
    setSelectedModels([]);
    setSelectedCategories([]);
    setHybridFilter("all");
  }

  const activeFiltersCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedModels.length > 0 ? 1 : 0) +
    (hybridFilter !== "all" ? 1 : 0);

  function handleSheetTouchStart(e) {
    setSheetStartY(e.touches[0].clientY);
    setSheetCurrentY(0);
    setIsDraggingSheet(true);
  }

  function handleSheetTouchMove(e) {
    const delta = e.touches[0].clientY - sheetStartY;
    if (delta > 0) setSheetCurrentY(delta);
  }

  function handleSheetTouchEnd() {
    setIsDraggingSheet(false);
    if (sheetCurrentY > 120) {
      setShowFilterSheet(false);
    }
    setSheetCurrentY(0);
  }


  return (
    <div dir="rtl">
      <h1 style={{ fontSize:isMobile ? 20 : 24, fontWeight:800, marginBottom:isMobile ? 14 : 20 }}>לוח בקרה</h1>

      {/* ── Universal: Quick Search + Filter Button (Mobile & Desktop) ── */}
      <div style={{ marginBottom: 16 }}>
        {/* Quick Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            ref={searchInputRef}
            type="search"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="🔍 חיפוש מהיר: דגם, יצרן, לוחית, מספר רכב..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            style={{
              ...inputStyle,
              paddingInlineEnd: quickSearch ? 45 : 12,
              width: "100%",
              maxWidth: isMobile ? "100%" : 600,
              fontSize: 14,
            }}
          />
          {quickSearch && (
            <button
              onClick={() => setQuickSearch("")}
              aria-label="נקה חיפוש"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#94a3b8",
                fontSize: 18,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Button + Clear */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowFilterSheet(true)}
            style={{
              ...chipStyle,
              flex: isMobile ? 1 : "0 0 auto",
              background: activeFiltersCount > 0 ? "#2563eb" : "#fff",
              color: activeFiltersCount > 0 ? "#fff" : "#334155",
              borderColor: activeFiltersCount > 0 ? "#2563eb" : "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 700,
              minWidth: isMobile ? "auto" : 180,
            }}
          >
            🎚️ סינונים מתקדמים
            {activeFiltersCount > 0 && (
              <span style={{
                background: "#fff",
                color: "#2563eb",
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 800,
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
          {(quickSearch || activeFiltersCount > 0) && (
            <button
              onClick={clearAllFilters}
              style={{
                ...chipStyle,
                background: "#fee2e2",
                color: "#dc2626",
                borderColor: "#fecaca",
                fontWeight: 600,
              }}
            >
              ✕ נקה הכל
            </button>
          )}
        </div>

        {/* Results Indicator */}
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
          {quickSearch && filteredCars.length === 0 && (
            <span style={{ color: "#dc2626" }}>
              ⚠️ לא נמצאו רכבים תואמים ל-"{quickSearch}"
            </span>
          )}
          {!quickSearch && activeFiltersCount > 0 && filteredCars.length === 0 && (
            <span style={{ color: "#dc2626" }}>
              ⚠️ לא נמצאו רכבים תואמים לסינונים הנבחרים
            </span>
          )}
          {(quickSearch || activeFiltersCount > 0) && filteredCars.length > 0 && (
            <span>
              מוצג: <strong>{filteredCars.length}</strong> רכבים
              {quickSearch && <> · {quickSearch}</>}
              {activeFiltersCount > 0 && <> · {activeFiltersCount} סינונים פעילים</>}
              {" · "}
              טווח: <strong>{visibleDays}</strong> ימים
            </span>
          )}
          {!quickSearch && activeFiltersCount === 0 && (
            <span>
              מוצג: <strong>{filteredCars.length}</strong> רכבים · טווח: <strong>{visibleDays}</strong> ימים
              <span style={{ color: "#94a3b8", marginRight: 12 }}>· טיפ: Ctrl+F לחיפוש מהיר</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Availability Grid (FIRST prominent element) ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10, marginTop:10 }}>
        <h2 style={{ ...cardTitle, marginBottom:0 }}>זמינות רכבים ({filteredCars.length})</h2>
        <button 
          onClick={() => setFocusMode(true)}
          style={{ ...chipStyle, display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:"#f1f5f9" }}
        >
          ⛶ מסך מלא
        </button>
      </div>

      <AvailabilityGrid 
        cars={filteredCars} 
        startDate={rangeStart} 
        endDate={rangeEnd} 
        navigate={navigate} 
        isMobile={isMobile}
        isFiltered={selectedModels.length > 0 || selectedCategories.length > 0}
        currentUser={currentUser}
        permissionModel={permissionModel}
      />

      {/* Focus Mode Overlay */}
      {focusMode && (
        <div style={{ position:"fixed", inset:0, background:"#f8fafc", zIndex:9999, padding:isMobile ? 10 : 25, overflowY:"auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:15 }}>
             <div>
               <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:"#1e293b" }}>לוח זמנים - מצב פוקוס</h2>
               <div style={{ fontSize:12, color:"#64748b" }}>{rangeStart} עד {rangeEnd} · {filteredCars.length} רכבים</div>
             </div>
             <button 
               onClick={() => setFocusMode(false)} 
               style={{ padding:"8px 16px", borderRadius:8, background:"#ef4444", color:"#fff", border:"none", cursor:"pointer" }}
             >
               ✖ סגור מסך מלא
             </button>
          </div>
          <div style={{ background:"#fff", borderRadius:12, boxShadow:"0 4px 20px rgba(0,0,0,0.1)", padding:10 }}>
            <AvailabilityGrid 
              cars={filteredCars} 
              startDate={rangeStart} 
              endDate={rangeEnd} 
              navigate={navigate} 
              isMobile={isMobile}
              isFiltered={selectedModels.length > 0 || selectedCategories.length > 0}
              currentUser={currentUser}
              permissionModel={permissionModel}
              fullHeight={true}
            />
          </div>
        </div>
      )}

      {/* ── Stats cards (below the grid) ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(180px,1fr))", gap:12, margin:"20px 0" }}>
        {[
          { label:"סה״כ הזמנות",   value: kpis?.total  ?? "—", color:"#3b82f6", icon:"📋" },
          { label:"הזמנות פעילות", value: kpis?.active ?? "—", color:"#22c55e", icon:"✅" },
        ].map(s => (
          <div key={s.label} style={{ background:"#fff", borderRadius:12, padding:isMobile ? "14px 16px" : "20px 24px",
               border:`1px solid ${s.color}30`, display:"flex", gap:12, alignItems:"center",
               boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: isMobile ? 24 : 32 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:"#94a3b8" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Modal/Sheet (Universal: Mobile Bottom Sheet, Desktop Center Modal) ── */}
      {showFilterSheet && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowFilterSheet(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 9998,
              animation: "fadeIn 0.3s ease-out",
            }}
          />

          {/* Modal/Sheet Container */}
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={isMobile ? handleSheetTouchStart : undefined}
            onTouchMove={isMobile ? handleSheetTouchMove : undefined}
            onTouchEnd={isMobile ? handleSheetTouchEnd : undefined}
            style={{
              position: "fixed",
              ...(isMobile ? {
                // Mobile: Bottom Sheet
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: "80vh",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                animation: "slideUp 0.3s ease-out",
                transform: isDraggingSheet ? `translateY(${sheetCurrentY}px)` : "translateY(0)",
                transition: isDraggingSheet ? "none" : "transform 0.3s ease-out",
              } : {
                // Desktop: Center Modal
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "90%",
                maxWidth: 700,
                maxHeight: "85vh",
                borderRadius: 16,
                animation: "zoomIn 0.25s ease-out",
              }),
              background: "#fff",
              boxShadow: "0 -4px 30px rgba(0,0,0,0.2)",
              zIndex: 9999,
              overflowY: "auto",
            }}
          >
            {/* Draggable Handle (Mobile Only) */}
            {isMobile && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                padding: "12px 0 8px",
                cursor: "grab",
              }}>
                <div style={{
                  width: 40,
                  height: 4,
                  background: "#cbd5e1",
                  borderRadius: 999,
                }} />
              </div>
            )}

            {/* Header */}
            <div style={{
              position: "sticky",
              top: 0,
              background: "#fff",
              borderBottom: "1px solid #e2e8f0",
              padding: isMobile ? "8px 20px 16px" : "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 1,
              ...(isMobile ? {} : { borderTopLeftRadius: 16, borderTopRightRadius: 16 }),
            }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>
                🎚️ סינון ותצוגה
              </h3>
              <button
                onClick={() => setShowFilterSheet(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "20px", paddingBottom: "100px" }}>

              {/* Categories */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ ...fieldLabel, display: "block", marginBottom: 8 }}>סינון קטגוריות</span>
                <div style={multiSelectBox}>
                  <label style={multiSelectItem(selectedCategories.length === 0)}>
                    <input type="checkbox" checked={selectedCategories.length === 0} onChange={() => setSelectedCategories([])} />
                    כל הקטגוריות
                  </label>
                  <div style={separator} />
                  {categories.map(cat => (
                    <label key={cat.name} style={multiSelectItem(selectedCategories.includes(cat.name))}>
                      <input type="checkbox" checked={selectedCategories.includes(cat.name)}
                        onChange={() => setSelectedCategories(prev => prev.includes(cat.name) ? prev.filter(c => c !== cat.name) : [...prev, cat.name])} />
                      {cat.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Models */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ ...fieldLabel, display: "block", marginBottom: 8 }}>סינון דגמים</span>
                <div style={multiSelectBox}>
                  <label style={multiSelectItem(selectedModels.length === 0)}>
                    <input type="checkbox" checked={selectedModels.length === 0} onChange={() => setSelectedModels([])} />
                    כל הדגמים
                  </label>
                  <div style={separator} />
                  {modelOptions.map(model => (
                    <label key={model} style={multiSelectItem(selectedModels.includes(model))}>
                      <input type="checkbox" checked={selectedModels.includes(model)} onChange={() => toggleModel(model)} />
                      {model}
                    </label>
                  ))}
                </div>
              </div>

              {/* Hybrid */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ ...fieldLabel, display: "block", marginBottom: 8 }}>סוג הנעה</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { value: "all", label: "🚗 הכל" },
                    { value: "hybrid", label: "🌿 היברידי" },
                    { value: "regular", label: "⛽ רגיל" },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      style={{
                        ...chipStyle,
                        background: hybridFilter === opt.value ? "#2563eb" : "#fff",
                        color: hybridFilter === opt.value ? "#fff" : "#334155",
                        borderColor: hybridFilter === opt.value ? "#2563eb" : "#cbd5e1",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <input
                        type="radio"
                        name="hybridFilterSheet"
                        value={opt.value}
                        checked={hybridFilter === opt.value}
                        onChange={() => setHybridFilter(opt.value)}
                        style={{ display: "none" }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ ...fieldLabel, display: "block", marginBottom: 8 }}>טווח תאריכים</span>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <label style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>מתאריך</span>
                    <input type="date" value={rangeStart} onChange={(e) => setStartAndKeepRange(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
                  </label>
                  <label style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>עד תאריך</span>
                    <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => setEndWithGuard(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
                  </label>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ ...fieldLabel, width: "100%", marginBottom: 4 }}>טווח מהיר:</span>
                  {[7, 14, 30].map(days => (
                    <button key={days} onClick={() => applyPreset(days)} style={days === visibleDays ? activeChip : chipStyle}>
                      {days} ימים
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div style={{
                background: "#f8fafc",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 12,
                color: "#64748b",
                marginBottom: 16,
              }}>
                <strong>מוצג:</strong> {filteredCars.length} רכבים · {visibleDays} ימים
                {activeFiltersCount > 0 && <> · {activeFiltersCount} סינונים פעילים</>}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "#fff",
              borderTop: "1px solid #e2e8f0",
              padding: "16px 20px",
              display: "flex",
              gap: 10,
              boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
            }}>
              <button
                onClick={clearAllFilters}
                style={{
                  ...chipStyle,
                  flex: 1,
                  background: "#fff",
                  color: "#64748b",
                  border: "1px solid #cbd5e1",
                }}
              >
                אפס הכל
              </button>
              <button
                onClick={() => setShowFilterSheet(false)}
                style={{
                  ...chipStyle,
                  flex: 2,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                }}
              >
                ✓ החל והצג ({filteredCars.length})
              </button>
            </div>
          </div>

          {/* Animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            @keyframes slideDown {
              from { transform: translateY(0); }
              to { transform: translateY(100%); }
            }
            @keyframes zoomIn {
              from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
              to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
          `}</style>
        </>
      )}

    </div>
  );
}

// ── Reassign Confirm Modal ─────────────────────────────────────────────────────
function ReassignModal({ booking, fromCar, toCar, loading, onConfirm, onCancel, operatorNote, onOperatorNoteChange, requiresOperatorNote }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000,
                  display:"flex", alignItems:"center", justifyContent:"center" }}
         onClick={onCancel}>
      <div dir="rtl" style={{ background:"#fff", borderRadius:16, padding:28, maxWidth:400,
                               width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}
           onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:22, marginBottom:8 }}>🔄 העברת הזמנה</div>
        <p style={{ fontSize:14, color:"#374151", marginBottom:4 }}>
          <strong>{booking.customer_name}</strong>
        </p>
        <p style={{ fontSize:13, color:"#64748b", marginBottom:4 }}>
          📅 {booking.start_date} – {booking.end_date}
        </p>
        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0",
                      padding:"12px 16px", background:"#f1f5f9", borderRadius:10, fontSize:13 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
            <span style={{ color:"#dc2626", fontWeight:700 }}>🚗 {fromCar.name}</span>
            {fromCar.plate && <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>🔢 {fromCar.plate}</span>}
          </div>
          <span style={{ color:"#64748b", fontSize:18, flex:1, textAlign:"center" }}>←</span>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }}>
            <span style={{ color:"#16a34a", fontWeight:700 }}>🚗 {toCar.name}</span>
            {toCar.plate && <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>🔢 {toCar.plate}</span>}
          </div>
        </div>
        <p style={{ fontSize:12, color:"#94a3b8", marginBottom:20 }}>
          לאחר האישור ההזמנה תועבר לרכב החדש ולא ניתן לבטל פעולה זו.
        </p>
        {requiresOperatorNote && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
              נדרשת הערת מפעיל להעברה של הזמנה שנוצרה ע"י סוכן אחר
            </div>
            <textarea
              value={operatorNote}
              onChange={(e) => onOperatorNoteChange?.(e.target.value)}
              rows={3}
              placeholder="מה הסיבה להעברה? מי ביקש?"
              style={{ width: "100%", borderRadius: 8, border: "1px solid #f59e0b", padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} disabled={loading}
                  style={{ padding:"9px 20px", borderRadius:8, border:"1px solid #cbd5e1",
                           background:"#fff", color:"#374151", fontSize:13, cursor:"pointer" }}>
            ביטול
          </button>
          <button onClick={onConfirm} disabled={loading || (requiresOperatorNote && !operatorNote.trim())}
                  style={{ padding:"9px 20px", borderRadius:8, border:"none",
                           background: (loading || (requiresOperatorNote && !operatorNote.trim())) ? "#93c5fd" : "#2563eb", color:"#fff",
                           fontSize:13, fontWeight:700, cursor: (loading || (requiresOperatorNote && !operatorNote.trim())) ? "not-allowed" : "pointer" }}>
            {loading ? "מעדכן..." : "✔ אשר העברה"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingActionModal({ booking, carName, onEdit, onDelete, onCustomer, onClose, photoMenu, canReassign, onReassign }) {
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}
    >
      <div
        dir="rtl"
        style={{ background:"#fff", borderRadius:16, padding:24, maxWidth:420, width:"92%", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin:"0 0 8px", fontSize:18, color:"#1e293b" }}>פעולות על הזמנה קיימת</h3>
        <div style={{ fontSize:13, color:"#475569", marginBottom:4 }}><strong>לקוח:</strong> {booking.customer_name}</div>
        <div style={{ fontSize:13, color:"#475569", marginBottom:4 }}><strong>רכב:</strong> {carName}</div>
        <div style={{ fontSize:13, color:"#475569", marginBottom:16 }}><strong>תאריכים:</strong> {booking.start_date} - {booking.end_date}</div>
        {!canReassign && (
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
            במובייל העברת הזמנה מתבצעת דרך בחירת יעד, לא בגרירה.
          </div>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
             <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff", color:"#374151", cursor:"pointer" }}>סגור</button>
             {photoMenu}
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {canReassign && onReassign && (
              <button onClick={onReassign} style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#0f766e", color:"#fff", fontWeight:700, cursor:"pointer" }}>העבר</button>
            )}
            {onDelete && (
              <button onClick={onDelete} style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#fee2e2", color:"#dc2626", fontWeight:700, cursor:"pointer" }}>🗑 מחק</button>
            )}
            {booking.customer_id && onCustomer && (
              <button onClick={onCustomer} style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#0f766e", color:"#fff", fontWeight:700, cursor:"pointer" }}>👤 לקוח</button>
            )}
            {onEdit && (
              <button onClick={onEdit} style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer" }}>עריכה</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



// ── Availability Grid ──────────────────────────────────────────────────────────
function AvailabilityGrid({ cars, startDate, endDate, navigate, isMobile, isFiltered, fullHeight, currentUser, permissionModel }) {
  const [bookings, setBookings]     = useState([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // Floating horizontal scroll
  const gridScrollRef = useRef(null);
  const hScrollRef = useRef(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncingScroll = useRef(false);
  const hScrollDrag = useDragScroll({ axis: "x" });
  // Keep click behavior deterministic on desktop: drag-scroll here can swallow booking clicks.
  const gridScrollDrag = useDragScroll({ axis: "x", enabled: false });

  // Header hover tooltip
  const [hoveredCar, setHoveredCar] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [dragBooking, setDragBooking]   = useState(null);   // booking being dragged
  const [dragOverCarId, setDragOverCarId] = useState(null); // column being hovered
  const [confirmDrop, setConfirmDrop]   = useState(null);   // { booking, fromCar, toCar }
  const [dropLoading, setDropLoading]   = useState(false);
  const [moveModeBooking, setMoveModeBooking] = useState(null);
  const [bookingAction, setBookingAction] = useState(null); // { booking, carName }
  const [confirmDeleteBooking, setConfirmDeleteBooking] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteOperatorNote, setDeleteOperatorNote] = useState("");
  const [viewPhotos, setViewPhotos] = useState(null);
  const [activePhotoMenu, setActivePhotoMenu] = useState(null);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [cameraCapture, setCameraCapture] = useState(null); // bookingId
  const [reassignOperatorNote, setReassignOperatorNote] = useState("");

  const todayBase = new Date(); todayBase.setHours(0,0,0,0);
  const todayStr  = toISO(todayBase);
  const startBase = fromISO(startDate);
  const daysCount = Math.max(diffDays(startDate, endDate) + 1, 1);

  // Column widths: slightly wider for readability, and widen further when filtering columns.
  // Sized so a full license plate fits on its own line in the header.
  const CAR_COL_WIDTH_BASE = isMobile ? 76 : 62;
  const CAR_COL_WIDTH_MAX = isMobile ? 86 : 72;
  const CAR_COL_WIDTH = isFiltered ? CAR_COL_WIDTH_MAX : CAR_COL_WIDTH_BASE;
  const DATE_COL_WIDTH = 74; // keep readable

  useEffect(() => {
    const update = () => {
      const el = gridScrollRef.current;
      if (!el) return;
      setScrollWidth(el.scrollWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [cars.length, startDate, endDate, CAR_COL_WIDTH, fullHeight]);

  function syncScroll(from, to) {
    if (syncingScroll.current) return;
    if (!from || !to) return;
    syncingScroll.current = true;
    to.scrollLeft = from.scrollLeft;
    // allow the browser to settle
    window.requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }

  function clampTooltipPos(x, y) {
    const width = 220;
    const height = 100;
    const pad = 12;
    const maxX = Math.max(pad, window.innerWidth - width - pad);
    const maxY = Math.max(pad, window.innerHeight - height - pad);
    return {
      x: Math.min(Math.max(pad, x), maxX),
      y: Math.min(Math.max(pad, y), maxY),
    };
  }

  useEffect(() => {
    setLoadingGrid(true);
    bookingsAPI.calendar(startDate, endDate)
      .then(setBookings)
      .finally(() => setLoadingGrid(false));
  }, [startDate, endDate]);

  const activeCars = cars.filter(c => c.is_active);
  const dates      = Array.from({ length: daysCount }, (_, i) => addDays(startBase, i));

  // Build occupancy map: "YYYY-MM-DD:carId" → booking
  const occ = {};
  bookings.forEach(b => {
    if (b.status === "cancelled") return;
    dates.forEach(d => {
      const ds = toISO(d);
      if (ds >= b.start_date && ds <= b.end_date) {
        if (!occ[`${ds}:${b.car_id}`]) occ[`${ds}:${b.car_id}`] = [];
        occ[`${ds}:${b.car_id}`].push(b);
      }
    });
  });

  // ── Drag helpers ────────────────────────────────────────────────────────────
  function canOpenBookingActions(booking) {
    return permissionModel.hasAnyBookingActions(booking);
  }

  function startMoveMode(booking) {
    if (!permissionModel.canReassignBooking(booking)) {
      toast.error("אין לך הרשאה להעביר את ההזמנה הזו מתוך הדשבורד");
      return;
    }
    setBookingAction(null);
    setActivePhotoMenu(null);
    setMoveModeBooking(booking);
    setDragBooking(null);
    setDragOverCarId(null);
    setReassignOperatorNote("");
    toast.success(isMobile ? "בחר רכב יעד מהגריד כדי להעביר את ההזמנה" : "מצב העברה פעיל — בחר רכב יעד או גרור לעמודת רכב אחרת");
  }

  function cancelMoveMode() {
    setMoveModeBooking(null);
    setDragBooking(null);
    setDragOverCarId(null);
    setReassignOperatorNote("");
  }

  function openCreateBooking(car, ds, isPastDay) {
    if (moveModeBooking) {
      prepareReassign(moveModeBooking, car);
      return;
    }
    if (isPastDay) {
      toast.error("לא ניתן ליצור הזמנה לתאריך שכבר עבר");
      return;
    }
    if (!permissionModel.canCreateBookings) {
      toast.error("אין לך הרשאה ליצור הזמנה חדשה מתוך הדשבורד");
      return;
    }
    navigate("/bookings", {
      state: { bookingPrefill: { car_id: car.id, start_date: ds } },
    });
  }

  function openBookingActions(booking, carName) {
    if (moveModeBooking) {
      const targetCar = activeCars.find((car) => car.name === carName || `רכב #${car.id}` === carName || car.id === booking.car_id);
      if (targetCar) prepareReassign(moveModeBooking, targetCar);
      return;
    }
    if (!canOpenBookingActions(booking)) {
      toast.error("אין לך פעולות זמינות על ההזמנה הזו מתוך הדשבורד");
      return;
    }
    setBookingAction({ booking, carName });
  }

  function prepareReassign(sourceBooking, targetCar) {
    if (!sourceBooking || !targetCar) return;
    if (!permissionModel.canReassignBooking(sourceBooking)) {
      toast.error("אין לך הרשאה להעביר את ההזמנה הזו");
      return;
    }
    if (targetCar.id === sourceBooking.car_id) {
      toast.error("יש לבחור רכב יעד שונה מהרכב הקיים");
      return;
    }

    const bookingStart = fromISO(sourceBooking.start_date);
    const bookingEnd = fromISO(sourceBooking.end_date);
    const bookingDates = [];
    let cursor = new Date(bookingStart);
    while (cursor <= bookingEnd) {
      bookingDates.push(toISO(cursor));
      cursor = addDays(cursor, 1);
    }

    const conflicts = bookingDates.filter((d) => {
      const cells = occ[`${d}:${targetCar.id}`];
      if (!cells || cells.length === 0) return false;
      return cells.some((cell) => {
        if (cell.id === sourceBooking.id) return false;
        if (cell.end_date === sourceBooking.start_date && d === cell.end_date) {
          const cellRet = cell.return_time || "08:00";
          const dragPick = sourceBooking.pickup_time || "08:30";
          if (cellRet <= dragPick) return false;
        }
        if (cell.start_date === sourceBooking.end_date && d === cell.start_date) {
          const cellPick = cell.pickup_time || "08:30";
          const dragRet = sourceBooking.return_time || "08:00";
          if (cellPick >= dragRet) return false;
        }
        return true;
      });
    });

    if (conflicts.length > 0) {
      alert(
        `לא ניתן להעביר ל-${targetCar.name}:\n` +
        `ישנה הזמנה קיימת בתאריכים ${conflicts[0]} – ${conflicts[conflicts.length - 1]}`
      );
      return;
    }

    const fromCar = activeCars.find((c) => c.id === sourceBooking.car_id) || { name: `רכב #${sourceBooking.car_id}` };
    setReassignOperatorNote("");
    setConfirmDrop({ booking: sourceBooking, fromCar, toCar: targetCar });
  }

  function handleDragStart(e, b) {
    if (!permissionModel.canDragReassignBooking(b)) {
      e.preventDefault();
      return;
    }
    setMoveModeBooking(null);
    setDragBooking(b);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", b.id.toString());
  }

  function handleDragEnd() {
    setDragBooking(null);
    setDragOverCarId(null);
  }

  function handleDragOverCell(e, carId) {
    if (!dragBooking || !permissionModel.canDragReassignBooking(dragBooking)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCarId(carId);
  }

  function handleDrop(e, targetCar) {
    e.preventDefault();
    setDragOverCarId(null);
    if (!dragBooking || !permissionModel.canDragReassignBooking(dragBooking)) {
      setDragBooking(null);
      return;
    }
    prepareReassign(dragBooking, targetCar);
  }

  async function executeReassign() {
    if (!confirmDrop) return;
    const needsOperatorNote = permissionModel.requiresOperatorNote(confirmDrop.booking);
    if (needsOperatorNote && !reassignOperatorNote.trim()) {
      toast.error("נדרשת הערת מפעיל להעברת הזמנה של סוכן אחר");
      return;
    }
    setDropLoading(true);
    try {
      await bookingsAPI.update(confirmDrop.booking.id, {
        car_id: confirmDrop.toCar.id,
        ...(needsOperatorNote ? { operator_note: reassignOperatorNote.trim() } : {}),
      });
      const data = await bookingsAPI.calendar(startDate, endDate);
      setBookings(data);
      toast.success("ההזמנה הועברה בהצלחה");
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err));
    } finally {
      setDropLoading(false);
      setConfirmDrop(null);
      setDragBooking(null);
      setMoveModeBooking(null);
      setReassignOperatorNote("");
    }
  }

  async function executeDelete() {
    if (!confirmDeleteBooking) return;
    const needsOperatorNote = permissionModel.requiresOperatorNote(confirmDeleteBooking);
    if (needsOperatorNote && !deleteOperatorNote.trim()) {
      toast.error("נדרשת הערת מפעיל למחיקת הזמנה של סוכן אחר");
      return;
    }

    setDeleteLoading(true);
    try {
      await bookingsAPI.delete(
        confirmDeleteBooking.id,
        needsOperatorNote ? { operator_note: deleteOperatorNote.trim() } : undefined,
      );
      const data = await bookingsAPI.calendar(startDate, endDate);
      setBookings(data);
      toast.success("ההזמנה נמחקה בהצלחה");
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err));
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteBooking(null);
      setDeleteOperatorNote("");
    }
  }

  async function compressImage(file, maxDimension = 2048, quality = 0.9) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            else resolve(file);
          }, "image/jpeg", quality);
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(bookingId, files) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const newUploads = fileList.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      bookingId,
      fileName: file.name,
      status: "compressing"
    }));
    setUploadQueue(prev => [...prev, ...newUploads]);
    fileList.forEach(async (file, index) => {
      const uploadId = newUploads[index].id;
      try {
        const compressed = await compressImage(file);
        setUploadQueue(prev => prev.map(u => u.id === uploadId ? { ...u, status: "uploading" } : u));
        await bookingsAPI.uploadPhoto(bookingId, compressed);
        setUploadQueue(prev => prev.map(u => u.id === uploadId ? { ...u, status: "done" } : u));
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(u => u.id !== uploadId));
          // Refresh grid to show new photo count
          bookingsAPI.calendar(startDate, endDate).then(setBookings);
        }, 3000);
      } catch (e) {
        setUploadQueue(prev => prev.map(u => u.id === uploadId ? { ...u, status: "error", error: getUserFacingErrorMessage(e) } : u));
      }
    });
  }

  if (activeCars.length === 0) {
    return (
      <div style={{ ...cardStyle, padding:20, marginBottom:20, color:"#64748b" }}>
        אין רכבים להצגה עבור הסינון שנבחר.
      </div>
    );
  }

  return (
    <>
      {/* Hide the grid's native horizontal scrollbar (we keep the floating scrollbar below). */}
      <style>{`
        .availability-grid-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .availability-grid-scroll::-webkit-scrollbar { display: none; height: 0; }
      `}</style>
      {bookingAction && (
        <BookingActionModal
          booking={bookingAction.booking}
          carName={bookingAction.carName}
          onClose={() => { setBookingAction(null); setActivePhotoMenu(null); }}
          onDelete={permissionModel.canDeleteBooking(bookingAction.booking) ? (() => {
            setConfirmDeleteBooking(bookingAction.booking);
            setBookingAction(null);
          }) : null}
          onEdit={permissionModel.canEditBooking(bookingAction.booking) ? (() => {
            navigate("/bookings", { state: { bookingEditId: bookingAction.booking.id } });
            setBookingAction(null);
          }) : null}
          onCustomer={permissionModel.canViewBookingCustomer(bookingAction.booking) ? (() => {
            navigate("/customers", { state: { highlightCustomerId: bookingAction.booking.customer_id } });
            setBookingAction(null);
          }) : null}
          photoMenu={permissionModel.canManageBookingMedia(bookingAction.booking) ? (
            <PhotoMenu
               booking={bookingAction.booking}
               onView={() => setViewPhotos(bookingAction.booking)}
               onUpload={(files) => handlePhotoUpload(bookingAction.booking.id, files)}
               onContinuousCamera={() => setCameraCapture(bookingAction.booking.id)}
               isOpen={activePhotoMenu === bookingAction.booking.id}
               onToggle={() => setActivePhotoMenu(activePhotoMenu === bookingAction.booking.id ? null : bookingAction.booking.id)}
            />
          ) : null}
          canReassign={permissionModel.canReassignBooking(bookingAction.booking)}
          onReassign={permissionModel.canReassignBooking(bookingAction.booking) ? (() => startMoveMode(bookingAction.booking)) : null}
        />
      )}
      {confirmDrop && (
        <ReassignModal
          booking={confirmDrop.booking}
          fromCar={confirmDrop.fromCar}
          toCar={confirmDrop.toCar}
          loading={dropLoading}
          onConfirm={executeReassign}
          onCancel={() => { setConfirmDrop(null); setDragBooking(null); setReassignOperatorNote(""); }}
          operatorNote={reassignOperatorNote}
          onOperatorNoteChange={setReassignOperatorNote}
          requiresOperatorNote={permissionModel.requiresOperatorNote(confirmDrop.booking)}
        />
      )}
      <BookingDeleteModal
        booking={confirmDeleteBooking}
        loading={deleteLoading}
        onConfirm={executeDelete}
        onCancel={() => {
          setConfirmDeleteBooking(null);
          setDeleteOperatorNote("");
        }}
        operatorNote={deleteOperatorNote}
        onOperatorNoteChange={setDeleteOperatorNote}
        requiresOperatorNote={permissionModel.requiresOperatorNote(confirmDeleteBooking)}
      />

    <div style={{ ...cardStyle, padding:0, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"14px 18px", borderBottom:"1px solid #e2e8f0", gap:12, flexWrap:"wrap" }}>
        <h3 style={{ ...cardTitle, margin:0 }}>📅 זמינות רכבים</h3>
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:"#64748b" }}>
          {loadingGrid && <span style={{ color:"#94a3b8" }}>מרענן...</span>}
          <span>מציג מ־<strong>{startDate}</strong> עד <strong>{endDate}</strong></span>
        </div>
      </div>

      {moveModeBooking && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"8px 18px", background:"#ecfeff", borderBottom:"1px solid #bae6fd", fontSize:12, color:"#0f766e" }}>
          <span>מצב העברה פעיל עבור <strong>{moveModeBooking.customer_name}</strong> — בחר רכב יעד מהגריד</span>
          <button onClick={cancelMoveMode} style={{ ...chipStyle, padding:"4px 10px" }}>בטל מצב העברה</button>
        </div>
      )}

       {/* Grid table */}
       <div
         ref={gridScrollRef}
         onScroll={(e) => syncScroll(e.currentTarget, hScrollRef.current)}
         className="availability-grid-scroll"
         {...gridScrollDrag.bind}
         // Allow native horizontal scrolling (touch / trackpad / mouse wheel) + drag-scroll on desktop.
         style={{
           overflowX: "auto",
           overflowY: "auto",
           maxHeight: fullHeight ? "none" : (isMobile ? 380 : 480),
           ...gridScrollDrag.style,
         }}
       >
         <table style={{ borderCollapse:"collapse", fontSize:11, tableLayout:"fixed", width:"max-content" }}>
          <thead>
            <tr>
              {/* Corner cell — sticky top + right (RTL freeze pane) */}
              <th style={{ ...gth, position:"sticky", top:0, right:0, zIndex:3,
                           background:"#f1f5f9", width:DATE_COL_WIDTH, minWidth:DATE_COL_WIDTH, maxWidth:DATE_COL_WIDTH,
                           borderLeft:"2px solid #cbd5e1" }}>תאריך</th>
               {activeCars.map(car => {
                const tc = getModelTheme(car.name);
                const isDragTarget = dragBooking && dragOverCarId === car.id && car.id !== dragBooking.car_id;
                return (
                  <th key={car.id} style={{ ...gth, width:CAR_COL_WIDTH, minWidth:CAR_COL_WIDTH, maxWidth:CAR_COL_WIDTH,
                                            position:"sticky", top:0, zIndex:2,
                                            background: isDragTarget ? "#bfdbfe" : tc.bg,
                                            borderBottom:`3px solid ${isDragTarget ? "#2563eb" : tc.border}`,
                                            transition:"background 0.15s" }}
                      onMouseEnter={(e) => {
                        const p = clampTooltipPos(e.clientX + 14, e.clientY + 14);
                        setHoveredCar(car);
                        setTooltipPos(p);
                      }}
                      onMouseMove={(e) => {
                        if (!hoveredCar || hoveredCar?.id !== car.id) return;
                        const p = clampTooltipPos(e.clientX + 14, e.clientY + 14);
                        setTooltipPos(p);
                      }}
                      onMouseLeave={() => setHoveredCar(null)}
                    >
                    <div style={{ color: isDragTarget ? "#1d4ed8" : tc.text, fontWeight:800, fontSize:11, direction:"ltr", whiteSpace:"nowrap" }}>
                      {car.plate || "—"}
                    </div>
                    <div style={{ fontWeight:700, color: isDragTarget ? "#1d4ed8" : tc.text, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {modelBeforeMake(car.name, car.make)}
                    </div>
                    {car.group && (
                      <div style={{ color: isDragTarget ? "#2563eb" : tc.border, fontWeight:500, fontSize:9, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        קב׳ {car.group}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const ds = toISO(date);
              const dayMeta = getJewishDayMeta(ds);
              const isToday = ds === todayStr;
              const isPastDay = ds < todayStr;
              return (
                <tr key={ds}>
                  {/* Date cell — sticky right (RTL) */}
                  <td style={{ ...gtd, fontWeight:600, whiteSpace:"nowrap",
                               position:"sticky", right:0, zIndex:1,
                               background: isPastDay ? "#f1f5f9" : (isToday ? "#fff7ed" : (dayMeta.isShabbat ? "#f3e8ff" : "#f8fafc")),
                               borderLeft:"2px solid #cbd5e1",
                               color: isPastDay ? "#94a3b8" : (isToday ? "#d97706" : "#374151") }}>
                    <div>{fmtDay(date)}</div>
                    <div style={{ fontSize:9, color:"#64748b", marginTop:2 }}>{dayMeta.hebrewDate}</div>
                    {(dayMeta.isShabbat || dayMeta.isHoliday || dayMeta.isErevChag) && (
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginTop:3 }}>
                        {dayMeta.isShabbat && <span style={{ ...miniTag, background:"#7c3aed" }}>שבת</span>}
                        {dayMeta.isHoliday && <span style={{ ...miniTag, background:"#dc2626" }}>{dayMeta.holidayNames[0] || "חג"}</span>}
                        {dayMeta.isErevChag && <span style={{ ...miniTag, background:"#d97706" }}>ערב חג</span>}
                      </div>
                    )}
                     {isPastDay && <span style={{ fontSize:9, color:"#64748b", marginRight:4,
                                                background:"#e2e8f0", borderRadius:4,
                                                padding:"1px 4px" }}>עבר</span>}
                    {isToday && <span style={{ fontSize:9, color:"#f59e0b", marginRight:4,
                                               background:"#fef3c7", borderRadius:4,
                                               padding:"1px 4px" }}>היום</span>}
                  </td>
                  {activeCars.map(car => {
                    const cellBookings = occ[`${ds}:${car.id}`] || [];
                    const isDropColumn = dragBooking && dragOverCarId === car.id && car.id !== dragBooking?.car_id;

                    if (cellBookings.length === 0) {
                      return (
                        <td key={car.id}
                            title={isPastDay ? `לא ניתן להזמין את ${car.name} לתאריך עבר` : (dragBooking ? `שחרר להעברה ל-${car.name}` : `לחץ להזמנת ${car.name} ב-${ds}`)}
                            onClick={() => !dragBooking && openCreateBooking(car, ds, isPastDay)}
                            onDragOver={e => handleDragOverCell(e, car.id)}
                            onDrop={e => handleDrop(e, car)}
                            onDragLeave={() => setDragOverCarId(null)}
                            style={{ ...gtd, textAlign:"center",
                                     background: isPastDay ? "#e5e7eb" : (isDropColumn ? "#bfdbfe" : "#dcfce7"),
                                     color: isPastDay ? "#64748b" : (isDropColumn ? "#1d4ed8" : "#15803d"),
                                     cursor: isPastDay ? "not-allowed" : (dragBooking ? "copy" : "pointer"),
                                     transition:"background 0.15s",
                                     outline: isPastDay ? "1px dashed #94a3b8" : (isDropColumn ? "2px dashed #2563eb" : "none"),
                                     outlineOffset:"-2px",
                                     boxShadow: dayMeta.isShabbat ? "inset 0 -2px 0 #7c3aed55" : (dayMeta.isHoliday ? "inset 0 -2px 0 #dc262655" : "none") }}
                            onMouseEnter={e => { if (!dragBooking && !isPastDay) { e.currentTarget.style.background="#bbf7d0"; e.currentTarget.style.fontWeight="700"; }}}
                            onMouseLeave={e => { if (!dragBooking && !isPastDay) { e.currentTarget.style.background="#dcfce7"; e.currentTarget.style.fontWeight="normal"; }}}>
                          {isPastDay ? "עבר" : (isDropColumn ? "⬇" : "✓")}
                        </td>
                      );
                    }

                    const isConflict = dragBooking && dragOverCarId === car.id && cellBookings.some(cell => {
                      if (cell.id === dragBooking.id) return false;
                      if (cell.end_date === dragBooking.start_date && ds === cell.end_date) {
                          const cellRet = cell.return_time || "08:00";
                          const dragPick = dragBooking.pickup_time || "08:30";
                          if (cellRet <= dragPick) return false;
                      }
                      if (cell.start_date === dragBooking.end_date && ds === cell.start_date) {
                          const cellPick = cell.pickup_time || "08:30";
                          const dragRet = dragBooking.return_time || "08:00";
                          if (cellPick >= dragRet) return false;
                      }
                      return true;
                    });

                    if (cellBookings.length > 1) {
                        return (
                            <td key={car.id}
                                onDragOver={e => handleDragOverCell(e, car.id)}
                                onDrop={e => handleDrop(e, car)}
                                onDragLeave={() => setDragOverCarId(null)}
                                style={{ ...gtd, padding: 2, textAlign:"center", background: isDropColumn ? (isConflict ? "#fecaca" : "#bfdbfe") : "#fef08a", outline: isConflict ? "2px solid #ef4444" : "none", outlineOffset: "-2px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
                                     {cellBookings.map(b => {
                                        const isDraggingThis = dragBooking?.id === b.id;
                                         const canDragThis = permissionModel.canDragReassignBooking(b);
                                        return (
                                        <div key={b.id}
                                              title={`${b.customer_name} | ${b.start_date} ${b.pickup_time||""} - ${b.end_date} ${b.return_time||""}\n${canDragThis ? "גרור לרכב אחר להעברה" : "הקש לפעולות"}`}
                                              draggable={canDragThis}
                                             onDragStart={e => handleDragStart(e, b)}
                                             onDragEnd={handleDragEnd}
                                             onClick={e => {
                                                 e.stopPropagation();
                                                 if (dragBooking) return;
                                                  openBookingActions(b, car.name || `רכב #${car.id}`);
                                             }}
                                              style={{ flex: 1, background: isDraggingThis ? "#e0f2fe" : "rgba(255,255,255,0.7)", borderRadius: 2, padding: "2px 4px", fontSize: 10, color: isDraggingThis ? "#0369a1" : "#854d0e", cursor: canDragThis ? (isDraggingThis ? "grabbing" : "grab") : "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", border: "1px solid rgba(133,77,14,0.2)", opacity: isDraggingThis ? 0.7 : 1 }}>
                                             {surnameFirst(b.customer_name)}
                                        </div>
                                    )})}
                                </div>
                            </td>
                        );
                    }

                    const b = cellBookings[0];
                    const isFirst   = b.start_date === ds;
                    const isLast    = b.end_date   === ds;
                    const isSameDay = isFirst && isLast;
                    const isDragging = dragBooking?.id === b.id;
                     const canDragBooking = permissionModel.canDragReassignBooking(b);

                    let bg, fg, label;
                    const displayName = surnameFirst(b.customer_name);
                    
                    if (isSameDay) {
                      bg = "#e9d5ff"; fg = "#7c3aed";
                      label = (
                        <div style={{ display:"flex", flexDirection:"column", fontSize:10 }}>
                          <span style={{ fontWeight:800, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayName}</span>
                          <span>⬦ חד-יומי ({b.pickup_time||"08:30"})</span>
                        </div>
                      );
                    } else if (isFirst) {
                      bg = "#dbeafe"; fg = "#1d4ed8";
                      label = (
                        <div style={{ display:"flex", flexDirection:"column", fontSize:10 }}>
                          <span style={{ fontWeight:800, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayName}</span>
                          <span>🚀 יציאה ({b.pickup_time||"08:30"})</span>
                        </div>
                      );
                    } else if (isLast) {
                      bg = "#fef9c3"; fg = "#854d0e";
                      label = (
                        <div style={{ display:"flex", flexDirection:"column", fontSize:10 }}>
                          <span style={{ fontWeight:800, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayName}</span>
                          <span>↩ חזרה ({b.return_time||"08:00"})</span>
                        </div>
                      );
                    } else {
                      bg = "#fee2e2"; fg = "#b91c1c";
                      label = (
                        <div style={{ fontWeight:700, fontSize:10, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayName}</div>
                      );
                    }

                    return (
                      <td key={car.id}
                          title={`${b.customer_name} | ${b.start_date} ${b.pickup_time||""} – ${b.end_date} ${b.return_time||""}\n${canDragBooking ? "גרור לרכב אחר להעברה" : "הקש לפעולות"}`}
                          onClick={() => {
                            if (dragBooking) return;
                            openBookingActions(b, car.name || `רכב #${car.id}`);
                          }}
                          draggable={!!b && canDragBooking}
                          onDragStart={e => handleDragStart(e, b)}
                          onDragEnd={handleDragEnd}
                          onDragOver={e => handleDragOverCell(e, car.id)}
                          onDrop={e => handleDrop(e, car)}
                          onDragLeave={() => setDragOverCarId(null)}
                          style={{ ...gtd, textAlign:"center",
                                   background: isDragging ? "#e0f2fe" :
                                               isConflict ? "#fecaca" :
                                               isDropColumn ? "#bfdbfe" : bg,
                                   color: isDragging ? "#0369a1" :
                                          isConflict ? "#991b1b" : fg,
                                   lineHeight:1.3,
                                   cursor: canDragBooking ? (isDragging ? "grabbing" : "grab") : "pointer",
                                   opacity: isDragging ? 0.7 : 1,
                                   outline: isConflict ? "2px solid #ef4444" : "none",
                                   outlineOffset:"-2px",
                                   boxShadow: dayMeta.isShabbat ? "inset 0 -2px 0 #7c3aed55" : (dayMeta.isHoliday ? "inset 0 -2px 0 #dc262655" : "none"),
                                   transition:"background 0.15s, opacity 0.15s" }}>
                        {label}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
         </table>
       </div>

       {/* Floating horizontal scrollbar (always visible; no need to scroll to the grid bottom) */}
       <div
         ref={hScrollRef}
         onScroll={(e) => syncScroll(e.currentTarget, gridScrollRef.current)}
         {...hScrollDrag.bind}
         style={{
           height: 14,
           ...hScrollDrag.style,
           overflowX: "auto",
           overflowY: "hidden",
           background: "rgba(248,250,252,0.92)",
           borderTop: "1px solid #e2e8f0",
           backdropFilter: "blur(4px)",
         }}
       >
         <div style={{ width: Math.max(scrollWidth, 1), height: 1 }} />
       </div>

       {/* Car details tooltip */}
       {hoveredCar && (
         <div
           dir="rtl"
           style={{
             position: "fixed",
             left: tooltipPos.x,
             top: tooltipPos.y,
             zIndex: 10000,
             background: "#fff",
             border: "1px solid #e2e8f0",
             boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
             borderRadius: 8,
             padding: "8px 10px",
             minWidth: 200,
             maxWidth: 240,
             pointerEvents: "none",
           }}
         >
           <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 5 }}>
             🚗 {hoveredCar.name}
           </div>
           <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.45 }}>
             <div><strong>מס׳:</strong> #{hoveredCar.id}</div>
             {hoveredCar.plate && <div><strong>לוחית:</strong> {hoveredCar.plate}</div>}
             {hoveredCar.color && <div><strong>צבע:</strong> {hoveredCar.color}</div>}
             {hoveredCar.make && <div><strong>יצרן:</strong> {hoveredCar.make}</div>}
             {hoveredCar.group && <div><strong>קבוצה:</strong> {hoveredCar.group}</div>}
             {hoveredCar.category && <div><strong>קטגוריה:</strong> {hoveredCar.category}</div>}
           </div>
         </div>
       )}
    </div>
      {viewPhotos && (
        <ImageGallery 
          photos={viewPhotos.drive_link} 
          onClose={() => setViewPhotos(null)} 
        />
      )}

      {/* Floating Upload Queue Status */}
      {uploadQueue.length > 0 && (
        <div style={{
          position: "fixed", bottom: 20, left: 20, zIndex: 10000,
          background: "#1e293b", color: "#fff", padding: "12px 20px",
          borderRadius: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column", gap: 8, minWidth: 200,
          maxWidth: 300, border: "1px solid #334155"
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, borderBottom: "1px solid #334155", paddingBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>📤 העלאת תמונות ({uploadQueue.filter(u => u.status !== "done").length})</span>
            <button onClick={() => setUploadQueue([])} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}>נקה הכל</button>
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {uploadQueue.map(u => (
              <div key={u.id} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                  #{u.bookingId} - {u.fileName}
                </span>
                <span style={{ 
                  color: u.status === "done" ? "#22c55e" : (u.status === "error" ? "#ef4444" : "#3b82f6"),
                  fontWeight: 600 
                }}>
                  {u.status === "compressing" ? "דוחס..." : 
                   u.status === "uploading" ? "מעלה..." : 
                   u.status === "done" ? "✓ הושלם" : "✘ שגיאה"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {cameraCapture && (
        <CameraCaptureModal 
          bookingId={cameraCapture} 
          onClose={() => setCameraCapture(null)} 
          onCapture={(file) => handlePhotoUpload(cameraCapture, [file])}
        />
      )}
    </>
  );
}



const fieldWrap = { display:"flex", flexDirection:"column", gap:6, minWidth:160 };
const fieldLabel = { fontSize:12, color:"#64748b", fontWeight:600 };
const inputStyle = {
  border:"1px solid #cbd5e1", borderRadius:8, padding:"0 12px", fontSize:13,
  background:"#fff", color:"#0f172a", height:38, boxSizing:"border-box",
  display:"block",
};
const chipStyle = {
  padding:"8px 10px", borderRadius:999, border:"1px solid #cbd5e1", background:"#fff",
  color:"#334155", fontSize:12, fontWeight:600, cursor:"pointer",
};
const activeChip = { ...chipStyle, background:"#1d4ed8", color:"#fff", borderColor:"#1d4ed8" };
const gth = { padding:"6px 6px", fontWeight:700, borderBottom:"2px solid #e2e8f0",
              textAlign:"center", fontSize:11, color:"#475569", whiteSpace:"nowrap" };
const gtd = { padding:"5px 6px", borderBottom:"1px solid #f1f5f9", fontSize:12 };
const miniTag = { fontSize:8, fontWeight:700, color:"#fff", borderRadius:999, padding:"1px 5px" };
const cardStyle = { background:"#fff", borderRadius:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" };
const cardTitle = { margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#1e293b" };
const multiSelectBox = {
  border:"1px solid #cbd5e1", borderRadius:8, background:"#fff",
  padding:"6px 10px", maxHeight:130, overflowY:"auto",
  display:"flex", flexDirection:"column", gap:4,
};
const multiSelectItem = (isSelected) => ({
  display:"flex", alignItems:"center", gap:6, cursor:"pointer",
  fontSize:13, fontWeight: isSelected ? 700 : 400,
  color: isSelected ? "#1d4ed8" : "#374151",
  padding:"2px 0"
});
const separator = { borderTop:"1px solid #f1f5f9", margin:"2px 0" };


// ══════════════════════════════════════════════════════════════════════════════
