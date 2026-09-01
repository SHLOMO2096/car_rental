import React, { useState, useEffect, useRef } from "react";
import Modal from "../ui/Modal";
import ActionMenu from "../ui/ActionMenu";
import { X, ChevronRight, ChevronLeft, Camera, Images, FolderOpen } from "lucide-react";

/**
 * ImageGallery - A Lightbox-style viewer for booking photos.
 */
/**
 * Converts a Google Drive sharing link to a direct image link.
 * Uses the thumbnail endpoint which is more mobile-friendly and handles CORS better.
 */
function getDirectDriveLink(url) {
  if (!url || !url.includes("drive.google.com")) return url;
  
  const match = url.match(/\/d\/(.+?)\/(view|edit|preview)/) || url.match(/id=(.+?)(&|$)/);
  if (match && match[1]) {
    // sz=w1600 provides a high-quality version that is reliable on mobile
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
  }
  return url;
}

export function ImageGallery({ photos, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const urls = photos ? photos.split(",").map(u => u.trim()).filter(Boolean) : [];

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [currentIndex]);

  if (urls.length === 0) return null;

  const next = (e) => { e.stopPropagation(); setCurrentIndex((currentIndex + 1) % urls.length); };
  const prev = (e) => { e.stopPropagation(); setCurrentIndex((currentIndex - 1 + urls.length) % urls.length); };

  return (
    <div 
      style={{ 
        position: "fixed", inset: 0, zIndex: 30000, background: "rgba(0,0,0,0.95)", 
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        touchAction: "none"
      }}
      onClick={onClose}
    >
      {/* Header / Controls */}
      <div style={{ position: "absolute", top: 20, right: 20, left: 20, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 30001 }}>
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 24 }}>
          תמונה {currentIndex + 1} / {urls.length}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button 
            onClick={onClose} 
            style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={17} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: 20, boxSizing: "border-box" }}>
        {urls.length > 1 && (
          <button 
            onClick={prev} 
            style={{ position: "absolute", left: 10, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%", width: 44, height: 44, fontSize: 20, cursor: "pointer", zIndex: 30002, backdropFilter: "blur(4px)" }}
          >
            <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        
        {loading && <div style={{ position: "absolute", color: "#fff", fontSize: 14 }}>טוען תמונה...</div>}
        
        <img 
          src={getDirectDriveLink(urls[currentIndex])} 
          alt={`Photo ${currentIndex + 1}`} 
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          style={{ 
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
            borderRadius: 12, boxShadow: "0 8px 24px rgba(20,24,22,0.12), 0 32px 80px rgba(20,24,22,0.22)", 
            display: (loading || error) ? "none" : "block"
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {error && (
          <div style={{ color: "#fff", textAlign: "center", padding: 20 }}>
            <p>שגיאה בטעינת התמונה במכשיר זה.</p>
            <button 
              onClick={() => window.open(urls[currentIndex], "_blank")}
              style={{ background: "#fff", color: "#000", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, marginTop: 10 }}
            >
              פתח בטאב חדש
            </button>
          </div>
        )}

        {urls.length > 1 && (
          <button 
            onClick={next} 
            style={{ position: "absolute", right: 10, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%", width: 44, height: 44, fontSize: 20, cursor: "pointer", zIndex: 30002, backdropFilter: "blur(4px)" }}
          >
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * CameraCaptureModal - Continuous camera capture UI.
 */
export function CameraCaptureModal({ bookingId, onClose, onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        console.error("Camera error:", err);
        setError("לא ניתן לגשת למצלמה. וודא שנתת הרשאות.");
      }
    }
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      }
    }, 'image/jpeg', 0.85);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40000, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 40001 }}>
        <button onClick={onClose} style={{ background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 40, height: 40, fontSize: 20, cursor: "pointer" }}><X size={17} strokeWidth={1.9} aria-hidden="true" /></button>
      </div>
      
      {error ? (
        <div style={{ color: "#fff", padding: 40, textAlign: "center" }}>{error}</div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          
          {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.8, zIndex: 40002 }} />}

          <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>
            <button 
              onClick={capture}
              style={{ 
                width: 80, height: 80, borderRadius: "50%", border: "6px solid #fff", 
                background: "rgba(255,255,255,0.3)", cursor: "pointer", display: "flex", 
                alignItems: "center", justifyContent: "center" 
              }}
            >
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#fff" }} />
            </button>
          </div>
          <div style={{ position: "absolute", bottom: 130, width: "100%", textAlign: "center", color: "#fff", fontSize: 14, fontWeight: 700, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
            צילום רציף - לחץ כדי לצלם
          </div>
        </>
      )}
    </div>
  );
}

/**
 * PhotoMenu - Unified menu for photo actions.
 */
export function PhotoMenu({ booking, onView, onUpload, onContinuousCamera, variant = "default" }) {
  const photoCount = booking.drive_link ? booking.drive_link.split(",").filter(Boolean).length : 0;
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    if (e.target.files?.length > 0) {
      onUpload(e.target.files);
      e.target.value = "";
    }
  }

  // התפריט נסגר לפני שהפעולה רצה (ראו choose ב-ActionMenu), אז דיאלוג
  // הקבצים נפתח על מסך נקי ולא מתחת לשכבה שנסגרת.
  const items = [
    photoCount > 0 && {
      label: `גלריית תמונות (${photoCount})`, Icon: Images, onSelect: onView,
    },
    { label: "צילום רציף", Icon: Camera, onSelect: onContinuousCamera },
    {
      label: "בחר מהגלריה", Icon: FolderOpen,
      onSelect: () => setTimeout(() => fileInputRef.current?.click(), 0),
    },
  ];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <ActionMenu
        Icon={Camera}
        badge={photoCount}
        align={variant === "compact" ? "end" : "start"}
        label={`תמונות להזמנה ${booking.id}`}
        items={items}
      />
    </>
  );
}
