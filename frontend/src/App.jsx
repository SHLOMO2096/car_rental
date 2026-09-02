import { Suspense, lazy, useEffect, useState } from "react";
import {
  LayoutDashboard, Car, Users as UsersIcon, ClipboardList, CalendarDays, Clock,
  TrendingUp, Wallet, Tag, UserCog, Settings as SettingsIcon,
  LogOut, Menu, CarFront, ChevronRight, ChevronLeft,
} from "lucide-react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import ToastHost        from "./components/ui/ToastHost";
import { Permissions } from "./permissions";
import { useIsMobile } from "./hooks/useIsMobile";
import Modal from "./components/ui/Modal";
import { attendanceAPI } from "./api/attendance";
import { toast } from "./store/toast";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const Cars = lazy(() => import("./pages/Cars"));
const Customers = lazy(() => import("./pages/Customers"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Reports = lazy(() => import("./pages/Reports"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const Payroll = lazy(() => import("./pages/Payroll"));
const Pricing = lazy(() => import("./pages/Pricing"));

// כלי פיתוח — לא נכנס ל-build של פרודקשן (import.meta.env.DEV נקבע בזמן build).
const ThemeLab = import.meta.env.DEV ? lazy(() => import("./components/dev/ThemeLab")) : null;

const APP_VERSION = __APP_VERSION__;
const BUILD_TIME = new Date(__BUILD_TIME__).toLocaleString("he-IL");

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  return (isAuthenticated && token && user) ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin())       return <Navigate to="/" replace />;
  return children;
}

function Layout({ children }) {
  const { user, logout, isAdmin, can } = useAuthStore();
  const nav = useNavigate();
  const isMobile = useIsMobile(900);
  const [menuOpen, setMenuOpen] = useState(false);
  // מצב הכיווץ נשמר בין ביקורים — מי שבחר סרגל צר מצפה למצוא אותו כך.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* private mode */ }
  }, [collapsed]);
  const [logoutAttendancePrompt, setLogoutAttendancePrompt] = useState({
    open: false,
    busy: false,
    status: null,
  });

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  const links = [
    { to:"/",          label:"לוח בקרה",   Icon: LayoutDashboard },
    { to:"/cars",      label:"רכבים",       Icon: Car },
    ...(can(Permissions.CUSTOMERS_VIEW) ? [{ to:"/customers", label:"לקוחות", Icon: UsersIcon }] : []),
    { to:"/bookings",  label:"הזמנות",      Icon: ClipboardList },
    { to:"/calendar",  label:"לוח שנה",     Icon: CalendarDays },
    ...(can(Permissions.ATTENDANCE_VIEW) ? [{ to:"/attendance", label:"נוכחות", Icon: Clock }] : []),
    ...(can(Permissions.REPORTS_VIEW) ? [{ to:"/reports", label:"סטטיסטיקות", Icon: TrendingUp }] : []),
    ...(can(Permissions.PAYROLL_VIEW) ? [{ to:"/payroll", label:"שכר עובדים", Icon: Wallet }] : []),
    ...(can(Permissions.PRICING_VIEW) ? [{ to:"/pricing", label:"מחירים", Icon: Tag }] : []),
    ...(can(Permissions.USERS_MANAGE) ? [{ to:"/users", label:"משתמשים", Icon: UserCog }] : []),
    ...(can(Permissions.USERS_MANAGE) ? [{ to:"/settings", label:"הגדרות", Icon: SettingsIcon }] : []),
  ];


  async function handleLogoutClick() {
    // If the user has an active shift, ask what they want to do.
    // Requirement: logout does NOT automatically end shift.
    try {
      const status = await attendanceAPI.myStatus();
      if (status?.open_shift) {
        setLogoutAttendancePrompt({ open: true, busy: false, status });
        return;
      }
    } catch {
      // If attendance status check fails, fallback to a normal logout.
    }

    logout();
    nav("/login");
  }

  return (
    <div dir="rtl" style={{ display:"flex", minHeight:"100vh" }}>
      {isMobile && menuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />
      )}
      <aside
        className="sidebar"
        data-collapsed={collapsed && !isMobile}
        data-open={isMobile && menuOpen}
      >
        <div className="sidebar__head">
          <CarFront size={26} strokeWidth={1.6} color="var(--c-brand-bright)" aria-hidden="true" />
          <div className="sidebar__brand">
            <div className="sidebar__brand-name">השכרת רכבים</div>
            <div className="sidebar__brand-sub">מערכת ניהול</div>
          </div>
          {!isMobile && (
            <button
              type="button"
              className="sidebar__toggle"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "הרחב את סרגל הצד" : "כווץ את סרגל הצד"}
              title={collapsed ? "הרחב" : "כווץ"}
            >
              {collapsed
                ? <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                : <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />}
            </button>
          )}
        </div>

        <nav className="sidebar__nav" aria-label="ניווט ראשי">
          {links.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => isMobile && setMenuOpen(false)}
              className={({ isActive }) => `sidebar__link${isActive ? " is-active" : ""}`}
              title={collapsed && !isMobile ? label : undefined}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__user">
            <div className="sidebar__avatar" title={user?.full_name}>
              {user?.full_name?.[0] || "?"}
            </div>
            <div className="sidebar__user-text" style={{ minWidth: 0 }}>
              <div className="sidebar__user-name">{user?.full_name}</div>
              <div className="sidebar__user-role">{isAdmin() ? "מנהל" : "סוכן"}</div>
            </div>
          </div>

          <button
            onClick={handleLogoutClick}
            className="sidebar__logout"
            title={collapsed && !isMobile ? "יציאה" : undefined}
          >
            <LogOut size={15} strokeWidth={1.9} aria-hidden="true" />
            <span>יציאה</span>
          </button>

          <div className="sidebar__build">
            <div>גרסה: v{APP_VERSION}</div>
            <div>Build: {BUILD_TIME}</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, background:"#f7faf8", padding:isMobile ? "14px 10px" : "28px 24px",
                     overflowY:"auto", minWidth:0 }}>
        {isMobile && (
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:10, background:"#fff", border:"1px solid #e3e7e5",
            borderRadius:14, padding:"8px 10px",
          }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                border:"1px solid #ccd2cf", borderRadius:12, background:"#fff",
                padding:"7px 12px", cursor:"pointer", fontSize:13, fontWeight:700,
                display:"flex", alignItems:"center", gap:7,
              }}
            >
              <Menu size={16} strokeWidth={1.9} aria-hidden="true" />
              תפריט
            </button>
            <div style={{ fontSize:12, color:"#707774", fontWeight:700 }}>{user?.full_name || "משתמש"}</div>
          </div>
        )}
        {children}
      </main>

      <Modal
        open={logoutAttendancePrompt.open}
        onClose={() => {
          if (logoutAttendancePrompt.busy) return;
          setLogoutAttendancePrompt({ open: false, busy: false, status: null });
        }}
        title="משמרת פעילה"
        maxWidth={520}
      >
        <div style={{ color: "#404643", fontSize: 14, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10 }}>
            יש לך משמרת פעילה. יציאה מהחשבון לא מסיימת משמרת אוטומטית.
          </div>

          {!!logoutAttendancePrompt.status?.open_shift?.shift_start_at && (
            <div style={{ marginBottom: 10, fontSize: 13, color: "#59605d" }}>
              התחלה: {new Date(logoutAttendancePrompt.status.open_shift.shift_start_at).toLocaleString("he-IL")}
            </div>
          )}

          <div style={{ marginBottom: 18, fontSize: 13, color: "#59605d" }}>
            מכשירים פתוחים: {logoutAttendancePrompt.status?.open_device_sessions?.length || 0}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              onClick={() => setLogoutAttendancePrompt({ open: false, busy: false, status: null })}
              disabled={logoutAttendancePrompt.busy}
              style={{
                background: "#eff3f1",
                color: "#59605d",
                border: "1px solid #e3e7e5",
                borderRadius: 12,
                padding: "9px 16px",
                fontWeight: 700,
                cursor: logoutAttendancePrompt.busy ? "not-allowed" : "pointer",
              }}
            >
              ביטול
            </button>

            <button
              onClick={() => {
                logout();
                nav("/login");
              }}
              disabled={logoutAttendancePrompt.busy}
              style={{
                background: "#fff",
                color: "#141816",
                border: "1px solid #ccd2cf",
                borderRadius: 12,
                padding: "9px 16px",
                fontWeight: 800,
                cursor: logoutAttendancePrompt.busy ? "not-allowed" : "pointer",
              }}
            >
              יציאה בלבד
            </button>

            <button
              onClick={async () => {
                try {
                  setLogoutAttendancePrompt((s) => ({ ...s, busy: true }));
                  await attendanceAPI.endShift();
                  logout();
                  nav("/login");
                } catch (e) {
                  toast.error(e?.detail || "לא הצלחנו לסיים משמרת");
                  setLogoutAttendancePrompt((s) => ({ ...s, busy: false }));
                }
              }}
              disabled={logoutAttendancePrompt.busy}
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "#dc2626",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 12,
                padding: "9px 16px",
                fontWeight: 900,
                cursor: logoutAttendancePrompt.busy ? "not-allowed" : "pointer",
              }}
            >
              {logoutAttendancePrompt.busy ? "מסיים משמרת..." : "סיים משמרת ויציאה"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const onAuthExpired = () => {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    };
    window.addEventListener("auth:expired", onAuthExpired);
    return () => window.removeEventListener("auth:expired", onAuthExpired);
  }, []);

  return (
    <BrowserRouter>
      <ToastHost />
      <BuildInfoBadge />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/"         element={<Dashboard />} />
                  <Route path="/cars"     element={<Cars />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/bookings" element={<Bookings />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/reports"  element={<AdminRoute><Reports /></AdminRoute>} />
                  <Route path="/payroll" element={<AdminRoute><Payroll /></AdminRoute>} />
                  <Route path="/pricing" element={<PrivateRoute><Pricing /></PrivateRoute>} />
                  <Route path="/users"    element={<AdminRoute><Users /></AdminRoute>} />
                  <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
                  <Route path="*"         element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          } />
        </Routes>
      </Suspense>

      {ThemeLab && (
        <Suspense fallback={null}>
          <ThemeLab />
        </Suspense>
      )}
    </BrowserRouter>
  );
}

function BuildInfoBadge() {
  const isMobile = useIsMobile(900);
  if (isMobile) return null;
  return (
    <div style={{
      position: "fixed",
      left: 12,
      bottom: 12,
      zIndex: 9999,
      background: "rgba(15,23,42,0.88)",
      color: "#ccd2cf",
      border: "1px solid rgba(148,163,184,0.35)",
      borderRadius: 12,
      padding: "6px 10px",
      fontSize: 11,
      lineHeight: 1.4,
      direction: "ltr",
      pointerEvents: "none",
    }}>
      <div>v{APP_VERSION}</div>
      <div>{BUILD_TIME}</div>
    </div>
  );
}

function RouteLoader() {
  return (
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7faf8" }}>
      <div style={{ color: "#707774", fontSize: 14, fontWeight: 600 }}>טוען מסך...</div>
    </div>
  );
}

