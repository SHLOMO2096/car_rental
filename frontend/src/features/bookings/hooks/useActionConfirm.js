import { useRef, useState } from "react";

/**
 * Hook קטן שמנהל Confirm "אסינכרוני" (Promise-based) כדי לא לפזר state/ref בדפים.
 */
export function useActionConfirm() {
  const [actionConfirm, setActionConfirm] = useState(null);
  const actionConfirmResolveRef = useRef(null);

  function askActionConfirm({ message, messageList = null, confirmLabel = "אישור", confirmColor = "#1d4ed8" }) {
    return new Promise((resolve) => {
      actionConfirmResolveRef.current = resolve;
      setActionConfirm({ message, messageList, confirmLabel, confirmColor });
    });
  }

  function closeActionConfirm(result) {
    if (actionConfirmResolveRef.current) {
      actionConfirmResolveRef.current(result);
      actionConfirmResolveRef.current = null;
    }
    setActionConfirm(null);
  }

  return {
    actionConfirm,
    askActionConfirm,
    closeActionConfirm,
  };
}

