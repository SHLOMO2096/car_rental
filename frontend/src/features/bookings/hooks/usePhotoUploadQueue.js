import { useEffect, useRef, useState } from "react";

import { getUserFacingErrorMessage } from "../../../api/errors";
import { toast } from "../../../store/toast";
import { compressImage } from "../utils/images";

/**
 * מנהל תור העלאות תמונות + סטטוסים (compressing/uploading/done/error)
 * בצורה מבודדת, כדי ש-BookingsPage לא יהיה עמוס.
 */
export function usePhotoUploadQueue({ uploadPhoto }) {
  const [uploadQueue, setUploadQueue] = useState([]);

  const isMountedRef = useRef(true);
  const timeoutsRef = useRef(new Set());

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clean up scheduled removals
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  function safeSetQueue(updater) {
    if (!isMountedRef.current) return;
    setUploadQueue(updater);
  }

  function clearUploadQueue() {
    safeSetQueue([]);
  }

  async function uploadPhotos(bookingId, files) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    const newUploads = fileList.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      bookingId,
      fileName: file.name,
      status: "compressing",
    }));

    safeSetQueue((prev) => [...prev, ...newUploads]);

    fileList.forEach(async (file, index) => {
      const uploadId = newUploads[index].id;
      try {
        const compressed = await compressImage(file);
        safeSetQueue((prev) => prev.map((u) => (u.id === uploadId ? { ...u, status: "uploading" } : u)));
        await uploadPhoto(bookingId, compressed);
        safeSetQueue((prev) => prev.map((u) => (u.id === uploadId ? { ...u, status: "done" } : u)));

        const t = setTimeout(() => {
          timeoutsRef.current.delete(t);
          safeSetQueue((prev) => prev.filter((u) => u.id !== uploadId));
        }, 3000);
        timeoutsRef.current.add(t);

        if (index === 0 && fileList.length === 1) {
          toast.success(`צילום הועלה בהצלחה להזמנה #${bookingId}`);
        }
      } catch (e) {
        safeSetQueue((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, status: "error", error: getUserFacingErrorMessage(e) } : u)),
        );
        toast.error(`נכשל העלאת תמונה: ${getUserFacingErrorMessage(e)}`);
      }
    });
  }

  return {
    uploadQueue,
    clearUploadQueue,
    uploadPhotos,
  };
}

