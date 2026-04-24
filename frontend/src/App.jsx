import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import Login            from "./pages/Login";
import { Dashboard }    from "./pages/Dashboard";
import { CalendarPage } from "./pages/CalendarPage";
import Cars             from "./pages/Cars";
import Bookings         from "./pages/Bookings";
import Reports          from "./pages/Reports";
import Users            from "./pages/Users";

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin())       return <Navigate to="/" replace />;
  return children;
}

function Layout({ children }) {
  const { user, logout, isAdmin } = useAuthStore();
  const nav = useNavigate();

  const links = [
    { to:"/",          label:"לוח בקרה",   icon:"📊" },
    { to:"/cars",      label:"רכבים",       icon:"🚗" },
    { to:"/bookings",  label:"הזמנות",      icon:"📋" },
    { to:"/calendar",  label:"לוח שנה",     icon:"📅" },
    { to:"/reports",   label:"דוחות",       icon:"📈" },
    ...(isAdmin() ? [{ to:"/users", label:"משתמשים", icon:"👥" }] : []),
  ];

  return (
    <div dir="rtl" style={{ display:"flex", minHeight:"100vh",
                             fontFamily:"'Segoe UI','Arial Hebrew',Arial,sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width:220, background:"#1e293b", display:"flex",
        flexDirection:"column", position:"sticky", top:0, height:"100vh",
        flexShrink:0,
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
            <NavLink key={to} to={to} end={to==="/"} style={({ isActive }) => ({
              display:"flex", alignItems:"center", gap:10,
              padding:"10px 18px", color: isActive ? "#60a5fa" : "#94a3b8",
              background: isActive ? "rgba(96,165,250,0.1)" : "transparent",
              textDecoration:"none", fontSize:14, fontWeight:600,
              borderRight: isActive ? "3px solid #60a5fa" : "3px solid transparent",
              transition:"all 0.15s",
            })}>
              <span style={{ fontSize:16 }}>{icon}</span>
              {label}
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
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, background:"#f8fafc", padding:"28px 24px",
                     overflowY:"auto", minWidth:0 }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/"         element={<Dashboard />} />
                <Route path="/cars"     element={<Cars />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/reports"  element={<Reports />} />
                <Route path="/users"    element={<AdminRoute><Users /></AdminRoute>} />
                <Route path="*"         element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
