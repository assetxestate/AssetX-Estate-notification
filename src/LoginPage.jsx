import React, { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        onLogin(remember);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <img src="/logo.jpg" alt="AssetX Logo" style={styles.logo} />

        <h2 style={styles.title}>AssetX Estate Co., Ltd.</h2>
        <p style={styles.subtitle}>ระบบจัดการอสังหาริมทรัพย์</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>ชื่อผู้ใช้</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="กรอกชื่อผู้ใช้"
              style={styles.input}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>รหัสผ่าน</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="กรอกรหัสผ่าน"
                style={{ ...styles.input, paddingRight: "44px" }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: "15px", height: "15px", cursor: "pointer" }}
            />
            จำฉันไว้ในเครื่องนี้
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{ ...styles.submitBtn, ...(submitting ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
            disabled={submitting}
          >
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', 'Noto Sans Thai', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
  },
  logo: {
    width: "120px",
    height: "120px",
    objectFit: "contain",
    marginBottom: "16px",
  },
  title: {
    margin: "0 0 4px",
    fontSize: "20px",
    fontWeight: "700",
    color: "#1a2e5a",
    textAlign: "center",
  },
  subtitle: {
    margin: "0 0 32px",
    fontSize: "14px",
    color: "#6b7280",
    textAlign: "center",
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: "15px",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  eyeBtn: {
    position: "absolute",
    right: "10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px",
    lineHeight: 1,
  },
  error: {
    margin: "0",
    fontSize: "13px",
    color: "#dc2626",
    textAlign: "center",
    backgroundColor: "#fef2f2",
    padding: "8px 12px",
    borderRadius: "6px",
  },
  submitBtn: {
    marginTop: "8px",
    padding: "12px",
    fontSize: "16px",
    fontWeight: "700",
    color: "#ffffff",
    background: "linear-gradient(135deg, #4facfe 0%, #6c63ff 100%)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
};
