import { useState, useCallback } from "react";
import { useRef, useEffect } from "react";
import { checkLineConnection, sendLineMessage } from "../lib/lineDelivery.js";

export function useLineNotification(targetUserId) {
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(null);

  // useRef เพื่อให้จับ targetUserId ล่าสุดเสมอ ป้องกัน stale closure
  const targetUserIdRef = useRef(targetUserId);
  useEffect(() => {
    targetUserIdRef.current = targetUserId;
    setConnectionStatus(null);
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
      const result = await sendLineMessage(currentId, message);
      addLog("success", `✅ LINE รับคำขอแล้ว${targetName ? " → " + targetName : ""}${currentId ? " [" + currentId.substring(0,8) + "...]" : ""}${result.requestId ? " (คำขอ " + result.requestId + ")" : ""}`);
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
      await checkLineConnection(targetUserIdRef.current);
      setConnectionStatus(true);
      addLog("success", targetUserIdRef.current ? "✅ LINE API และ UID ผู้รับพร้อมใช้งาน" : "✅ LINE API เชื่อมต่อสำเร็จ (ยังไม่เลือก UID ผู้รับ)");
    } catch (error) {
      setConnectionStatus(false);
      addLog("error", `❌ ไม่สามารถเชื่อมต่อ: ${error.message}`);
    }
    setSending(false);
  }, [addLog]);

  const sendTestMessage = useCallback(async () => {
    const testMsg = `🧪 ทดสอบระบบแจ้งเตือน\n\nจาก: AssetX Dashboard\nเวลา: ${new Date().toLocaleString("th-TH")}\n\n✅ ระบบทำงานปกติ`;
    return sendNotification(testMsg, "test", "ทดสอบ");
  }, [sendNotification]);

  return { sending, logs, connectionStatus, sendNotification, testConnection, sendTestMessage, addLog };
}
