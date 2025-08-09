import React from "react";

export default function ARButton({ onClick }) {
  return (
    <>
      <button
        onClick={onClick}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translate(-50%, 0)",
          bottom: "calc(24px + env(safe-area-inset-bottom))",
          background: "linear-gradient(180deg, #ffffff 0%, #f3f3f3 100%)",
          color: "#111",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 50,
          padding: "12px 20px",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          boxShadow:
            "0 10px 24px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.05)",
          zIndex: 1200,
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 140,
          justifyContent: "center",
          overflow: "hidden",
          willChange: "transform, box-shadow",
          WebkitTapHighlightColor: "transparent",
          animation: "slideUpIn 280ms ease-out both, arButtonPulse 2s infinite 280ms",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translate(-50%, -2px)";
          el.style.boxShadow =
            "0 12px 28px rgba(0,0,0,0.24), 0 4px 10px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 0 rgba(0,0,0,0.06)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translate(-50%, 0)";
          el.style.boxShadow =
            "0 10px 24px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.05)";
        }}
        onMouseDown={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translate(-50%, 1px)";
          el.style.boxShadow =
            "0 6px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.06)";
          el.style.background = "linear-gradient(180deg, #f7f7f7 0%, #ececec 100%)";
        }}
        onMouseUp={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translate(-50%, 0)";
          el.style.boxShadow =
            "0 10px 24px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.05)";
          el.style.background = "linear-gradient(180deg, #ffffff 0%, #f3f3f3 100%)";
        }}
      >
        {/* 하이라이트 */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: "55%",
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0))",
            borderTopLeftRadius: 50,
            borderTopRightRadius: 50,
            pointerEvents: "none",
          }}
        />
        <span style={{ fontSize: 16 }}>📷</span>
        <span>AR 모드</span>
      </button>

      {/* 버튼 전용 keyframes */}
      <style jsx>{`
        @keyframes slideUpIn {
          0% { transform: translate(-50%, 16px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes arButtonPulse {
          0% { box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 4px 25px rgba(102,126,234,0.4); }
          100% { box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        }
      `}</style>
    </>
  );
}