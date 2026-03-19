import React, { useState, useRef, useEffect } from "react";

const BRAND = {
  teal: "#2DD4BF",
  bg: "#050B18",
  bgCard: "#080F1E",
  bgGlass: "rgba(8,15,30,0.92)",
  border: "#0F2545",
  borderLt: "#162E56",
  textPri: "#F0F6FF",
  textSec: "#64748B",
  purple: "#7C3AED",
};

const QUICK_QUESTIONS = [
  "สรุปภาพรวมพอร์ตโฟลิโอทั้งหมด",
  "งวดชำระที่ใกล้ครบกำหนดใน 30 วัน มีอะไรบ้าง?",
  "เงินต้นและดอกเบี้ยรวมทั้งหมดเท่าไร?",
  "ลูกค้าประเภทขายฝากมีกี่ราย?",
  "สัญญาใดครบกำหนดเร็วที่สุด?",
];

function MarkdownText({ text }) {
  const lines = text.split("\n");
  return (
    <div style={{ lineHeight: 1.7 }}>
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return <div key={i} style={{ fontWeight: 700, color: BRAND.teal, marginTop: 8 }}>{line.slice(4)}</div>;
        if (line.startsWith("## "))
          return <div key={i} style={{ fontWeight: 700, color: BRAND.teal, fontSize: 15, marginTop: 10 }}>{line.slice(3)}</div>;
        if (line.startsWith("# "))
          return <div key={i} style={{ fontWeight: 700, color: BRAND.textPri, fontSize: 16, marginTop: 10 }}>{line.slice(2)}</div>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return <div key={i} style={{ paddingLeft: 12 }}>• {line.slice(2)}</div>;
        if (/^\d+\./.test(line))
          return <div key={i} style={{ paddingLeft: 12 }}>{line}</div>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <div key={i} style={{ fontWeight: 700 }}>{line.slice(2, -2)}</div>;
        if (line === "")
          return <div key={i} style={{ height: 6 }} />;
        return <div key={i}>{line}</div>;
      })}
    </div>
  );
}

export default function ChatPanel({ customerData }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [apiError, setApiError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamText]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    setInput("");
    setApiError(null);
    const newMessages = [...messages, { role: "user", content: question }];
    setMessages(newMessages);
    setLoading(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          customerData,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "เกิดข้อผิดพลาด" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const { text } = JSON.parse(data);
              fullText += text;
              setStreamText(fullText);
            } catch {}
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullText },
      ]);
      setStreamText("");
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamText("");
    setApiError(null);
  };

  return (
    <>
      {/* ปุ่มเปิด Chat */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="คุยกับ Claude AI"
        style={{
          position: "fixed",
          bottom: 88,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${BRAND.teal}, ${BRAND.purple})`,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          boxShadow: `0 4px 20px rgba(45,212,191,0.4)`,
          zIndex: 300,
          transition: "transform 0.2s",
          transform: open ? "rotate(45deg) scale(1.1)" : "scale(1)",
        }}
      >
        {open ? "✕" : "✦"}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 152,
            right: 16,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            height: 520,
            maxHeight: "calc(100vh - 180px)",
            background: BRAND.bgGlass,
            border: `1px solid rgba(45,212,191,0.2)`,
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            zIndex: 299,
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid rgba(45,212,191,0.15)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <div>
                <div style={{ color: BRAND.textPri, fontWeight: 700, fontSize: 14 }}>
                  Gemini AI Assistant
                </div>
                <div style={{ color: BRAND.teal, fontSize: 11 }}>
                  รู้ข้อมูลลูกค้าทั้งหมด {customerData?.length || 0} ราย
                </div>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${BRAND.border}`,
                  borderRadius: 8,
                  color: BRAND.textSec,
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                ล้าง
              </button>
            )}
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 && !loading && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: BRAND.textSec, fontSize: 12, marginBottom: 10, textAlign: "center" }}>
                  ถามอะไรก็ได้เกี่ยวกับข้อมูลในระบบ
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      style={{
                        background: "rgba(45,212,191,0.05)",
                        border: `1px solid rgba(45,212,191,0.2)`,
                        borderRadius: 10,
                        color: BRAND.textPri,
                        fontSize: 12,
                        padding: "8px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                        lineHeight: 1.4,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(45,212,191,0.1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "rgba(45,212,191,0.05)"}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "9px 13px",
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background:
                      m.role === "user"
                        ? `linear-gradient(135deg, rgba(45,212,191,0.25), rgba(124,58,237,0.2))`
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${m.role === "user" ? "rgba(45,212,191,0.3)" : BRAND.border}`,
                    color: BRAND.textPri,
                    fontSize: 13,
                  }}
                >
                  {m.role === "assistant" ? (
                    <MarkdownText text={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {/* Streaming */}
            {loading && streamText && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "9px 13px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${BRAND.border}`,
                    color: BRAND.textPri,
                    fontSize: 13,
                  }}
                >
                  <MarkdownText text={streamText} />
                  <span
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 14,
                      background: BRAND.teal,
                      marginLeft: 2,
                      borderRadius: 2,
                      animation: "blink 0.8s step-end infinite",
                      verticalAlign: "middle",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Loading dots */}
            {loading && !streamText && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${BRAND.border}`,
                    display: "flex",
                    gap: 5,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: BRAND.teal,
                        display: "inline-block",
                        animation: `bounce 1s ${d * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {apiError && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#FCA5A5",
                  fontSize: 12,
                }}
              >
                ⚠️ {apiError}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: `1px solid rgba(45,212,191,0.15)`,
              display: "flex",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="ถามเกี่ยวกับข้อมูลในระบบ..."
              disabled={loading}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid rgba(45,212,191,0.2)`,
                borderRadius: 10,
                color: BRAND.textPri,
                fontSize: 13,
                padding: "9px 12px",
                outline: "none",
                fontFamily: "Sarabun, sans-serif",
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background:
                  loading || !input.trim()
                    ? "rgba(45,212,191,0.15)"
                    : `linear-gradient(135deg, ${BRAND.teal}, ${BRAND.purple})`,
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                color: "#fff",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}
