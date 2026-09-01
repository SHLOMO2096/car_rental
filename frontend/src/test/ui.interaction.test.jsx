// ══════════════════════════════════════════════════════════════════════════════
// בדיקות התנהגות לרכיבי הממשק המשותפים.
//
// שני באגים אמיתיים דווחו מהמערכת החיה ועברו בשקט דרך הבנייה, 25 הטסטים
// ושער העקרונות: המיקוד קפץ מהשדה אחרי תו אחד, ותפריט לא נסגר בלחיצה.
// שניהם התנהגות, וכל מה שנמדד עד כה היה מבנה סטטי. הקובץ הזה סוגר את הפער.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import ActionMenu from "../components/ui/ActionMenu";
import Modal from "../components/ui/Modal";

describe("Modal", () => {
  // ה-onClose מגיע מכל אתרי הקריאה כפונקציית חץ אנונימית, כלומר זהות
  // חדשה בכל רינדור. כשמלכודת המיקוד הייתה תלויה בו, כל הקשה מיקדה מחדש
  // את האלמנט הראשון בחלון — והמשתמש נאלץ ללחוץ בחזרה על השדה בין אות לאות.
  function TypingHarness() {
    const [value, setValue] = useState("");
    return (
      <Modal open onClose={() => {}} title="הזמנה חדשה">
        <input
          aria-label="שם לקוח"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Modal>
    );
  }

  it("keeps focus in the field while typing, even though onClose changes identity on every render", async () => {
    const user = userEvent.setup();
    render(<TypingHarness />);

    const input = screen.getByLabelText("שם לקוח");
    await user.click(input);
    await user.keyboard("ד");

    expect(document.activeElement).toBe(input);
  });

  it("accumulates every character typed into the field", async () => {
    const user = userEvent.setup();
    render(<TypingHarness />);

    const input = screen.getByLabelText("שם לקוח");
    await user.click(input);
    await user.keyboard("דוד לוי");

    expect(input).toHaveValue("דוד לוי");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="בדיקה"><p>תוכן</p></Modal>);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ActionMenu", () => {
  const items = [
    { label: "עריכה", onSelect: vi.fn() },
    { label: "מחיקה", onSelect: vi.fn(), danger: true },
  ];

  function open(user) {
    return user.click(screen.getByRole("button", { name: "פעולות בשורה" }));
  }

  it("opens from the trigger and closes on a second click", async () => {
    const user = userEvent.setup();
    render(<ActionMenu label="פעולות בשורה" items={items} />);

    await open(user);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await open(user);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("closes when clicking outside it", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ActionMenu label="פעולות בשורה" items={items} />
        <button type="button">מחוץ לתפריט</button>
      </div>
    );

    await open(user);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "מחוץ לתפריט" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("runs the chosen action and closes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ActionMenu label="פעולות בשורה" items={[{ label: "עריכה", onSelect }]} />);

    await open(user);
    await user.click(screen.getByRole("menuitem", { name: "עריכה" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("returns focus to the trigger when dismissed with Escape", async () => {
    const user = userEvent.setup();
    render(<ActionMenu label="פעולות בשורה" items={items} />);

    const trigger = screen.getByRole("button", { name: "פעולות בשורה" });
    await open(user);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it("is navigable with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<ActionMenu label="פעולות בשורה" items={items} />);

    screen.getByRole("button", { name: "פעולות בשורה" }).focus();
    await user.keyboard("{ArrowDown}");

    const menuItems = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(menuItems[0]);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(menuItems[1]);
  });
});


// ══════════════════════════════════════════════════════════════════════════════
