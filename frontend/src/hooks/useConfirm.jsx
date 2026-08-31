// ══════════════════════════════════════════════════════════════════════════════
// מחליף את confirm() של הדפדפן בקומפוננטת האישור של המערכת, בלי לשכתב
// את אתרי הקריאה: הם נשארים `if (!(await confirm("...")))`, רק עם await.
//
//   const [confirm, confirmDialog] = useConfirm();
//   ...
//   if (!(await confirm("למחוק?"))) return;
//   ...
//   return (<> ... {confirmDialog} </>);
import { useCallback, useState } from "react";
import Confirm from "../components/ui/Confirm";

export function useConfirm() {
  const [pending, setPending] = useState(null);

  const confirm = useCallback(
    (message, { confirmLabel, messageList } = {}) =>
      new Promise((resolve) => setPending({ message, confirmLabel, messageList, resolve })),
    []
  );

  const settle = useCallback((answer) => {
    setPending((current) => {
      current?.resolve(answer);
      return null;
    });
  }, []);

  const confirmDialog = (
    <Confirm
      open={!!pending}
      message={pending?.message}
      messageList={pending?.messageList}
      confirmLabel={pending?.confirmLabel}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return [confirm, confirmDialog];
}


// ══════════════════════════════════════════════════════════════════════════════
