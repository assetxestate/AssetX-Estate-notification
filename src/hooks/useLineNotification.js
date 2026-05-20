import { useState, useCallback } from "react";
import { useRef, useEffect } from "react";
import { APPS_SCRIPT_URL } from "../lib/config.js";

export function useLineNotification(targetUserId) {
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);

  // useRef เพื่อให้จับ targetUserId ล่าสุดเสมอ ป้องกัน stale closure
  const targetUserIdRef = useRef(targetUserId);
  useEffect(() => {
    targetUserIdRef.current = targetUserId;
  }, [targetUserId]);

  const addLog = useCallback((type, message) => {
    const now = new Date().toLocaleTimeString("th-TH");
    setLogs(prev => [...prev.slice(-19), { type, message, time: now }]);
  }, []);

  const sendNotification = useCallback(async (message, type = "payment", targetName = "") => {
    const currentId = targetUserIdRef.current;
    setSending(true);
    addLog("info", `กำลังส่งข้อความ${targetName ? " ถึง " + targetName : ""}...`);
    try {
      const did = currentId && currentId.trim() ? currentId.trim() : "";
      const url = did ? `${APPS_SCRIPT_URL}?dest=${encodeURIComponent(did)}` : APPS_SCRIPT_URL;
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendLine", message, type }),
      });
      addLog("success", `✅ ส่งสำเร็จ${targetName ? " → " + targetName : ""}${currentId ? " [" + currentId.substring(0,8) + "...]" : ""}`);
      setSending(false);
      return { success: true };
    } catch (error) {
      addLog("error", `❌ ล้มเหลว: ${error.message}`);
      setSending(false);
      return { success: false, error: error.message };
    }
  }, [addLog]);

  const testConnection = useCallback(async () => {
    setSending(true);
    addLog("info", "กำลังทดสอบการเชื่อมต่อ...");
    try {
      const response = await fetch(APPS_SCRIPT_URL);
      if (response.ok) {
        addLog("success", "✅ เชื่อมต่อ API สำเร็จ");
      } else {
        addLog("error", `❌ HTTP Error: ${response.status}`);
      }
    } catch (error) {
      addLog("error", `❌ ไม่สามารถเชื่อมต่อ: ${error.message}`);
    }
    setSending(false);
  }, [addLog]);

  const sendTestMessage = useCallback(async () => {
    const testMsg = `🧪 ทดสอบระบบแจ้งเตือน\n\nจาก: AssetX Dashboard\nเวลา: ${new Date().toLocaleString("th-TH")}\n\n✅ ระบบทำงานปกติ`;
    return sendNotification(testMsg, "test", "ทดสอบ");
  }, [sendNotification]);

  return { sending, logs, sendNotification, testConnection, sendTestMessage, addLog };
}
