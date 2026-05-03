import React, { useState, useEffect, useRef } from "react";
import Modal from "../ui/Modal";

/**
 * ImageGallery - A Lightbox-style viewer for booking photos.
 */
export function ImageGallery({ photos, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const urls = photos ? photos.split(",").map(u => u.trim()).filter(Boolean) : [];

  useEffect(() => {
    setLoading(true);
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
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 20 }}>
          תמונה {currentIndex + 1} / {urls.length}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button 
            onClick={(e) => { e.stopPropagation(); window.open(urls[currentIndex], "_blank"); }}
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 15px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
          >
            📂 פתח מקור
          </button>
          <button 
            onClick={onClose} 
            style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ✕
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
            ❮
          </button>
        )}
        
        {loading && <div style={{ position: "absolute", color: "#fff", fontSize: 14 }}>טוען תמונה...</div>}
        
        <img 
          src={urls[currentIndex]} 
          alt={`Photo ${currentIndex + 1}`} 
          onLoad={() => setLoading(false)}
          style={{ 
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
            borderRadius: 8, boxShadow: "0 10px 40px rgba(0,0,0,0.5)", 
            display: loading ? "none" : "block"
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {urls.length > 1 && (
          <button 
            onClick={next} 
            style={{ position: "absolute", right: 10, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%", width: 44, height: 44, fontSize: 20, cursor: "pointer", zIndex: 30002, backdropFilter: "blur(4px)" }}
          >
            ❯
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
        <button onClick={onClose} style={{ background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 40, height: 40, fontSize: 20, cursor: "pointer" }}>✕</button>
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
export function PhotoMenu({ booking, onView, onUpload, onContinuousCamera, isOpen, onToggle }) {
  const photoCount = booking.drive_link ? booking.drive_link.split(",").filter(Boolean).length : 0;
  
  const btnStyle = {
    background: photoCount > 0 ? "#eff6ff" : "#f8fafc",
    color: photoCount > 0 ? "#1d4ed8" : "#475569",
    border: "1px solid",
    borderColor: photoCount > 0 ? "#bfdbfe" : "#e2e8f0",
    padding: "8px 16px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    position: "relative"
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} style={btnStyle} title="ניהול תמונות">
        📸 תמונות
        {photoCount > 0 && (
          <span style={{ 
            fontSize: 11, background: "#1d4ed8", color: "#fff", borderRadius: 99, 
            width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" 
          }}>
            {photoCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: "fixed", inset: 0, zIndex: 10001 }} 
            onClick={(e) => { e.stopPropagation(); onToggle(); }} 
          />
          <div style={{
            position: "absolute", bottom: "100%", left: 0, marginBottom: 8,
            zIndex: 10002, background: "#fff", borderRadius: 12, 
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)", border: "1px solid #e2e8f0",
            minWidth: 190, overflow: "hidden"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: 12, color: "#64748b", background: "#f8fafc" }}>
              פעולות תמונה #{booking.id}
            </div>
            
            {photoCount > 0 && (
              <button 
                onClick={() => { onView(); onToggle(); }}
                style={{ 
                  width: "100%", textAlign: "right", padding: "12px 16px", border: "none", 
                  background: "transparent", cursor: "pointer", fontSize: 13, display: "flex", gap: 10, alignItems: "center"
                }}
              >
                🖼️ גלריית תמונות ({photoCount})
              </button>
            )}

            <button 
              onClick={() => { onContinuousCamera(); onToggle(); }}
              style={{ 
                width: "100%", textAlign: "right", padding: "12px 16px", border: "none", 
                background: "#f0f9ff", cursor: "pointer", fontSize: 13, display: "flex", gap: 10, alignItems: "center", color: "#0369a1", fontWeight: 700
              }}
            >
              📸 צילום רציף (מהיר)
            </button>

            <label style={{ 
              width: "100%", textAlign: "right", padding: "12px 16px", cursor: "pointer", 
              fontSize: 13, display: "flex", gap: 10, alignItems: "center", borderTop: "1px solid #f1f5f9"
            }}>
              📷 צילום בודד (מצלמה)
              <input 
                type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.length > 0) { onUpload(e.target.files); onToggle(); e.target.value = ""; } }}
              />
            </label>

            <label style={{ 
              width: "100%", textAlign: "right", padding: "12px 16px", cursor: "pointer", 
              fontSize: 13, display: "flex", gap: 10, alignItems: "center", borderTop: "1px solid #f1f5f9"
            }}>
              📁 בחר מהגלריה
              <input 
                type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.length > 0) { onUpload(e.target.files); onToggle(); e.target.value = ""; } }}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
