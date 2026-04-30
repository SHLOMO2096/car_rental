import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import ToastHost        from "./components/ui/ToastHost";
import { Permissions } from "./permissions";
import { useIsMobile } from "./hooks/useIsMobile";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const Cars = lazy(() => import("./pages/Cars"));
const Customers = lazy(() => import("./pages/Customers"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Reports = lazy(() => import("./pages/Reports"));
const Users = lazy(() => import("./pages/Users"));

const APP_VERSION = __APP_VERSION__;
const BUILD_TIME = new Date(__BUILD_TIME__).toLocaleString("he-IL");

function PrivateRoute({ children }) {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!isHydrated) {
    return <RouteLoader />;
  }

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

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  const links = [
    { to:"/",          label:"לוח בקרה",   icon:"📊" },
    { to:"/cars",      label:"רכבים",       icon:"🚗" },
    ...(can(Permissions.CUSTOMERS_VIEW) ? [{ to:"/customers", label:"לקוחות", icon:"👤" }] : []),
    { to:"/bookings",  label:"הזמנות",      icon:"📋" },
    { to:"/calendar",  label:"לוח שנה",     icon:"📅" },
    ...(can(Permissions.REPORTS_VIEW) ? [{ to:"/reports", label:"דוחות", icon:"📈" }] : []),
    ...(can(Permissions.USERS_MANAGE) ? [{ to:"/users", label:"משתמשים", icon:"👥" }] : []),
  ];

  return (
    <div dir="rtl" style={{ display:"flex", minHeight:"100vh",
                             fontFamily:"'Segoe UI','Arial Hebrew',Arial,sans-serif" }}>
      {isMobile && menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", zIndex:999 }}
        />
      )}
      {/* Sidebar */}
      <aside style={{
        width:220, background:"#1e293b", display:"flex",
        flexDirection:"column",
        position:isMobile ? "fixed" : "sticky",
        top:0,
        left:isMobile ? (menuOpen ? 0 : -240) : undefined,
        right:isMobile ? "auto" : undefined,
        height:"100vh",
        flexShrink:0,
        zIndex:1000,
        transition:"left 0.2s ease",
      }}>
        <div style={{ padding:"22px 18px 18px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:26 }}>🚘</div>
            <div>
              <div style={{ color:"#60a5fa", fontWeight:800, fontSize:14 }}>השכרת רכבים</div>
              <div style={{ color:"#475569", fontSize:11 }}>מערכת ניהול</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:"12px 0", overflowY:"auto" }}>
          {links.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to==="/"} onClick={() => isMobile && setMenuOpen(false)} style={({ isActive }) => ({
              display:"flex", alignItems:"center", gap:10,
              padding:"10px 18px", color: isActive ? "#60a5fa" : "#94a3b8",
              background: isActive ? "rgba(96,165,250,0.1)" : "transparent",
              textDecoration:"none", fontSize:14, fontWeight:600,
              borderRight: isActive ? "3px solid #60a5fa" : "3px solid transparent",
              transition:"all 0.15s",
            })}>
              <span style={{ fontSize:16 }}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding:"14px 18px", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{
              width:34, height:34, borderRadius:"50%", background:"#3b82f6",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontWeight:800, fontSize:14, flexShrink:0,
            }}>
              {user?.full_name?.[0] || "?"}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:600,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {user?.full_name}
              </div>
              <div style={{ color:"#64748b", fontSize:11 }}>
                {isAdmin() ? "מנהל" : "סוכן"}
              </div>
            </div>
          </div>
          <button onClick={() => { logout(); nav("/login"); }} style={{
            width:"100%", background:"rgba(239,68,68,0.12)",
            border:"1px solid rgba(239,68,68,0.25)", color:"#fca5a5",
            borderRadius:7, padding:"7px 0", fontSize:13, cursor:"pointer", fontWeight:600,
          }}>🚪 יציאה</button>
          <div style={{ marginTop:10, color:"#64748b", fontSize:11, lineHeight:1.5 }}>
            <div>גרסה: v{APP_VERSION}</div>
            <div>Build: {BUILD_TIME}</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, background:"#f8fafc", padding:isMobile ? "14px 10px" : "28px 24px",
                     overflowY:"auto", minWidth:0 }}>
        {isMobile && (
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:10, background:"#fff", border:"1px solid #e2e8f0",
            borderRadius:10, padding:"8px 10px",
          }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                border:"1px solid #cbd5e1", borderRadius:8, background:"#fff",
                padding:"6px 10px", cursor:"pointer", fontSize:13, fontWeight:700,
              }}
            >
              ☰ תפריט
            </button>
            <div style={{ fontSize:12, color:"#64748b", fontWeight:700 }}>{user?.full_name || "משתמש"}</div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    if (!isHydrated) return;
    initializeAuth();
  }, [isHydrated, initializeAuth]);

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
                  <Route path="/reports"  element={<AdminRoute><Reports /></AdminRoute>} />
                  <Route path="/users"    element={<AdminRoute><Users /></AdminRoute>} />
                  <Route path="*"         element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          } />
        </Routes>
      </Suspense>
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
      color: "#cbd5e1",
      border: "1px solid rgba(148,163,184,0.35)",
      borderRadius: 8,
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
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>טוען מסך...</div>
    </div>
  );
}

