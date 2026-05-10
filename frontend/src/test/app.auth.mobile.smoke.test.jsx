import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { carsAPI } from "../api/cars";
import { useDragScroll } from "../hooks/useDragScroll";
import { useAuthStore } from "../store/auth";

vi.mock("../api/auth", () => ({
  authAPI: {
    login: vi.fn(),
    me: vi.fn(async () => ({ id: 1, full_name: "Admin", role: "admin" })),
  },
}));

vi.mock("../api/cars", () => ({
  carsAPI: {
    list: vi.fn(async () => []),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deletePermanent: vi.fn(),
    availability: vi.fn(),
  },
}));

vi.mock("../api/reports", () => ({
  reportsAPI: {
    summary: vi.fn(async () => ({ total: 0, active: 0, revenue: 0 })),
    monthly: vi.fn(async () => []),
    topCars: vi.fn(async () => []),
  },
}));

vi.mock("../api/bookings", () => ({
  bookingsAPI: {
    calendar: vi.fn(async () => []),
    kpi: vi.fn(async () => ({ total: 0, active: 0 })),
    list: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

function setViewport(width) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

function setRoute(pathname) {
  window.history.pushState({}, "", pathname);
}

function resetAuthState() {
  useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
}

describe("App auth + mobile smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetAuthState();
  });

  it("redirects unauthenticated direct /cars route to login", async () => {
    setViewport(1280);
    setRoute("/cars");

    render(<App />);

    expect(await screen.findByText("כניסה למערכת")).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  it("renders login page on mobile without white screen", async () => {
    setViewport(390);
    setRoute("/login");

    render(<App />);

    expect(await screen.findByText("כניסה למערכת")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "כניסה" })).toBeInTheDocument();
  });

  it("shows cars page when authenticated", async () => {
    setViewport(1366);
    localStorage.setItem("token", "good-token");
    useAuthStore.setState({
      token: "good-token",
      user: { id: 1, full_name: "Admin", role: "admin" },
      isAuthenticated: true,
    });
    setRoute("/cars");

    render(<App />);

    expect(await screen.findByText("ניהול רכבים")).toBeInTheDocument();
  });

  it("renders dashboard on desktop when authenticated", async () => {
    setViewport(1366);
    carsAPI.list.mockResolvedValueOnce([{ id: 1, name: "Toyota Test", is_active: true, plate: "11-111-11" }]);
    localStorage.setItem("token", "good-token");
    useAuthStore.setState({
      token: "good-token",
      user: { id: 1, full_name: "Admin", role: "admin" },
      isAuthenticated: true,
    });
    setRoute("/");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "לוח בקרה" }, { timeout: 6000 })).toBeInTheDocument();
  });

  it("renders dashboard on mobile without white screen", async () => {
    setViewport(390);
    carsAPI.list.mockResolvedValueOnce([{ id: 1, name: "Toyota Test", is_active: true, plate: "11-111-11" }]);
    localStorage.setItem("token", "good-token");
    useAuthStore.setState({
      token: "good-token",
      user: { id: 1, full_name: "Admin", role: "admin" },
      isAuthenticated: true,
    });
    setRoute("/");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "לוח בקרה" })).toBeInTheDocument();
  });

  it("shows past dashboard cells as non-bookable and blocks navigation from them", async () => {
    const user = userEvent.setup();
    setViewport(1366);
    carsAPI.list.mockResolvedValueOnce([{ id: 1, name: "Toyota Test", is_active: true, plate: "11-111-11" }]);
    localStorage.setItem("token", "good-token");
    useAuthStore.setState({
      token: "good-token",
      user: { id: 1, full_name: "Admin", role: "admin" },
      isAuthenticated: true,
    });
    setRoute("/");

    render(<App />);

    expect(await screen.findByText("עבר · לא ניתן להזמין")).toBeInTheDocument();
    const pastCells = await screen.findAllByTitle(/לא ניתן להזמין.*לתאריך עבר/);
    const pastCell = pastCells[0];
    await user.click(pastCell);
    expect(window.location.pathname).toBe("/");
  });

  it("blocks stale auth state without token on /cars", async () => {
    setViewport(1280);
    useAuthStore.setState({
      token: null,
      user: { id: 1, full_name: "Admin", role: "admin" },
      isAuthenticated: true,
    });
    setRoute("/cars");

    render(<App />);

    expect(await screen.findByText("כניסה למערכת")).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });
});

function mockScrollable(el, { scrollWidth = 1000, clientWidth = 200 } = {}) {
  Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true });
}

function ScrollerWithHook({ onChildClick } = {}) {
  const drag = useDragScroll({ axis: "x" });
  return (
    <div
      data-testid="scroller"
      {...drag.bind}
      style={{
        ...drag.style,
        overflowX: "auto",
        width: 200,
        border: "1px solid #000",
      }}
    >
      <button type="button" onClick={onChildClick}>
        child
      </button>
      <input aria-label="name" defaultValue="x" />
      <div style={{ width: 800, height: 1 }} />
    </div>
  );
}

describe("useDragScroll", () => {
  it("updates scrollLeft on horizontal pointer drag", () => {
    render(<ScrollerWithHook onChildClick={() => {}} />);
    const scroller = screen.getByTestId("scroller");
    mockScrollable(scroller);

    scroller.scrollLeft = 100;
    fireEvent.pointerDown(scroller, { pointerId: 1, clientX: 100, clientY: 10, button: 0, isPrimary: true });
    fireEvent.pointerMove(scroller, { pointerId: 1, clientX: 40, clientY: 10, isPrimary: true });
    fireEvent.pointerUp(scroller, { pointerId: 1, clientX: 40, clientY: 10, isPrimary: true });

    // Dragging left should increase scrollLeft.
    expect(scroller.scrollLeft).toBe(160);
  });

  it("suppresses click only if an actual drag occurred", () => {
    const onChildClick = vi.fn();
    render(<ScrollerWithHook onChildClick={onChildClick} />);
    const scroller = screen.getByTestId("scroller");
    mockScrollable(scroller);
    const btn = screen.getByRole("button", { name: "child" });

    // No drag: click should pass.
    fireEvent.click(btn);
    expect(onChildClick).toHaveBeenCalledTimes(1);

    // Drag: click should be suppressed.
    scroller.scrollLeft = 0;
    fireEvent.pointerDown(scroller, { pointerId: 2, clientX: 100, clientY: 10, button: 0, isPrimary: true });
    fireEvent.pointerMove(scroller, { pointerId: 2, clientX: 20, clientY: 10, isPrimary: true });
    fireEvent.pointerUp(scroller, { pointerId: 2, clientX: 20, clientY: 10, isPrimary: true });
    fireEvent.click(btn);

    expect(onChildClick).toHaveBeenCalledTimes(1);
  });

  it("does not start drag-scroll from inputs", () => {
    render(<ScrollerWithHook onChildClick={() => {}} />);
    const scroller = screen.getByTestId("scroller");
    mockScrollable(scroller);
    const input = screen.getByLabelText("name");

    scroller.scrollLeft = 100;
    fireEvent.pointerDown(input, { pointerId: 3, clientX: 100, clientY: 10, button: 0, isPrimary: true });
    fireEvent.pointerMove(scroller, { pointerId: 3, clientX: 20, clientY: 10, isPrimary: true });
    fireEvent.pointerUp(scroller, { pointerId: 3, clientX: 20, clientY: 10, isPrimary: true });

    expect(scroller.scrollLeft).toBe(100);
  });
});

