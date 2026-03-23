import React, { useState, useEffect, useMemo, useCallback } from "react";
import ChatPanel from "./ChatPanel.jsx";
import ValuationPage from "./ValuationPage.jsx";
import MapView from "./MapView.jsx";

// ============================================================
// 🔧 ตั้งค่า: วาง URL จาก Google Apps Script ตรงนี้
// ============================================================
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwffNV4dVrSqlsET5-OHDitOc7iL_PW4qU-d8amXJH1mHElOWyQS8ya_R5YgpW7DWyI8g/exec";
const IMGBB_KEY = "c83de7744f238eb8f1d0e87efb8bc639";
// Album ID ตามเดือน (CE year-month → album ID)
const IMGBB_ALBUMS = {
  "2026-3":  "k5zwF3",
  "2026-4":  "FHR9kk",
  "2026-5":  "wBhbzx",
  "2026-6":  "tqx66x",
  "2026-7":  "BqqfBk",
  "2026-8":  "jP0hTG",
  "2026-9":  "31WZ3s",
  "2026-10": "xmZXwy",
  "2026-11": "KxKbwv",
  "2026-12": "r20fDp",
};

// ============================================================
// 📦 ข้อมูลจริงจาก Google Sheet (ใช้ระหว่างทดสอบ UI)
// ============================================================
const MOCK_DATA = [{"id":"1","name":"นภาพร","fullLabel":"จำนอง คุณ นภาพร","type":"จำนอง","color":"#60A5FA","icon":"🏠","principal":3500000,"amount":280000,"freq":"ปีละครั้ง","location":"13.45453042,99.99354528","contractEndDate":"2027-11-20","deeds":"[{\"no\": \"1377\", \"area\": \"0-0-60 ไร่\", \"tambon\": \"ท่าคา\", \"amphoe\": \"อัมพวา\", \"province\": \"สมุทรสงคราม\", \"surveyPage\": \"2101\", \"landNo\": \"28656\", \"mapRef\": \"4935 I 0686\"}]","payments":[{"installment":1,"dateStr":"2026-11-20"}]},{"id":"2","name":"กนกพร","fullLabel":"จำนอง คุณ กนกพร","type":"จำนอง","color":"#A78BFA","icon":"🏠","principal":1500000,"amount":120000,"freq":"ปีละครั้ง","location":"13.48983163,100.03190800","contractEndDate":"2029-11-17","deeds":"[{\"no\": \"20285\", \"area\": \"3-3-45 ไร่\", \"tambon\": \"นางตะเคียน\", \"amphoe\": \"เมืองสุมุรสงคราม\", \"province\": \"สมุทรสงคราม\", \"surveyPage\": \"1418\", \"landNo\": \"96\", \"mapRef\": \"5035 IV 1290\"}, {\"no\": \"40821\", \"area\": \"5-2-95 ไร่\", \"tambon\": \"นางตะเคียน\", \"amphoe\": \"เมืองสุมุรสงคราม\", \"province\": \"สมุทรสงคราม\", \"surveyPage\": \"2633\", \"landNo\": \"254\", \"mapRef\": \"5035 IV 1090\"}]","payments":[{"installment":1,"dateStr":"2026-11-17"}]},{"id":"3","name":"อธิภัทร","fullLabel":"จำนองโกดัง คุณอธิภัทร","type":"จำนอง","color":"#34D399","icon":"🏭","principal":1600000,"amount":20000,"freq":"รายเดือน","location":"13.53996711,99.81356944","contractEndDate":"2027-01-09","deeds":"[{\"no\": \"20031\", \"area\": \"0-0-27.7 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7522\", \"landNo\": \"246\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"420032\", \"area\": \"0-0-5.9 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7523\", \"landNo\": \"251\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39726\", \"area\": \"0-0-16.9 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7529\", \"landNo\": \"250\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39727\", \"area\": \"0-0-22.8 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7530\", \"landNo\": \"249\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39728\", \"area\": \"0-0-22.8 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7532\", \"landNo\": \"248\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39729\", \"area\": \"0-0-22.9 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7533\", \"landNo\": \"247\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39730\", \"area\": \"0-0-7.9 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7534\", \"landNo\": \"256\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39731\", \"area\": \"0-0-22.6 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7535\", \"landNo\": \"255\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39732\", \"area\": \"0-0-22.6 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7536\", \"landNo\": \"254\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39733\", \"area\": \"0-0-22.7 ไร่\", \"tambon\": \"\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7538\", \"landNo\": \"253\", \"mapRef\": \"4936 II 8896-09\"}, {\"no\": \"39734\", \"area\": \"0-0-22.7 ไร่\", \"tambon\": \"หน้าเมือง\", \"amphoe\": \"เมืองราชบุรี\", \"province\": \"ราชบุรี\", \"surveyPage\": \"7539\", \"landNo\": \"252\", \"mapRef\": \"4936 II 8896-09\"}]","payments":[{"installment":1,"dateStr":"2026-04-09"},{"installment":2,"dateStr":"2026-05-09"},{"installment":3,"dateStr":"2026-06-09"},{"installment":4,"dateStr":"2026-07-09"},{"installment":5,"dateStr":"2026-08-09"},{"installment":6,"dateStr":"2026-09-09"},{"installment":7,"dateStr":"2026-10-09"},{"installment":8,"dateStr":"2026-11-09"},{"installment":9,"dateStr":"2026-12-09"},{"installment":10,"dateStr":"2027-01-09"}]},{"id":"4","name":"บังอร","fullLabel":"ขายฝาก คุณบังอร (นนทบุรี)","type":"ขายฝาก","color":"#F59E0B","icon":"📋","principal":8000000,"amount":50000,"freq":"ทุก 2 สัปดาห์","location":"13.85946452,100.42959685","contractEndDate":"2027-01-19","deeds":"[{\"no\": \"133153\", \"area\": \"0-1-75.4 ไร่\", \"tambon\": \"บางเลน\", \"amphoe\": \"บางใหญ่\", \"province\": \"นนทบุรี\", \"surveyPage\": \"521\", \"landNo\": \"20\", \"mapRef\": \"5036 I 5432-14\"}, {\"no\": \"133154\", \"area\": \"0-1-34 ไร่\", \"tambon\": \"บางเลน\", \"amphoe\": \"บางใหญ่\", \"province\": \"นนทบุรี\", \"surveyPage\": \"2220\", \"landNo\": \"19\", \"mapRef\": \"5036 I 5432-14\"}, {\"no\": \"133155\", \"area\": \"0-3-85.6 ไร่\", \"tambon\": \"บางเลน\", \"amphoe\": \"บางใหญ่\", \"province\": \"นนทบุรี\", \"surveyPage\": \"1658\", \"landNo\": \"21\", \"mapRef\": \"5036 I 5432-14\"}]","payments":[{"installment":1,"dateStr":"2026-05-03"},{"installment":2,"dateStr":"2026-05-19"},{"installment":3,"dateStr":"2026-06-03"},{"installment":4,"dateStr":"2026-06-19"},{"installment":5,"dateStr":"2026-07-03"},{"installment":6,"dateStr":"2026-07-19"},{"installment":7,"dateStr":"2026-08-03"},{"installment":8,"dateStr":"2026-08-19"},{"installment":9,"dateStr":"2026-09-03"},{"installment":10,"dateStr":"2026-09-19"},{"installment":11,"dateStr":"2026-10-03"},{"installment":12,"dateStr":"2026-10-19"},{"installment":13,"dateStr":"2026-11-03"},{"installment":14,"dateStr":"2026-11-19"},{"installment":15,"dateStr":"2026-12-03"},{"installment":16,"dateStr":"2026-12-19"},{"installment":17,"dateStr":"2027-01-03"},{"installment":18,"dateStr":"2027-01-19"}]},{"id":"5","name":"กิตติ์","fullLabel":"ขายฝาก คุณกิตติ์หทัย (Centro นนทบุรี)","type":"ขายฝาก","color":"#F97316","icon":"🏘️","principal":6000000,"amount":75000,"freq":"รายเดือน","location":"13.68942957,100.35247480","contractEndDate":"2027-02-06","deeds":"[{\"no\": \"43603\", \"area\": \"0-0-60.2 ไร่\", \"tambon\": \"หนองแขม\", \"amphoe\": \"หนองแขม\", \"province\": \"กรุงเทพมหานคร\", \"surveyPage\": \"41013\", \"landNo\": \"835\", \"mapRef\": \"5036 II 4612-06\"}]","payments":[{"installment":1,"dateStr":"2026-05-06"},{"installment":2,"dateStr":"2026-06-06"},{"installment":3,"dateStr":"2026-07-06"},{"installment":4,"dateStr":"2026-08-06"},{"installment":5,"dateStr":"2026-09-06"},{"installment":6,"dateStr":"2026-10-06"},{"installment":7,"dateStr":"2026-11-06"},{"installment":8,"dateStr":"2026-12-06"},{"installment":9,"dateStr":"2027-01-06"},{"installment":10,"dateStr":"2027-02-06"}]},{"id":"6","name":"สริตา","fullLabel":"ขายฝาก คุณสริตา (ที่ดินชะอำ)","type":"ขายฝาก","color":"#EC4899","icon":"🌾","principal":1000000,"amount":12500,"freq":"รายเดือน","location":"12.84285321,99.99868405","contractEndDate":"2027-02-25","deeds":"[{\"no\": \"16379\", \"area\": \"0-1-45 ไร่\", \"tambon\": \"บางเก่า\", \"amphoe\": \"ชะอำ\", \"province\": \"เพชรบุรี\", \"surveyPage\": \"801\", \"landNo\": \"118\", \"mapRef\": \"4934 I 0818-02\"}]","payments":[{"installment":1,"dateStr":"2026-05-25"},{"installment":2,"dateStr":"2026-06-25"},{"installment":3,"dateStr":"2026-07-25"},{"installment":4,"dateStr":"2026-08-25"},{"installment":5,"dateStr":"2026-09-25"},{"installment":6,"dateStr":"2026-10-25"},{"installment":7,"dateStr":"2026-11-25"},{"installment":8,"dateStr":"2026-12-25"},{"installment":9,"dateStr":"2027-01-25"},{"installment":10,"dateStr":"2027-02-25"}]},{"id":"7","name":"ชลากร","fullLabel":"ขายฝาก คุณชลากร (ที่ดินประจวบ)","type":"ขายฝาก","color":"#14B8A6","icon":"🌴","principal":2000000,"amount":25000,"freq":"รายเดือน","location":"11.82645488,99.78887798","contractEndDate":"2027-03-06","deeds":"[{\"no\": \"66384\", \"area\": \"2-1-40.9 ไร่\", \"tambon\": \"เกาะหลัก\", \"amphoe\": \"เมือง\", \"province\": \"ประจวบคีรีขันธ์\", \"surveyPage\": \"22489\", \"landNo\": \"613\", \"mapRef\": \"4932 I 8606-00\"}]","payments":[{"installment":1,"dateStr":"2026-06-06"},{"installment":2,"dateStr":"2026-07-06"},{"installment":3,"dateStr":"2026-08-06"},{"installment":4,"dateStr":"2026-09-06"},{"installment":5,"dateStr":"2026-10-06"},{"installment":6,"dateStr":"2026-11-06"},{"installment":7,"dateStr":"2026-12-06"},{"installment":8,"dateStr":"2027-01-06"},{"installment":9,"dateStr":"2027-02-06"},{"installment":10,"dateStr":"2027-03-06"}]}];

// 🖼️ โลโก้บริษัท: ใส่ Base64 หรือ URL ของโลโก้ตรงนี้
// วิธีที่ 1: ใช้ Base64 (แนะนำ) - แปลงรูปที่ https://www.base64-image.de/
// วิธีที่ 2: ใช้ URL รูปภาพโดยตรง
const LOGO_CONFIG = {
  type: "base64", // ← เปลี่ยนเป็น base64
  base64: `/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIbGNtcwIQAABtbnRyUkdCIFhZWiAH4gADABQACQAOAB1hY3NwTVNGVAAAAABzYXdzY3RybAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWhhbmSdkQA9QICwPUB0LIGepSKOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAABxjcHJ0AAABDAAAAAx3dHB0AAABGAAAABRyWFlaAAABLAAAABRnWFlaAAABQAAAABRiWFlaAAABVAAAABRyVFJDAAABaAAAAGBnVFJDAAABaAAAAGBiVFJDAAABaAAAAGBkZXNjAAAAAAAAAAV1UkdCAAAAAAAAAAAAAAAAdGV4dAAAAABDQzAAWFlaIAAAAAAAAPNUAAEAAAABFslYWVogAAAAAAAAb6AAADjyAAADj1hZWiAAAAAAAABilgAAt4kAABjaWFlaIAAAAAAAACSgAAAPhQAAtsRjdXJ2AAAAAAAAACoAAAB8APgBnAJ1A4MEyQZOCBIKGAxiDvQRzxT2GGocLiBDJKwpai5+M+s5sz/WRldNNlR2XBdkHWyGdVZ+jYgskjacq6eMstu+mcrH12Xkd/H5////2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAUABQADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD+/iiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiikJA6kD6kD+dAm0t2l66C0Um5fUfmKMj1H5inZ9n/AF/w6+8LruvvQtFJkeo/MUZHqPzFFn2f9f8ADr7wuu6+9C0UmR6j8xRkeo/MUWfZ/wBf8OvvC67r70LRSZHqPzFGR6j8xRZ9n/X/AA6+8LruvvQtFJkeo/MUZHqPzFFn2f8AX/Dr7wuu6+9C0UmR6j8xRkeo/MUWfZ/1/wAOvvC67r70LRSZHqPzFGR6j8xRZ9n/AF/w6+8LruvvQtFJkeo/MUZHqPzFFn2f9f8ADr7wuu6+9C0UmR6j8xRkeo/MUWfZ/wBf8OvvC67r70LRSZHqPzFGR6j8xRZ9n/X/AA6+8LruvvQtFJkeo/MUZHqPzFFn2f8AX/Dr7wuu6+9C0UmR6j8xRkeo/MUWfZ/1/wAOvvC67r70LRSZHqPzFGR6j8xRZ9n/AF/w6+8LruvvQtFIWUdWUfUijcuM7hj1yMfnSBNN2TTfZNN/cLRRRQMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACikLKOrAfUgfzpN6f31/76H+NFm9UrruJyinZySfZtX+4dRSZHqPzFGR6j8xTs+z/r/h194XXdfehaKTI9R+YoyPUfmKLPs/6/4dfeF13X3oWikyPUfmKMj1H5iiz7P+v+HX3hdd196FopMj1H5ijI9R+Yos+z/r/h194XXdfehaKTI9R+YoyPUfmKLPs/6/4dfeF13X3oWikyPUfmKMj1H5iiz7P+v+HX3hdd196FopMj1H5ijI9R+Yos+z/r/h194XXdfehaKTI9R+YoyPUfmKLPs/6/4dfeF13X3oWikyPUfmKMj1H5iiz7P+v+HX3hdd196FopMj1H5ijI9R+Yos+z/r/h194XXdfehaKTI9R+YoyPUfmKLPs/6/4dfeF13X3oWikyPUfmKMj1H5iiz7P+v+HX3hdd196FopMj1H5ijI9R+Yos+z/r/h194XXdfehaKQMp6EH6EH+VLSBNPVNNd07hRRRQMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiikbofof5UAVORs7nn9cf0NeDftA6B8Rta8DTz/AAu1650LxXpWdRs7UBfL1rajOdFlZiNgbGA3IDADvmveeuzAwMnPfHf9SKY4WXfEw4OecZ7Y9eeM/jmujC1lhMVDGWUoxak1JXTSklJNK+jVlom/tLXbyc1y/wDtbA5lgVKUJVIuKlCXLJScfdaldWadrPv5XP58rz9q39o+xvbnT77x/c2tzaXv2C9tLyx0MHTz69PbjgflVX/hrv8AaG/6KPqX/gDon+FfZX7av7NH9pWo+LXgiBv7Rtlz4v0q1AX+0tJy+dY4PMkSICc4LJhvm2yEflXX9N8LQ4W4kwSxWEyWjzRSU4uMZcsrR5kk1ftbTVaq6sf5jeJD8SvDriV5PjOLOLFTm3KlJcRtRlFyunF6bLpd2Wj1R9Ff8Nd/tDf9FH1L/wAAdE/wo/4a7/aG/wCij6l/4A6J/hXzrRX0H+qeR9clp9PsLy/y/B+R8D/xEbj7/oreK15f6zvy8/L8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BfXd3djAAwAABwBjA4HQDA6V+r+HfBjzjGxznMIzWTUp3tK9pySi1e7bcFK11opSjrompfyp9IjxrpcE4B8L5HJVM8rq0qkGm+HYyW8mt5yT+523M2ae4vprm4nuPtVxd/8AH7eXmPbv29TzioqKK/piMYxSjFJRSSSVkrLbbToj/OSc51JyqTk5zqNynJttybd22223rruwooopkhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUJX2De7WqW77evb5hX0D+zX8BNX+N3jYW9xBc2vgrw+Re+JdW4BZjk/wBgD1OAWOBwAxPANecfC34Z6/8AFPxfpvhDw7B/pN3/AMf15gnS9P0nP/IcAAJLE4AAySThRyK/oS+Ffwy8NfCfwhpvhHw/bFbe1QG8umUf2jfak4QPqspywaSRgSTjCgrjcFbf+a+I/GceHsEsvwD/AOFqonzSjZqCaV5O6a5tlFatvW1k2v6M+j74OS44zmOf55GSyTIZRcHayqSupKKuknqnfey9Un32gaFpHhzR9N8P6HYWul6bpVmLGys7PGLAYxheeB/Fk854zjAG9RViv5alKU25Sbcm2227u7d3r6n+nNOnCnThThGMYQgoxjFJJRSSSSWiVlsFFFFIsKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoooPII9aAM+4EEyqrMw54YEg5yDyRjOOMc/hXzx+0H8CtI+N3gs+H737PbazZZvfDerNy+naqAdsi92BGARgk5yMYOfomePLLk8LjP1IJ4/z/hVXAZjdNuABwOMZHAHGPUeueK6cHicVgMVSxuDlyypuE1rqpK1rLRu65lJXSavtqeNm2T4HiPKM0yXO6cZ5TUi4yUrNpNbpu9nFWadm3ZKx/MN4j8OeIPB2u6l4Y8RafdaZrWk3v2C8s85HTOfTHcdevUVgV+3H7X37N1v8WdBPjHwtb48d+HrM/Yvsow2vaWCc6G2TgK3DIeMc5yCAPxDmguIJrm3nt/st1af8ftmevH4j/wCv07V/XfBXGWE4twMcTU5Y1oRjGrCDTalZXavZtOzcXa7Sd7O6X+VHi34X43w74lqYVJvIXJvhadm1ZtO0mk1dPe+l/J6yUUUV9Yfk+vXfr6/8P3CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooWrS7gnZp9ncK6nwH4/8AEHw58Vab4w8OXH+k2g/03/qIdv7C9/w965aioxuDhj4PL5pODTUuZK1mldW1W2n/AAx0YHG47L8whmGAk4yi4u6bT92UdL+W/a3Q/or+C/xZ0D4y+ELPxHojvb3Kj7FeaUzKz6Lqqghlk4XLLkEkADbjAGGr3hUXzmYE5PbPA+Yjvn16/p2r+cL4FfF/V/gl4vttf0wXN1ol0RZeJdIwp+26WpyrruBAZTyCQcHtjiv6BvAPjjQPiJ4V0zxf4cv01LRtWslvrK7TgMvQEDqMcHoehGeuP5N484PqcOY9vCXlk9Wc+WXLdJu0uSTSt8SbT05kktZJt/6i+CXi1gvETJ44DGyUc8ySMY1IOVnOyS5or7rq1tXbseiUUUV8IfvYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABSHocdcHFLSE4H8vc+lAFAwphASRtJwM5JBP6DP16dq8a+KvxU8MfCDwhqfi3xBdEW9um21tVb/iZXupOJAmjoPumRmAUc44Yksqjf6D4s8VaF4O0DUfFHiC+tNM0fSrNry8vLxgqxgZG49TwAD8oJyeAFHH8/X7Q3xz1f4y+L7m/nN1a+E9KJsvDek4I+xaY3La9jJI8S5wFBY7V2oDhRX2PBnDGM4jx6b5llEHD2kuVrW8ZWUmlpu7e87NbXR+HeNfivgvDnJJQwclLOs7i4U43u4JK3PPV6qzsvd1WzVzgvil8Rdf8Ail4vuPF/iK44uhixs8ltL0/Se+hFiSxY9SxJJPLEk5rhaKK/rTB4TB4DAxwGBVklHS1ldW06WXnbp8n/AJd47G43PMfPMcwk5OcpN80ueT5tdW3d69G3v5hRRRXWlZJdlY8wKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiihWur/0uoJXaS1b2QVe8N6HrHirWNN8P6Hp91qmtare/YLK0s+mofjjjv9OKo1+yv7Hn7Mx+HekW3j/xfYMvjTX7QfZLO7Gf+ET0r5SsZyj58REN+8dQCMEbgFevk+NOMsHwjgXiopOrOLjCLernbTRa2T3au0kra6H6h4SeGGN8ROJaeVYNSWQpqXFU2naycX7smra7JX3fzPaP2bv2e9O+CHhYaeSLrxHq2L7xFq5VGa9ckgaV8zfdjGcYAON3JBGPqUBNhBJ2qcknuf179c/1qmFXet0pbBYg5H4dMdDzznNXTb7lcAnBwfTvk44OfQ/Sv5GzPGYrN8c8djajk5vnk7tNO8V5tKKdlG7SV9W7M/1d4f4fynhnJ8tyXJaap5VSiorq9ErttJXu9H1fz1ujkA+tFIOg+gpa5D2wooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKTaMEYGD14FLRQJpO677+fT8ikFVYSrYIYnIPTGDjI9+APSvyY/ba/ZmMM2p/F7wRp/+kA/b/GekWYwNRHzf8TvGSd64w/0yOuB+tTKHGD0z/KqdzawXEIglhFxDcAjJAYcjuDjjgHjHTvg172QZ9i+Hcwp47ByaV0pJP3ZRdtLLorXWl0+6uj4Hj3gTKePOHZ5Nj+VySbpTau4ztsmtU2106Pq0j+WWivs79rX9nCf4UeI/wDhMPCtgD4K1a8BNpZ7caFqjZ2aOgDMPLkwSpzngjqDXxjX9dZNm+BzzL4ZhgHdtRvtdSslJNX0aen/AAdT/J7ivhTOeA87zbJM5i1C79m2nZq6tyvZ3VrNb30XQKKKK9g+XCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooC7V7b9P0/EK+rP2VP2j9Q+DHir+yPEc9xdeA/EN2V1i1IBPh7VWKltbzgkI5VQ4HUAdwuPlOivJzfKMFneAnl+OV+ZPayd3tqtU09VZOzV91p9NwXxVm/B2dZTneSuSzVSTmtbciaclJbNOPRp6erP6iNL1aw1W0ttRsLi2u9Pu7NL61urVh/pnGSR/eyOcZJJ6nggbwImBPpnP4deo759AK/F39jf9p0+D9UtfhV411J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atCMktLqz55XVrapXk7aKX9DeCXhPLP8bHirPYf8I8WnThONueUWrLVaJNK7t5enYQ24t4BDEBlfX+HP/wCrirOB6Dnrx1pR0GKK/mxtyfNLWT1beru99fU/uuEYwjGMElGKSiklZJKytbyCiiigoKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCoRtXjsc/r16dcV498WvhV4W+M/gvU/Bnim3Fxp+qIfst2AialYamikxaxo7ndtaMuWVgQFBfIKkZ9kIzTMKCD69OOAfy9v60YXFSwcljsE5RnGSleLtJSTi738nutmnZpptPixmDwmPwc8BjYqUKkeWUWrqz0d00073010tffU/kx+Nfwl8X/BH4g6j4I8VQE3FoPt+iawf+QVr+ld9cII4IPDDqDwRxx5P5x9/yFf0x/tV/s1aP+0R8PrnSQttaeNNBzf8Ag7xEAo/s/VgHJ0lgIldtAl+VZUJI+6VwyPv/AJpPFPhzxB4I8Sal4Q8U6Pc6Xrfh+9+wXtnedNP69x2/x9a/q/gHiqPEWD5JO2dwSUldO6tH3kr6xffT3rpvS7/grxQ8McZwpnLqYBN5HNuSdtdXezfddb2117Wr+cff8hR5x9/yFZn2n3/z/wB80faff/P/AHzX6Dqt9+vqflv1by/r/wACNPzj7/kKPOPv+QrM+0+/+f8Avmj7T7/5/wC+aA+reX9f+BGn5x9/yFHnH3/IVmfaff8Az/3zR9p9/wDP/fNAfVvL+v8AwI0/OPv+Qo84+/5Csz7T7/5/75o+0+/+f++a5w+reX9f+BGn5x9/yFHnH3/IVmfaff8Az/3zR9p9/wDP/fNdAfVvL+v/AAI0/OPv+Qo84+/5Csz7T7/5/wC+aPtPv/n/AL5rnD6t5f1/4EafnH3/ACFHnH3/ACFZn2n3/wA/980faff/AD/3zQH1by/r/wACNPzj7/kKPOPv+QrM+0+/+f8Avmj7T7/5/wC+a6A+reX9f+BGn5x9/wAhR5x9/wAhWZ9p9/8AP/fNH2n3/wA/981zh9W8v6/8CNPzj7/kKPOPv+QrM+0+/wDn/vmj7T7/AOf++a6A+reX9f8AgRp+cff8hR5x9/yFZn2n3/z/AN80faff/P8A3zXOH1by/r/wI0/OPv8AkKPOPv8AkKzPtPv/AJ/75o+0+/8An/vmgFhrtK277/8A2xp+cff8hR5x9/yFZn2n3/z/AN816h8IfhN4m+N3jXTvBPhDT/tWo3Q/028HOl+H9J6DXNeAGWJPyqqgsxwFBJArPGYrBYHAvH49pRSesmkrWTu29LJX7eu52YLKsfjcfDBZcpObas4pyd21y6LV6vU/X7/gnF+0T4o8cWlz8IfEVhqOpDwpo6X/AIc8RuP+PLSSVVND15sjbKpCeW3zA42lSdjJ+s85PCsMr2Ibnj3B9/X9K8J+A/wJ8IfATwTa+CvC0JmPF9rOr3gB1XXdVIjL6xN8zDeW4ypATACkkEv7rGcAhGJxycjHfnGR+XXI79K/jbiXF4LM84zPG5fBRhOrJx5Vy6ybk5K1lHnd21a93zNKTaP9FeBstznKeGcpwWe5l7TN1CLk3qrWVoJ9Wl30WyvYvjoPoKWgcgH1orw1sr72Vz7MKQ9Dn0NLRTAowYAIVdoyQcnnj6+v16H3xX5d/wDBRb9ovxV8LPDunfDjwtY6npl/8QLHU0uvFxsD/Zy6WocPouhybzv8TSqyFV2qVA3ktvAT9PJlJTbOdrHPQDp6ce3PUc9eBXj/AMZvg34R+NvgfUPBHjWwNxbXSsbS8tExqWi6kFKx6zosjBnjkjY7gRyV3blOSF9TI8VgcJm+VY7Hx5oxnHmi48zaThLmSe7i0pLrpom0k/lOMctzbNuGs2wOSZnyZu6b5ZJW6L3L6tc0U1dWV9LpXP5RPOPv+Qo84+/5CvT/AI4fB/xP8CvGlx4Q8U2+Qc6housWY/4lWv6UDg64R2IOVIPIIIOK8d+0+/8An/vmv7QwWLwOMwEcbl7XJyrZqz0WqWzTWtr9fmv848blOYYHHywOYxlzpu7lFpuXMk7t673vt1NPzj7/AJCjzj7/AJCsz7T7/wCf++aPtPv/AJ/75rQ4vq3l/X/gRp+cff8AIUecff8AIVmfaff/AD/3zR9p9/8AP/fNdAfVvL+v/AjT84+/5Cjzj7/kKzPtPv8A5/75o+0+/wDn/vmgPq3l/X/gRp+cff8AIUecff8AIVmfaff/AD/3zR9p9/8AP/fNc4fVvL+v/AjT84+/5Cjzj7/kKzPtPv8A5/75o+0+/wDn/vmugPq3l/X/AIEafnH3/IUecff8hWZ9p9/8/wDfNH2n3/z/AN81zh9W8v6/8CNPzj7/AJCjzj7/AJCsz7T7/wCf++aPtPv/AJ/75oD6t5f1/wCBGn5x9/yFHnH3/IVmfaff/P8A3zR9p9/8/wDfNAfVvL+v/AjT84+/5Cjzj7/kKzPtPv8A5/75o+0+/wDn/vmugPq3l/X/AIEafnH3/IUecff8hWZ9p9/8/wDfNH2n3/z/AN81zh9W8v6/8CNPzj7/AJCjzj7/AJCsz7T7/wCf++aPtPv/AJ/75roD6t5f1/4EafnH3/IUecff8hWZ9p9/8/8AfNH2n3/z/wB81zrdW36B9W7p+fp/4EafnH3/ACFejfCv4deMPjD410XwB4Ot/tepaqObxQTpen6QP+Y7rwAJPToMkkjHpXm+g6XrHiPWNN8P+HNOutU1vVr37BZWdn/zENWA/wA56cV/SZ+yH+y1o/7PXgtLnVbe3u/iL4htAPFGrqAQCQxGjaMSRiJCucqclgDggYr4fj3imPDuCUE753NNRj5WV2030T1fey1dj9J8L/DDG8WZ0qk7rIotSlKS7crt87bXafXQ9q+BvwV8L/AvwJp3grw7AD9mU3er6o6/8TPXdVYKZNZlwTl5GGCOi7QoUnJf3QcjJ78/4fkMflQQD1GaWv5PxWJxeMxksbjXJucnKUpNylzSd3d3fkrWSio8q0sf39g8Fg8Bg4YDBRjGEYqKilZaWXkkrJ663bu7t62KKKKDsSskuysFFFFAwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCm2fKGDzuI+ox0Psen/6q/ML9vb9kJvi14fuPiP4D08n4keH7M/6HZr/AMjbpfOYxiOPPiJAMRyHO4dTnBb9QSAe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oooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/B3/AIKd/sVjXYdR/aO+FtgBrmlH7b8TPDlnaRkeIdNHmF/GYw7M00CRsXwMFVZlzsfb+Bv2n3/z/wB81/eRIolQgjgE4749cdf0znpzX8vH/BST9ii5+CHiq6+K3w00cf8ACqPFV7m+srI/8iB4rJIDkHBHhlgudvO05Uk4yf2vwx405JrIswa5XZU5SlbVbwd9PdS5o6u6UtFyty/HOOuFbt5zgYrRpzjGPdxvolt128z8vvtPv/n/AL5o+0+/+f8AvmsPz/b9P/r0ef7fp/8AXr99Wytt0PyX6q+7v203Nz7T7/5/75o+0+/+f++aw/P9v0/+vR5/t+n/ANegPqr7v8P8zc+0+/8An/vmj7T7/wCf++aw/P8Ab9P/AK9Hn+36f/XoD6q+7/D/ADNz7T7/AOf++aPtPv8A5/75rD8/2/T/AOvR5/t+n/16A+qvu/w/zNz7T7/5/wC+aPtPv/n/AL5rD8/2/T/69Hn+36f/AF6A+qvu/wAP8zc+0+/+f++aPtPv/n/vmsPz/b9P/r0ef7fp/wDXobSXM3otW+lvUawsr2XNftobn2n3/wA/981+7/8AwTk/YI/s86H8fvjRpAGpbhffD/whe2a509uCvjPXAWQGeVT+7XgKCHJBKhuB/wCCcn7AzeL5tM+P/wAZtPH/AAjhIvfAHhG9tdp11T/zHtcGx9/h85BiiICufvMABu/on2qAu0cAgDjsM9eCf8+wr8D8RfERzvkWRyagrxq1Iys9LKUIteV1KSknFKyfM24/rPBnBqVs6x6V38MXFLsk7Pps1pZ630snbAAAA7fhS0UV+Jro3v1fXvv6n7EkrJLaysFFFFAwoopDjBGQMg9aAKxwBySQfz+nGP8APtUTvb20ZdiEQKWOSckDJOMknp+tD8FQThV5Y9AB1OT0xyOTxX4Qf8FKf2+LrwjJqPwM+D+s48VXINh488WaNegHwfpR4fR9DIJDeKHGNi9EXk/McJ2YPC/W5K91ZX7u97JLzb67JWdr2R9l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lygY2lQ2HTM33NKQ5NuMqSFIJyFOOTgjjrnBz+Oa9qKTSSaaaTunpy+7e6676q+jTuf4v8QZBnPDOdZrkWe5XOjm+S1JU3CcXFytJq8bpcykleLi7OLUlq0aA6DPpRSDgDkdB/SlrnPOWy6BRRRQAzapOc9DyP8A9f8A+rjFfPvx/wDgB8N/2i/hvrXwz+JWkpqWiaoh+yXfyjU9D1QI5j1rRJfLZo/EEbMzqyjrnjBZX99qVslcgEeo7+mP89qjDYqWEksbg3KNSLUk4NqSaa1Wu/RrVOLcWnFtMtfR2s9NdrP+vlufxL+I/wDgmd8f9L/al0T9mqHTxqY8Qj7do/xHNmreFb74fglfEXjclSy7lYFG8IgsAwIBOOf63v2dvgJ4I/Zl+FXh34UfD23/AOJbpKg3mrXWDqniDVi5Gua5rr4XdJIQMrnAYKoA3Bm+gwANoxk84OO46/8A1qdX02fcZZ1xDhMswmOk1TpRWi+07RbnJpPVK/Kr2V23d8vLy4bCLCX0Tv3ttdeVk3167FiiiivnDqCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKOtJkeo/MUjFcHLAcHPI4o2128/T/IW90tX2/T5mRPEAHzChRRuLNIApJIJLNnACn3AJ4PNfz2f8FLf26n1u+139nn4Qawg0y0Y2PxM8XWN5zqDbQG8EaExZi3Qr444UxwbUI3cL7J/wUi/brXwFZal8Cfg9rCt4z1Uiz8feJbO9GfCWmFWzpGglSVPiVwwKDAK8E8lQv8APPXm4zF2vFNPv3+zfZ9ba9dbPs/9AfoofRzeMeWeI3HWVSceZS4U4VqXUptariOqmknCLalTg01opyu+Xlz6K0KK+e+teS/H/I/0njFQShFKMY6KMVZK2lklppYz6K0KKPrS7L8f8hmfRWhWfR9aXZfj/kAUVoUUfWl2X4/5AZ9FaFFH1m/Rfj/kB+2P/BEv/kfvjf8A9it4V/8AT34ir+h+14Rsf3R/6G1fzw/8EUf+SgfG3/sV/Cn/AKfPEdf0PWoOxuP4R/6G1fVYV3wEmu8bW9In+MP0sf8Ak+PFf+Hhz/1Q0i/gHqAfwpSMgj1GKKK6T+dLLsil5C4Clj6q2Tkdfx7HpX5Kf8FE/wBhyH4+aTcfEjwDpttafFzw9ZMA1moX/hK9Kj3A6G3G0a+yrmN+3G4kMu39a2HKqM8ZP556/TrTS+S+/O1srjHBDcYxk8c9foc9a6V2dpJrW613VrefX1vpZtH0/BnGWccBcR5XxNkVSVHNac4uSi3yThHlc4VUtJRlHRtq6tzJqUUfwUXmlahpV5c6Nqun3WlalpN79gvbS8s/+Jrp+rZ9Pz/pVWv6Gv8Agon+wrH400uf42fB2yH/AAmVk32rxNpFpaBm8VaaoLHVdFIyq+J0Ur5bE4ZcDp5bSfz618hmkXg3bVK+jta/Z+uvvK710vsf7QeDHi5k/i5w3HNspcIYmEYRr0XOLnCokuaNlaTi23yz5UpxaaSvYz6KK0K4vrS7L8T9iWnKtmvhS0t/h7fI9A+Dfxg8bfArx1ovxG8Eah9l1rSv+P2zvCRpXiDSc5/sPXiCGUj7wKkFWwQQRx/Xr+zH+0X4I/aY+HGneNPC9wLe7KfYfEujNdqdS8K6woj3aNKAhxIhAH3gCCCBkAL/ABlV7/8As2/tIeL/ANnD4jW/jbwtcG6067/0DxN4cu7wf2Z4t0v+HRFyCA6nlTg8jvXbhM0eFfLK7TaXW61W3lrZ+Wm6TX8r/SW8B8D4m5I8/wAhilxtkMW5qKSVaCV3TnZJTvG7jJv3Zd4ylCf9qwdeBz/n8acCCMjpXhXwV+NXg747+BNG8e+CdSGo6NqsYItywTU9P1MA79I1tSWCOhb5t2APlJJHFe5pnH48fTivp9Gk09XbS973V01b8t09HZn+QWNweNwGOqYDH0506lObhOEouMoyi7NSTSaa0d9U4vmV00y3RQOgz6UUiAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKRuh+h/lS5HqKQkYPIGBzzyPej+mD9bPo/PoY2y2WCD9y6qrHBByUx/EehIYnIz24B7H8p/8AgoV+25p/wL0efwB8OdStLn4veILBv9IByvhPSmDI2ud1OvIp/dR4HYkAKqn179ub9tHw9+zH4LbTNLns9W+K3iyyZfBvh3dnLAsp1rXArgx+HEJIZzhuyjPKfyoeKfFOveNvEeteLvF+r3Ou+I/EF4L7WNWuwAL/AFQDAAAx8o6AdMcYHWvDzTNvql8EneTT1umknZ6Pfmd9t13ve39ifRh+j5PjjHw404ppey4ew7hKlTnGUJcSVKck0uVpWpJ262m1onTtzYt5fahfXlzqF7qF1qmpate/b768vP8AkK6hq3PX+p+nrVbyV/zn/GpqK+L+tP8Amf3/AP23kvuP9YacIUoQhTioQpwUIRStyxSSUVbZJJK3kQ+Sv+c/40eSv+c/41NRR9a8/wAf/tiyHyV/zn/GjyV/zn/GpqKPrXn+P/2wEPkr/nP+NTUUUfWvP8f/ALYCHyV/zn/GjyV/zn/GpqKPrXn+P/2wEPkr/nP+NHkr/nP+NTUULE3aXNv5/wD2wH7Y/wDBE/8A5Hz45f8AYseFP/T54jr+iGD/AFa/7o/9Cav56P8Agih/yPnx0/7Frwp/6fPEtf0Lwf6tf90f+hNX3+Va4C/dL9T/ABo+ln/yfXir/r1w7/6ocOXqKKK9E/m4MDrjn1oOO/bnnt70UHkEetAFCSBCNpAKuCpGARznnBGCc56j8eeP54f+CkX7Dl3pWoa78e/hRo+7Tfm1D4l+E7OyGDjBPjbQ1wArAHd446+bEpc8o1f0RmEMCAc/591/CqV9Z219A1vcwC5Uqw5A4B4JyR9D6ZHrmufE4ZYyPK7NJb76/wAyst9LW2av1SPu/DHxEzvwu4lpZ5klScFCUfa04t+zq07pyhKOquk3yPeLd/h5oz/g2qHyV/zn/Gv1i/4KF/sKf8Ke1i4+Lvwm0jPw61e73eJdJs1K/wDCJankAOAQMeG+m9BjB7BcV+UdfBYyLwTad+yurK191dLy0snfS26P9tPDbxJ4b8VOGcp4myWS9tGKVanzL2lOooxUlUhFtqSd009H03RD5K/5z/jR5K/5z/jU1Fcn1nz/AB/+2Pue7vbvLt5v08z68/Y9/ay8X/steO/7QsDdal4D8QXp/wCEx8Ijk35PXXdBGRu8Rtgb0JwwGMggY/rW+HnxD8I/FPwfovjfwhq1rqnh7X7KO9tLyyYbcORlgeuD0ztHTt0r+G2vvr9hn9s7WP2Z/FX9g+KLi51P4Q+K7sjWdIIyvhHVcc6zonBJjY/eA6EBhkjFfQ5Vmn1b3JvfRO70bavre6j+rT3vf+JPpP8A0fKfGWClxfwnTUOMqScqtOMVGPE1OCTk1FK0asIr3ZNJOK5JO3K4/wBc3WiuU8O+JNH8V6Lpuv8Ah7ULPWtG1iwXUNK1SyYPp15p8mAMPnkZyAdvzYBwBkDqsj1Hr1HT1r69O+2t/nv6H+Wk4SpzlTqRcKkG4zjJOMoyi3GSalZqzTTTSaas9RaKKKCQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACg8gj1oooAyron7M+ONuM/iT/9avE/j348Pwo+EfxI+IsVk2qXXhnwxqes2ukJdlGvTHG0jBc8DcenBxuKjOBj3Cdd3nqeNyoQPcbWxz6DI+vNfIX7dkvkfsrfGcg8R+BNYBzxkG2I6emSfXrgH1rEy5cLPW1ouTflyQkn3VpRWvl20Pc4OwWEzjijhLA45c1OrxThaU4bqUKmIhGa6OzhJ9r7Jn8l3xG8e+Jvij4u1Hxt4vv/AO09a1RReqLMk/2cBwNCySScdc5yevU5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zSmnpvzWffaLtbz8td7fytL6LXjfDbg+dT/DxFw8vVtVMRD5LXzsfu35dz/+qOMj8Dnn6+/tyeXc9z/5Dj/x/wA59ufxBh/4LN6Mf+P74F6zaf8AXn470jVMc+3h8enft7GtuH/gsn8PCP8ASPhH4uth3+y6ropGOMf8tgB0/wD1Zp/8RE4X/wChpRf/AG76d6fW+nqr+fl/8S2+Mt9eDMRdW09pkDu9NLrENvWyuvK2x+05fIyAHUHBK5z/AJ/TOPwJWxACqn5jgjk49/Y84r8nPh9/wVf/AGevEev6NoPiPT/Enw7t/EWtaPoVh4j8XroUfhf+2vEGuHwzoekGZfErOJJPEJEeVQYVcKy7sr+s3JHy4I7dMEHnI+nv1619JlmZ4PNsIsbgpKUG2rvTW0Wk7ab9luvI/MOJuEOJuD8Y8n4pyipkWbpc0YTXRdU4tK762fVK2pbHQdqKQEYGSMkA88Utdh4a2XUKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApD0OemDmlpCQAc9MH/AOvQBhzXNtYQXFxNOLa2tsm7u7sjkAZyCSOOf16E9f4H/wDgtx/wVMuP2tPiFdfAD4P+ISf2cfhprQF9faOXP/C0PFK5Ca387Of+EaVT/wAUKwIEkheQqu/aP0c/4Lz/APBUxfCtp4j/AGJPgHqx/wCEl1W0ew+OXjHSb1Q2gaUQIj8L9DCMyM8qJnxy2FaKB/JCRbpI6/j5m6H6D+dfsXh1wbzf8LeYRsk04Rkk3a3xWd7NptLRXi7Nas+74YylaY7Gq9rWTWnTv5WenS/dnOTfe/z6CsKbofoP51uzfe/z6CsKbofoP51+kYmMdPdW/Zfyo+8jGN17sd10Xl/kvuM6ft+H9axZvvf59BW1P2/D+tYs33v8+gryMTGOnux27L+ZeR7EIx933Y/Z6Ly/yX3GFN0P0H86+vv+Cfv/ACct4a/7Aniv/wBMVfIM3Q/Qfzr7F/4J+/8AJy3hL/sC+LP/AEw1+deJyiuD+LbJK3C6eiSs+aN3693ufoXhbGK484QajFP/AFo3sr6Onb7uh+/VFWKK/wAwfrXn+P8A9sf6rR2XovyK9FWKKPrXn+P/ANsMr0VYoo+tef4//bAV6KsUUfWvP8f/ALYCvRViij615/j/APbAV6KsUUfWvP8AH/7YCvRViij615/j/wDbAfs5/wAEZv8Akevjb/2K/hP/ANP3iKv3+suh/wB0f+hvX4Ff8Ea/+R7+N3/YreE//T74hr99bLof90f+hvX9a+HevB2Uvu1+DX+Z/jB9LL/k+HFv+Hh1fdkFJ3/G3yL1B5BHrRQehx17V92fzs9n18u5lHbbIygHCkAg+jkE4PBxyfQgjjtX8pf7f6CP9rD4noOijSR/5Qxn9a/q1yMlCOihjxxwQcDp168fzzX5MftBf8E2Y/jh8VfEfxOvvipfeGF8Q2mmJ9kHhQap9g8vjCA+IwWbPDLwFOQWIGT+ceJvDOc8SZKsBk3LzfE4ylHdKKja7Tbab772P6K+jF4jcM+GHGmaZ7xTmk8lyiXDMqSnCjUqtucotxapxm0rxTk2kla7ff8Anyor9uP+HNll/wBF91j/AMIU/wBPEh/maB/wRsss8/H3WAO5/wCEEJx/5clfzbS8KePY1KbeVQtGcG3zQeilFt79k/v8j+/K30s/BKrh60IcWScqlGpCK/1Z4i1lODSXNy21bWu3XY/Yz4e/8iT4L/7FvRv/AEzLXeVyvhvSxoei6RpHnG6OlWWm2JuiMF9gCZ+jAAD2YDjFdVX9m4GLjCnGWjjTpxfa6UVL/gn+Q2YTjUzKvUg7wqV684vbmjOUpxdnqrpp2eqG/wAf/Af61+JP/BZWHPhL4RT9dviHxKPf/kCaLnr9Cfev22/i/wCA/wBa/GL/AILDxZ+HPwsuOCLXx5enP10Oc+n4jmvmvEG3+q2bPoqaene9G/z3P1v6Oba8ZuB7O18TJOy3TweIvr96ffVM/n2oqxRX8gfWvP8AH/7Y/wBv47L0X5FeirFFH1r+9+P/ANsVdu123ZWXkuy8vIr0VYoo+srv66+n970/Amy7LTfRFeirFFOOK1WvVdfP/ENRjdXStdX0R8hft4f8mr/Ej/r98Jf+p14dr9zv+CBP/BWm3/aY8DaZ+yV+0Hr4/wCF/fD7RseAPEerXSl/i/8AD/QSoMgYgf8AFS+EAFWVTklArIVZCH/Dr9vH/k1L4pf9f3w8/wDU78OV+CPwx8feN/hJ428N/Ej4c+INU8G+P/BGtaTrvhnxJo96P7V0/VvD/Qf5/LNf2x4KZWs34Ak07SXEzinu1dKzv/Krq6Vtne9z/Nn6WOVYPOOMFg18ajpLS6eltez0urrR9Ln+yBhTls8HvnA/p19+uaUEADnj1P5f5/wr8hv+CRv/AAUr8If8FFPgTa6te3Wl6R8c/h/Y6Vpvxj8IWWxEj1bau3xroK9W8M+LyGkhIBx80eUG0N+u2DswQcg8e/8Aj1PSvfxWGlgsVLBzVnFyUrbNrZre6d+utrN9D+BsVhMVgcZPB4uNnFtaxte1rX/NNPW+ti5RSDoPoKWuc5gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoooPQ96AK0ucLnr/9dq/Eb/gr7/wUy0b9iP4T3Xgn4c6vaXX7RvxL0XWF8FWeBqY8IaUTz4510I7FQp3J4KWQfvZkBwqxhW+2v26f2yvh/wDsM/ALXPjJ43W3v9RBGieA/CH2v+zNS8Z+LJfMbQfD8TNxuL5MhKYVSQArOGX/ADkP2g/jt8R/2kviz4s+M3xS18a74s8a3v268uhxpOnAYA0Hw+B/zLAHGB0xX6FwFwrLOMbHG47/AJE1NrVxspTj6q7ipbrTXS7SlE97IcqeMksY0rLSzv0t030811Vt2eJ+JNc1jxHrGpeIPEeoXWva34hvdWv9a1jWL3+1NV1DVvEH/Md1/wDTt1J9OObm6H6D+daM33f8+orOm6H6D+df0LXSjFxikopWSWisua23oj9RirJaW0Xl0Ocm+9/n0FZc33f8+orUm+9/n0FYU3Q/Qfzrw8VuvX9E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Bjo35lZLzairdPVPdb9DycXhI41NNRd00763W3XTt8z/AFjvh34/8JfE7wf4c8e+Adf0zxL4P8V6Pp2t+HPEelPu03U9Kf5o5Inzwhy4AIG05XA2EH0RlzyM85z26cV/Dj/wQ7/4Kez/ALPnjLTf2XPjdq4/4Uv421pP+EA8Saxdpn4aeKtbLtHFIzLn/hF/FzyNJE2Q0cp3qcNIr/3Hq4Kg5znsME5+g/Ov5n4hyHFcPY54OpFcrvOEndqUW09H5JpNO/S25+R5pg3g8VKD9E7KzSStpa1++iQ8dBn0ooorxTzgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoopCQAScdCeTjpQBg3moW1hZ3N9fzi0tbW0a8urq7K4slCknPHG0BsjPbGTnB/iO/wCCuP8AwUW1D9q7x5d/CD4Waz/xj18P74/Y7yyDY+KHirPy63hmb/imwu0eBWBAd8vtXdtH3j/wWt/4KSmyPiT9jr4L6xi4u86f8cPF1lfFRpyME/4obQlDFGclSfHTYUxxt5YAJkL/AMt1f0j4O+HKoqPFeeQ934qMJQtZNJKajJXUnFu2iag7NJtpe9leEaev5W3s3va78/h7edOfv/wOubn7fh/Wukn7/wDA65uft+H9a/fMVbS21tPS6t+B9EZ03U/UfyrCm+7/AJ9RW7N1P1H8qwpvu/59RXm4rdev6I9AxZ+34f1rFm+9/n0FbU/b8P61izfe/wA+grwMT1/r+U6Y7r1X5mXN93/PqK5ybqfqP5V0c33f8+ornJup+o/lXl4r7Xz/APbj1o7L0X5GdN97/PoKwpuh+g/nW7N97/PoKwpuh+g/nXhYrdev6I6o7r1X5mdP2/D+tc3P3/4HXST9vw/rXNz9/wDgdeTitl6fqj14fZ+X6GZN0P0H86+4f+Caf/J13hr/ALFnxb/6YhXw9N0P0H86+6/+CY//ACdr4a/7Ffxb/wCmJq/JvFj/AJIPiv8A7JX9UfoHh1pxfwk+3FKb9Pcu/TfyP6Sfs59B+Q/xo+zn0H5D/GtPyPf9f/rUeR7/AK//AFq/yrP9EPrXn+P/ANsZn2c+g/If40fZz6D8h/jWn5Hv+v8A9ajyPf8AX/61AfWvP8f/ALYzPs59B+Q/xo+zn0H5D/GtPyPf9f8A61aHke/6/wD1qA+tef4//bHOfZz6D8h/jR9nPoPyH+Nafke/6/8A1qPI9/1/+tQH1rz/AB/+2Mz7OfQfkP8AGj7OfQfkP8a0/I9/1/8ArUeR7/r/APWoD615/j/9sZn2c+g/If40fZz6D8h/jWn5Hv8Ar/8AWo8j3/X/AOtQH1rz/H/7YzPs59B+Q/xo+zn0H5D/ABrT8j3/AF/+tWho+iahrepadpGiW91qeo3d79hsrO04+36sATk+w6k+35OOEc5KMYuUm0kkru720UfMipjqdKE6tWcY06cXKcpSSSjFXd25JLQ/VL/glPDjxN8Xh0za+FCTkgYC+Ijg9R3z07A1+3COGDNjoQAM46E8e/8AntXxN+x3+zLD+z74K+0apdC58a+K10y/8SXwGTvKgLo69iqhiox1Y5PY19tYVI8dckH33Hp0HYH8a/tzgPLMVlHB+T4HGL3+VPb3lzSurrzXR7W+R/jj42cS5VxZ4lZ7nWStvKZVFGF9U3CMYNrV3TkpNd1qvdaLo5APrSN0P0P8qXpSN0P0P8q+72Xkj8w3KQ/17f8AXNf/AEKv5Ov2/f8Ak7D4nf7mj/8ApjNf1ij/AFzHt5ajPbO7pmv5Ov2/f+TsPid/uaP/AOmM1+I+NX/JN5b/AIof+kwP7P8AoT/8nMzf/slsR/6cpnyVRRRX8lUU/a0tH/Eh0f8AMj/UrFJ/VsRp/wAuK3/puX+a+8/tE+H/APyIXgr/ALF3Rv8A0yR1246v9G/nXEfD/wD5ELwV/wBi7o3/AKZEruADl+D0av8ARTA/8i6n/wBeof8ApFI/588z/wCRtm//AGE1/wD0uZHL/rrf/ef/ANBr+b//AIK0f8nFeGP+yT6N/wCpnrVf0gS/663/AN5//Qa/m/8A+CtHH7RXhgHr/wAKn0b/ANTPWq/OfGL/AJIx+kfzgf0b9Ef/AJPJk3/ZP8RL5vDVLL5n5j0UUV/F0U7rR7ro+5/sJJP2ctH8D/8ASf8Agr7z+qf9gz/k0j4Q/wDYtf8AuZ1mvtT/AJaL9H/9CNfFf7BnP7JHwhx/0LX/ALmdZr7U/wCWi/R/5mv794Y/5JvJP+ycpf8Apukf4LeIf/JwOMP+yv4l/wDUmYv/AC1/7Z/+zV+Uf/BVH/klPgD/ALKRF/6YfEdfq5/y1/7Z/wDs1flf/wAFTP8AkmHgD/sfIv8A0w+Iq5PEH/kjc3/7B/1gfQeCn/J1+DvLFJ/dC/47H4QfZz6D8h/jR9nPoPyH+Nafke/6/wD1qPI9/wBf/rV/DZ/sVHFaLXouvl/iPh3/AIKEQf8AGJfxI9ftvhP9dd8O/Uf5/Cv5koeg+h/nX9O3/BQ7/k0X4pfXwp/6ffD1fzIw9B9D/Ov9BPow/wDJBS/7KiH5QP4w8dn/AMZjHX/mmGt+toWXr2Rpwdv+AV0kHf8AH+lc3B2/4BXSQd/x/pX9Q0N36v8AOR/Py2XojRh6D6H+dbsP3v8APoawoeg+h/nW7D97/Poa97C7v1/RnHit16/ojo4eg+h/nWjD93/Pqazoeg+h/nWjD93/AD6mvdwyT5bpPbf/ALdPMN2HqPqf5V/aP/wQ7/4KgQfGLw5pv7JPx21i2/4Wx4UscfCfxJq14m74n+EtAK50VSwJPiXwcFAkU5+QAphkAb+LiHqPqf5V33g/xV4o8D+JNE8ceDtY1Twv4k8J61pOvaLrGj3v9l6rp+reH/r26evTtXHxVwvg+I8meExT5ZpOVOaSbjK103s2tdk1eNtVoz57NcIsZd7vyt+D0103d7+Z/q4gHqGyDyMj16Y5p1fkj/wSx/4KIeH/ANuz4N2kGu6hpmmfHv4e2WlWHxP8N2hXbfEeXs8c6AuAf+EZ8YFSyNzt+cYAKAfrYSQVxyDkfnjn/PbNfyXmWW4zKMdLL8amnCXK0012cZJtK8Xo4tb6p+8mj8xxeFeEbWur87dNf+G9LlqiiiucW4UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFJtLcCua/Fj/gq9/wUX079kT4dN4A+G+oWl3+0H8QLF49GtbXY58BeF8qJPHWulXIQKyungpGQM84P3Ah8z7L/AG4/2xfA/wCxf8FNa+J/i77Lqms3g/sP4f8AhJf+Qp4x8VMCV0JCODuPzEjsMk/MDX8BXxl+MPxA+O3xN8R/Ff4ma/da74t8bXv268uwAAAOBoOgY/5ljHTt9BX6x4TeHc+I8es6x6nHJac43urKckotJJrWKdrvROUeS7SlF+nhMLe0rJ9uvZ37W7fN+ZwGpX+oarqVzrGq6hdapqWrX32+9vLy9/tTVdQ1fvnis6bqfqP5VZqtN1P1H8q/seMYwioRSUUkkltZKy/A91aWt0/QzJ+//A65uft+H9a6Sfv/AMDrm5+34f1rzsVsvT9UegZ03U/UfyrCm+7/AJ9RW7N1P1H8qwpvu/59RXm4rdev6I9AxZ+34f1rFm+9/n0FbU/b8P61izfe/wA+grwMT1/r+U6Y7r1X5mXN93/PqK5ybqfqP5V0c33f8+ornJup+o/lXl4nr8//AG49aOy9F+RnTfe/z6CsKbofoP51uzfe/wA+grCm6H6D+deFit16/ojqjuvVfmZ0/b8P61zc/f8A4HXST9vw/rXNz9/+B14GJ6/1/KetHZei/IzJuh+g/nX3p/wTI/5O68N/9ix4s/8ATCK+C5uh+g/nX35/wS7/AOTv/Dn/AGLHiz/0xmvy/wAWP+SD4r/7JX9Ufd+Hdv8AXLhO9rXu7977vz89z+mXyV/zn/GjyV/zn/Gtv7OfQfkP8aPs59B+Q/xr/Ks/0FTVlr0X6f5r7zE8lf8AOf8AGjyV/wA5/wAa0vs3t/n/AL6qz9nPoPyH+NA7ruv6/wCHX3mJ5K/5z/jR5K/5z/jW39nPoPyH+NH2c+g/If40Cuu6+/8AruvvMTyV/wA5/wAaPJX/ADn/ABrS+ze3+f8AvqrP2c+g/If40EfWfP8Ar/wExPJX/Of8aPJX/Of8a0vs3t/n/vqj7N7f5/76oNLruv6/4dfeZvkr/nP+NHkr/nP+Nbf2c+g/If40fZz6D8h/jTSbasndtW9Xa35r70TKSjFybSSTd722V9zE8lf85/xr9xP2Kf2Sj8N9Otfit49sB/wnOq2OdI0m8w3/AAieknGEAIZT4hIyHfvyikHcw8d/Yg/ZLGryad8XPH0O21tmF74O0m7G4jdz/bYAB+ZwcDjgEHqVNfsogtlIQb+FVQuDhQox/kj8Mmv6V8KeAvqiXE+dq85K8ISTsklG0ndeas7ab72Z/n/9IvxvebSXBPCk5QpxduKasJ255qXL7KEottpL43Fq79xP+IjXXGBgAcDpxS4Hp7/j60AYAHoMUV/QKtZW20t+h/GIUh6HPTBzS0hGQR6gj86b2dwMqHIbyMDaQDuB7dznPTj9ea/lM/b+wf2t/idt6bdIx3/5l8V/VjHMLe2K5LEHJ6n7zE4HHYf/AK+K/BD9rD9hX4+fFn4+eNPGvgXR9EuvDfiEaX9hvL3xHpOlthNEKsxypIw+cbjyOV4wa/HfFjKsdm/DuX4LAZXOo/aLRXbglGPRK6claSur669T+nvon8Y8M8H8f5pmHFGcU8hpPhidPnlLl/eSnBRjeSSs1dNbppdT8fqK+/f+HXX7V3/Qr+Ev/Cs0r/43R/w66/au/wChX8Jf+FZpX/xuv5sp8FcZxq028m4p5VUg2+V8tlKGvw/DZfcvJ3/0hxHjj4TTw1eMfEThNynQqKK/1mXM3Km0ly922lbu7H9JHw+/5ErwX/2LWi/+mRa7ufp+H+Ncp4TsprHw54c0m8x9o0vR9MsL4f7cejiNxnt8wx3/AK11c/b8P61/c2DTjgKUXe6pxvdWd/Z000/NNNPzP8TsfOM80xE004zxNeSad1KEpylF36pppq5XikzblmQD5gMevvntnHJxnj1xX84P/BWi3W3/AGivCpTv8J9JY56hm8ba9kfUDGeT0AxX9IRbC4wMnJxjgemfX6dx+dfi3+33+x38aPjz8WNI8ZfDzTtD1XRdN8CaZoV6NX1fStOI1WPXPEGuKBlS5G3WlO7AVs7k3KQx+B8Tcqxmb8IzwWATc21ZRu5Nx5bKPXRK99NdErH7X9G7Psn4b8VslzrPs2hkeT0uf2tabUFFSg9JNvlSk2k9VdNvofhPRX37/wAOu/2rv+hX8Jf+FZpX/wAaoP8AwS7/AGrgCT4X8JYAyf8AirNK6D/tlX8qw4J4zU4J5NxS4qUbvlfLa8Lv4drL7k+zv/qbPxx8JGpJeIvCTumkv9Z0m7rRW0V3dad2ftV+wU239kf4MN/d8MkfnrWsHsK+01UByc8Z3fmB1/PPbnmvl79lPwJrvw1/Z7+GXgDxGtvb+IfD+h/ZNWtra5bUEWQaxIGO9lB+4oBOCBk/N1FfUfIyACcjGOuMKPT681/cORYV4HJMowck4yjSinF35koxhdSvs73TW/c/xe46xeEx3GPFuOwM41KNTiriOtSnF80Zwq4iVSE4yTalGUXGzV+ZK/UVup/3D/Ovy3/4Kgf8kz8Af9j7H/6Y/ElfqQ3U/wC4f51+XP8AwVC/5Jr8Ov8AsfY//TF4ir5vxDX/ABh2c67Ql+UF+tz6fwTb/wCIrcHP/p/H/wBNyf5n4heSv+c/40eSv+c/41t/Zz6D8h/jVb7N7f5/76r+IT/YCGJ+H5dPT+6fAf8AwUgg/wCMRfiR/wBfvhPt0/4nv6frzjPOBX8xEPQfQ/zr+on/AIKQQD/hkX4kf9ynj/we/h/h9K/l2h6D6H+df6CfRh/5IKX/AGVEPygfxv47a8Xxtr7sV/6Tp+L082acHb/gFdJB3/H+lc3B2/4BXSQd/wAf6V/UNDd+r/OR+FmjD0H0P863Yfvf59DWFD0H0P8AOt2H73+fQ172F3fr+jOLFbr1/RHRw9B9D/OtGH7v+fU1nQ9B9D/OtGH7v+fU17uF+z8v/bTycVsvT9UbsPUfU/yrooeg+h/nXOw9R9T/ACrooeg+h/nXq4Z7dbO+vlf/ACR5R9Ifsy/tJfEf9lL4v+E/jN8LNQNp4j8KXhW+s7wsul+INII/4qDQteKkEeGhngggqeQQQCP9Er9j/wDat+HH7YXwV8N/GX4dXGLTVVFhrXh2851bwh4oQE65oOuLn5JYpCuTt2spVhljtT/M4g7f8Ar9L/8Agm5+3n4w/Ya+NVtq81xqeqfCbxtfaTY/FnwhaWOft2l4IGv6AAVJ8TeDslSAQGUspIBNfE+I3BkeIcF/aGAS/tqEXzctvfgkm4vVLW909072aTkn4GbYP63dqKT3+S6PR6aPbva+5/oq0V534C8e+D/ir4K8N/EDwDr1n4l8FeLNH07XdC1qxKvpmoaU/wAwaMkfLuG7crLwVxyign0Sv5ZlGUJOMk1KLaaas7rR6dD4dpptPdBRRRSEFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAV68p+L3xc8DfAn4feJPif8TNftdA8FeEtGbUNZ1e76KqkgcAgHJwSP8AaI7V6Be39vp9nPqF9PbWltZ2n227urojFj8vJOeAFAbqc8Y53KD/ABC/8FZf+Ciuo/tafEK6+FHw01m5b9nr4fXx+xtZAg/EDxUGby/HBJZj/wAI0iHHgM5AZtzhU37R9NwZwfjuLs6hg435Izjzz2ioRadk7fHLRJX0jeT6c3XhMM8W7puyfze3XXT77+XX46/bu/bK8cftr/GvUviPrhu9M8FaT/a+hfDLwgb3nwj4VPUnHA8THP8AxXo6KMKuFAA+PKKK/u/KMowOR5fDLcvjGPJCMbK6ScbL77rd3bvdvVs+kSSSS6fIKrTdT9R/KrNVpup+o/lXWMzJ+/8AwOubn7fh/Wukn7/8Drm5+34f1rzMVsvT9UegZ03U/UfyrCm+7/n1Fbs3U/UfyrCm+7/n1FeFietvP/249AxZ+34f1rFm+9/n0FbU/b8P61izfe/z6CvLxPX+v5TpjuvVfmZc33f8+ornJup+o/lXRzfd/wA+ornJup+o/lXgYrZen6o9aOy9F+RnTfe/z6CsKbofoP51uzfe/wA+grCm6H6D+debit16/ojqjuvVfmZ0/b8P61zc/f8A4HXST9vw/rXNz9/+B14GJ6/1/KetHZei/IzJuh+g/nX35/wS0/5PA8Ef9ix4t/8ATBXwHN0P0H86/Qb/AIJYf8nj+Cv+xY8W/wDpiWvzDxR/5IHi3/sll+aPr+A21xLkz7T/APboH9QNJ5J9/wAxXR+Sv+c/40eSv+c/41/lkf3dHFe7H0XWXZeXkvuOc8k+/wCYo8k+/wCYro/JX/Of8aPJX/Of8aCvrXp/5N/XRfcc55J9/wAxR5J9/wAxXR+Sv+c/40eSv+c/40B9a9P/ACb+ui+45zyT7/mKPJPv+Yro/JX/ADn/ABo8lf8AOf8AGgX1pdl+P+Rznkn3/MUeSff8xXR+Sv8AnP8AjR5K/wCc/wCNALFryst7N6LT7tlv2Rznkn3/ADFfdv7In7LN18YtXtfGvi2wC/DvQcBbW9GR4u1XIDN2B8MqD8qk/MccEA1wP7Nn7O+r/HXxgFngurbwboF6R4j1Y5+ZgP8AkBaDjPyjgseQPcn5v388M+EtI8KaFp/h7Q7e207R9KtEsrW1tVCrZhccAjgYwBjHHfIPP7T4X8BPNJLPM7h/wkJqVOLVruLVrpr4VK101rorbtfyh9IrxujkeDfCPCk284lFwr1IVEnTjKKuk0+ZVJRleO3InzuStFS6q3tre3t7W3hgW3gAx9mCAZwMA4B455xn6cddTAznAz696QcAD0Apa/qWMYqKjFJRSSStZWSSWnokfwE5SnJzk25yfNJtttyerbbu279W2woooqhBRRRQAmBzwOevHX6+tGB6D8qWih676+oBRRRSsuy/r/hl9wBRRRTACAeoB+tGAeozRRSsuyAKKKKLLsv6/wCGX3AJtUDAUADoMDApaKKYFRup/wBw/wA6/Lr/AIKbf8k68Cf9jgn/AKZZq/UVup/3D/OvzB/4KVf8iD4D/wCxt1D/ANMk1fB+If8AyRucf4V+UD9O8E3bxX4Q863/ALjlr+B+L/kn3/MUeSff8xXR+Sv+c/40eSv+c/41/Fi3XqvzP9X1iVokl0S3/wAj8+/+Ck3/ACaB8UP+5U/9P1fytQ9B9D/Ov6rf+Cl3/Jn3xS/6/vCn/p+r+VKHoPof51/oJ9Gz/kgn/wBlO/zgfyZ4x68S3391P/02acHb/gFdJB3/AB/pXNwdv+AV0kHf8f6V/S+G6f1/Mfipow9B9D/Ot2H73+fQ1lw/d/z6mtSH73+fQ17+F3fr+jOLFbr1/RHRw9B9D/OtGH7v+fU1nQ9B9D/OtGH7v+fU17uF+z8v/bTycVsvT9UbsPUfU/yrooeg+h/nXOw9R9T/ACrooeg+h/nXqYbp/X8x5Rpwdv8AgFbcPUfU/wAqxIO3/AK24eo+p/lXv4ZJt3V1fXba2u5zn7/f8EXf+Cktx+z143tf2cfjP4gI+Bnja9P/AAjGsaxe4/4Vj4rwcq2Qc+GPGBIYdwwB+6WDf2wDa0OVJIbnP4Z/DOT7cZr/ACu4eg+h/nX9fP8AwRQ/4KSWvxL0ew/ZJ+N2vhfiR4WtBafCnxLqt2Fbxn4WUIo8EMwGX8T+Do40ibcSTGqopG0KfwHxZ4BtzcUZJBOEr+2pqC/u/vLK2qs1L3Xdappx9743M8Jf/a0rXeq6va9/n+b32P6VqKOtFfgXr/TPBCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoooouluwAkDrSEjBOcDHXpgdz/UVESWIzwP6ev5d6/FX/AIKyf8FFtO/ZF+HTfDr4ZaxaN+0H8QrKRNGFoEb/AIV/4WJAfxzrhR2EeGDx+CkIJeZc/KFw3RkeV43iLH08BgISk6k1FWi3ZN3c5PS0Ip6ttJu0VeUop0oNu3kn97t9/l/kz4I/4LWf8FJDD/wkn7HPwQ1n/SMmx+OHi6zvSCqMq/8AFCaHh2V2LBj47IUbImEYAIdn/mGqxeX2oareXGoX2oXeqalq179vvby8vf7U1XUNW/H8+lV6/vjgngvB8IZLHCYRqVWUYupUcUpTm1FSk7bPyTslaKVkrfTYTC/VLPq0tO3V/wBPf77lFFFfQHQFVpup+o/lVmq03U/UfyoAzJ+//A65uft+H9a6Sfv/AMDrm5+34f1rzMVsvT9UegZ03U/UfyrCm+7/AJ9RW7N1P1H8qwpvu/59RXm4rdev6I9AxZ+34f1rFm+9/n0FbU/b8P61izfe/wA+grwMT1/r+U6Y7r1X5mXN93/PqK5ybqfqP5V0c33f8+ornJup+o/lXgYrZen6o9aOy9F+RnTfe/z6CsKbofoP51uzfe/z6CsKbofoP515uK3Xr+iOqO69V+ZnT9vw/rXNz9/+B10k/b8P61zc/f8A4HXgYnr/AF/KetHZei/IzJuh+g/nX6C/8Eqf+TzPCX/Yl/EH/wBMJr8+puh+g/nX6H/8Eo/+T0vBX/Ys/EP/ANMBr8w8Uf8AkgeLf+yWX5o+u4E/5KTJv8f60z+qz7N7f5/76o+ze3+f++q0/JPv+Yo8k+/5iv8AMI/t2OKdlo9l27ehmfZvb/P/AH1R9m9v8/8AfVafkn3/ADFHkn3/ADFA/rT7P8P8jM+ze3+f++qPs3t/n/vqtPyT7/mKPJPv+YoD60+z/D/IzPs3t/n/AL6o+ze3+f8AvqtPyT7/AJijyT7/AJihW07eXbyD615P8P8AIzPs3t/n/vqvTvhF8INf+L/i+28MaJ/otrkX+s6uMA6DpR6a2ucZZjgKMj0JA5rG8I+CNX8e+I9O8MeHbD+09Zurwmzvb3pgDLHPfjOewFfvx8B/gr4e+Cfg220HTALvVbkC/wDEWrYBk1rVXX5pWJJGT0AHC4AOSxx+i8BcBy4hxynjk/7EjZ9pPayTfd21vomu6T/AfGbxawnA2S/2blsoyz7P1rZ39nF6OckrtJL4Vb3pJJtK8o9f8MfhtoHwt8L6d4U8PWAs9O0qMKgwCbskEls8Z5OfmwOMV6aTlc46kZGfQ/8A1u1BKnGQec47env+FL8u0cccdj6/n/jX9XYbDQwMI4LBxShCMbJq0YxikraaXt6u76n+dWKxOLx+MnjcbNzqTcpSk5c0nOTTcm9W7vZLSKXKkolkcAD0ApaKK7TnCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAqH76/T/GvzM/4KTceDvAeP+hk1D/0xy1+mZ++v0/xr81P+CkH/In+BP8AsYtQ/wDTLNXwviH/AMkfnHy/9sP07wY/5OZwh51Wv/KVR/ofkD9m9v8AP/fVH2b2/wA/99Vp+Sff8xR5J9/zFfxyf6mxxPwqz6Lofnh/wUyg/wCMOfijzn/TfCfHX/mO/Qfzr+UCHoPof51/Wj/wU0/5M0+KP/cqf+nwV/JdD0H0P86/vX6Nn/JBP/sp3/7Yfy74xO/En/biv/5T/wCCacHb/gFdJB3/AB/pXNwdv+AV0kHf8f6V/S+G6f1/MfixtQ/d/wA+prUh+9/n0NZcP3f8+prUh+9/n0Ne/hd36/ozzzo4eg+h/nWjD93/AD6ms6HoPof51twdv+AV7uF+z8v/AG08zFbL0/VGnD1H1P8AKuih6D6H+dc7D1H1P8q6KHoPof516mG6f1/MeUacHb/gFbcPUfU/yrEg7f8AAK24eo+p/lXv4Xd+v6M5zah6D6H+ddx4V8R+IPB2vaJ4o8KaxdaD4k8PXuk69ousaPe/2Xq2n6t4eJ//AFe/1rh4eg+h/nWnB2/4BXo4eEakZU5JOMouLTSatJtPR6bHnNJpp7M/vO/4Jif8FCdJ/bQ+E40fxTqNrZ/HLwRZiw+IGkg/2X/b2mZWNPG+gpg7oXDZOCpjYZzlgyfrSCWPJ4HJ+g+n/wCuv8079nb4+/Ef9mb4s+HPjP8ADPVxpfiPwne4Nl/zCvEOk/8AMwaFr/Q/8Iz+RGeor+/39kT9qXwB+158G/Dnxf8AAM32cXRSx8TeHGOdU8IeKk3Nruha6ueHjk2nJXkbW3FsBf5C8V/DupwlmH17AqUsjqyck0k+STs3F2StF/YbvreOicE/k8Zg/q/39rvW34v5aan1zRRRX5erNaf8MeYFFFFMAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAE65AOCP0/l6Uwp1O7P1/xzSpnJz1ODzx615L8Y/jH4B+BPw98S/FX4leILbw/4L8KWDX+s37DKp0A4ByzZIwCQMAljkBW5cLhpYxxjGMpTlKMYxim25SdkklfVu29l1bSV043urd1+a/Wx81ftx/tl+D/ANjH4Han8R/FP2bUvEd4BoXgLwhhkfxd4rdG2xjbJuTQVBVnkwCEIAAJVk/gP+L/AMWvH/xv+IPiT4n/ABMv7nXvFvja9F9rN3Z9ABgDQQB0A6AdhXvn7cX7Yfjf9tf41al8R/EQudL8JWhOhfD/AMH/AGwD/hEPCrHczEAAf8JOzEsxxyWJ5JNfItf2z4W+HUeFMGquPX/C3UjGWuvLFpNQTV1ZXu3e7k29Ekl9NhcKsJZtJt67bbd+2m+/kFFFFfsPqdIUUUUAFVpup+o/lVmq03U/UfyrzwMyfv8A8Drm5+34f1rpJ+//AAOubn7fh/WvMxWy9P1R6BnTdT9R/KsKb7v+fUVuzdT9R/KsKb7v+fUV4WJ6/P8A9uPQMWft+H9axZvvf59BW1P2/D+tYs33v8+gry8T1/r+U6Y7r1X5mXN93/PqK5ybqfqP5V0c33f8+ornJup+o/lXgYrZen6o9aOy9F+RnTfe/wA+grCm6H6D+dbs33v8+grCm6H6D+debit16/ojqjuvVfmZ0/b8P61zc/f/AIHXST9vw/rXNz9/+B14GJ6/1/KetHZei/IzJuh+g/nX6Mf8EnP+T0vCf/YsfEL/ANMIr855uh+g/nX6Mf8ABJH/AJPY8F/9ix8Qv/TCa/MPFFP/AFC4tVtf9Vtvmj67gT/kpMn8p6+WsD+sfyPf9f8A61Hke/6//WrS8lf85/xo8lf85/xr/Mo/seOKVlotl37ehm+R7/r/APWo8j3/AF/+tWl5K/5z/jR5K/5z/jQP60uy/H/IzfI9/wBf/rUeR7/r/wDWrS8lf85/xo8lf85/xoD6zfovx/yM3yPf9f8A61WdN0S/1vUbfSNLsLrVNR1W8+w2dpaYAv8AHJJJ4AGM5/M8VZ8lf85/xr9X/wBlD9m638J6ZB4/8YWzHxVqpAsrO7B/4kelkrtQna2fEDA4kcYGMgHANfUcG8H4ziLGvC4W6pRfNOeyUU1fX0ukk9bbI/NfEnxIwfh1kzxWJcZV5xkqVNtczqOOm15KKt7ztp2bsn6T+y9+zpY/Brw6NR1W2tbrxlqtmp1m9wNxYjcNGUtj5UOABgknPDDFfY4YQLvxyx4z2B744yPzqU7QADwBgAc9ugx/Q0k6qcKQcDGOCc9T6Y6/5Ff13lWV4PJ8FHAYJJJJJ2STvZX6W1ev4aaI/wA18+z3H8SZxUzrOKjlKpJyTlJtKLskoxu2oxVlFa93d3ZaAGAcDkdhS0DgAelFeqeYFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAVD99fp/jX5vf8FE/+RV8C/8AYxah/wCmOav0hP31+n+Nfm9/wUM/5F/wD/2GNV/9MstfC+If/JH5x8v/AGw/TvBn/k5fCD7VW/8AylUX6n5N+R7/AK//AFqPI9/1/wDrVpeSv+c/40eSv+c/41/IJ/pwsSm0rLVrv/kfnR/wVEg/4wz+KJ/7FPPr/wAh3/6/Uevp0/klh6D6H+df1x/8FSoP+MLfij3/AORT/wDT7jjofy+nqa/kch6D6H+df3Z9G3XgzvbipX9LK9/I/mnxXd+I9bWcY+m8L/lr6GnB2/4BXSQd/wAf6VzcHb/gFdJB3/H+lf0zQ3fq/wA5H4+bUP3f8+prUh+9/n0NZcP3f8+prUh+9/n0Ne9hd36/ozzzo4eg+h/nW3B2/wCAViQ9B9D/ADrbg7f8Ar3cL9n5f+2nmYrZen6o04eo+p/lXRQ9B9D/ADrnYeo+p/lXRQ9B9D/OvUw3T+v5jyjTg7f8Arbh6j6n+VYkHb/gFbcPUfU/yr38Lu/X9Gc5tQ9B9D/OtODt/wAArMh6D6H+dacHb/gFelhdn6fqzzzcr74/4J5/ty+L/wBij4y2+vw3Gqa98JvFn9k2PxM8IWgz/aGlAf8AId0DoT4m8HZIYcBgSp4avgeipzjKMDnuXyy7MFfmi42a2urLW113TVmntbp5zSd763v+J/pqfDn4j+Dvip4J8N/EHwPr9rr/AIT8VaOuu6JrFoMpf6WcYYdem7HZsg4AySfSAQ2A3Xt15/L6V/FV/wAEff8Ago7c/s3eNNN/Z/8AjP4h2/Azxtef8STWdYvQB8MPFuDgHII/4RnxgeQcfKfmwRkN/achWdQR0OM+54Bz971r+GeMuEMbwjnU8DPSDcnBte7ODkvKynHRSWvSV/esvmsXhXhW92u99npZemui7bXsy3RRRXzRyhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUjHAPIHBxmgDn9R1Cw0XTrnUb+e30vTbK2e8u7u6YbLNccu2cDC4Ixn7wIGcgH+H/8A4Kzf8FFtQ/a7+JFz8MPhnrFzbfs9eCb3Gi3tn/zP/ioE7fHA68Kpx4CwME7mwNxFfeP/AAWs/wCCkhnPiX9jn4I6wOpsPjj4usr3GxGC58CaF87K7bg3/CdMFXZGVjAzvaT+Y+v6T8HPDn6vy8VZ5BqOjpwktLNLlnyy2k03a+qi0mlJtL3MJhOr30000027/wCS211Ciiiv6dVtLdtPQ9QKKKKACiiigAqtN1P1H8qs1Wm6n6j+VeeBmT9/+B1zc/b8P610k/f/AIHXNz9vw/rXmYrZen6o9Azpup+o/lWFN93/AD6it2bqfqP5VhTfd/z6ivCxX2vn/wC3HoGLP2/D+tYs33v8+gran7fh/WsWb73+fQV5eJ6/1/KdMd16r8zLm+7/AJ9RXOTdT9R/Kujm+7/n1Fc5N1P1H8q8DFbL0/VHrR2XovyM6b73+fQVhTdD9B/Ot2b73+fQVhTdD9B/OvNxW69f0R1R3XqvzM6ft+H9a5ufv/wOukn7fh/Wubn7/wDA68DE9f6/lPWjsvRfkZk3Q/Qfzr9If+CRf/J73g//ALEv4hf+mKvzem6H6D+dfpD/AMEfv+T3vBP/AGJfxD/9MTV8F4nJf6n8Wq2n+qy0/wC3on0nCunE2UdPfp/ddfgf1xfZvb/P/fVH2b2/z/31W55Hv+v/ANajyPf9f/rV/lwf1pHFaLXouvl/iMP7N7f5/wC+qPs3t/n/AL6rc8j3/X/61Hke/wCv/wBaiz7f1/TQ/rPn+P8A9sYf2b2/z/31R9m9v8/99VueR7/r/wDWr6w/Zm/Z2n+IusW/ibxTYgeC9KvCws7zDf29qnQyMD/Cvv1PHJBx6uUZTjs6x8cBgU+W8b6XaV1fu9ne+v37fO8VcaYLg7JZ51jrOaTUYuSTlJW5Uot6ttpJd15s9F/ZI/ZvN9faZ8TfF+n4trQi/wDBuk3mCEBIxrmP7z5wowTk9MkZ/VBNuNoAAHAGAB+Q+nPFVrOG3t4hbwwC2t7bheAM4x9Se2T0GRVpdpJIGD/n8K/sTh/IcFw5gY4LBL3nGLk7K7lZX1/4dJb3uz/OHjPjHOOOc7nnOYTbjJv2cG/djBOPupN9tZPdvrZRUbVFFFe+fLhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBUbqf9w/zr85v+Cgv/IvfDr/sNat/6Y5a/Rlup/3D/Ovzl/b6/wCQZ8O/+wrqP/oeg18J4hf8kdm/ov8A3Gfpngr/AMnW4Sbeiqt69vZT+7e5+XH2b2/z/wB9UfZvb/P/AH1W55Hv+v8A9ajyPf8AX/61fyHHdeq/M/0e+s+9v9rv5/4j81f+CpUH/GE/xa6/8ynx/wBx309Pof0r+QqHoPof51/Yj/wVR/5Mh+LP/cp/+n3w5X8d0PQfQ/zr+7Po1/8AJGZv5cUq33wP578WXfONHf3ene8Ddh+9/n0NbUHf8f6Viw/e/wA+hrag7/j/AEr+l8N0/r+Y/KTah+7/AJ9TWpD97/Poay4fu/59TWpD97/Poa9/C7v1/RnFit16/ojo4eg+h/nW3B2/4BWJD0H0P8624O3/AACvdwv2fl/7aeYacPUfU/yrooeg+h/nXOw9R9T/ACrooeg+h/nXqYbp/X8x45pwdv8AgFbcPUfU/wAqxIO3/AK24eo+p/lXv4Xd+v6M5zah6D6H+dacHb/gFZkPQfQ/zrTg7f8AAK9LC7P0/Vnnm5RRRXpnnhX9Wf8AwRi/4KM/8J1p2mfslfG/Wivizw9ax2Xwc8S3V78/iDRo3Vz4E10sdi+I/CRVY/BY25ltwyhgypX8plaOg65rHhXWNN8Q+HNYutB1rw9faTr2i6zo17/Zeq6fq3h//mO5+vp9eK+U424MwfF+SvCYu0asFKVOpypyhNRfLJbXSvaSvaSbV7M58VhvrWvbV7Xe1te+n6H+oaGAGT07Hrkdjx6+9OBB5Ffj9/wSx/4KJaT+2d8Lk8L+MdQtLT48fD+zVPGmkghT4r00lVj8b6AuBuikb5Dj5lcjClXLRfr+OPl9OnvnJ/x/Kv4SzTLMZk2Pnl+Oi4yhJxtJNN21jJNpXjJWcWn3i/fUkfMNOLsx1FFFc4gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiii63vp3Ar1+I/wDwVt/4KLaf+yd4APwx+GerWZ/aD+INgy2ItcO3gLwq4Cy+Nzhiq+IV27fA0b7t8oLEJ5SF/sD9vD9sfwP+xX8FdT+IviJ7bVvFerPLoHw38Hm8Afxb4r+WSOM7XSRPD8bMknjOUKfLgXn940cr/wADnxZ+Kfjf43/ELxH8T/iZr9zrvizxXei+1m7uwANOAHAUdgBjHQAY4r9g8J/DqXEmOWdZhGcckpTi3zJJTnBRskmtYJ25raOS5btKSfqYTC7Oy6aW2e99fwvru/M4q8vri+vLnUL64urrUru9+33t5eD/AImuoH8OpHbr+fWvRRX9fxjGEVCKSikkklZWSstPQ9xaJLsFFFFMAoooo9ACiiivQAKrTdT9R/KrNVpup+o/lXngZk/f/gdc3P2/D+tdJP3/AOB1zc/b8P615mK2Xp+qPQM6bqfqP5VhTfd/z6it2bqfqP5VhTfd/wA+orwsV9r5/wDtx6Biz9vw/rWLN97/AD6Ctqft+H9axZvvf59BXl4nr/X8p0x3XqvzMub7v+fUVzk3U/Ufyro5vu/59RXOTdT9R/KvAxWy9P1R60dl6L8jOm+9/n0FYU3Q/Qfzrdm+9/n0FYU3Q/QfzrzcVuvX9EdUd16r8zOn7fh/Wubn7/8AA66Sft+H9a5ufv8A8DrwMT1/r+U9aOy9F+RmTdD9B/Ov0z/4I9f8ny+Ev+xL+IX/AKYzX5mTdD9B/Ov07/4I5/8AJ9Pgr/sS/iD/AOmKvgvE/wD5I/i3/slo/wDpUD6bhb/kd5U3/PHXyuv8vwP69PI9/wBf/rUeR7/r/wDWrT+zj0P5H/Gj7OPQ/kf8a/zASu0u7sf09HE6LXovy/wmZ5Hv+v8A9ajyPf8AX/61af2ceh/I/wCNd98Ofhpr/wARPEdtoGl/6L0GtauBk2GlEjAHB5J49PXFdeDweNx+OhgMDHVuK2vva6W9352/4HHm3EOAyPATzLMHFRjGUrtpL3Vfr5db9ep0fwD+CWofFnxViYXVt4U0v/kMasCMtjroQyeg4J9Bgc5Ffs9oHhzSfDWj2uhaVb22n6da2v2K2trUbFjQLghRgE4HQc5ydxwecjwJ4B8PeANCsdA8O2wtrCzXaABgnucZxkbsnPpjpk13QVfJ4yQee/XByfzP+RX9YcH8MYTh3BQThGWbyinVk99UmkuiXV33+4/z88R/EPHcc53LFuTjk8HJUqd2kre6puN7Ny11t7sbJWbk3b+tJgDoAPwpaK+19T879AooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAK9fnZ+3n/wAgzwN/2F9R/wDcFX6J1+eX7c3/AB5+Dv8Ar58T/wAtCr4TxBf/ABh2cL+6n9zpL9T9D8Knbj/In19ulfql7KT/AK9T81PI9/1/+tR5Hv8Ar/8AWrT+zj0P5H/Gj7OPQ/kf8a/kuO69V+Z/ogsRolfol/Xun5rf8FVoP+MIfi1/3KZ/8rvXn+f6V/HND0H0P86/ss/4Krf8mOfGP6eFP/T94er+NOHoPof51/cn0a/+SMzf/sqV+cD8L8Rbf2ur226/9uf8H8Tdh+9/n0NbUHf8f6Viw/e/z6GtqDv+P9K/qDC7P0/Vn5gbUP3f8+prUh+9/n0NZcP3f8+prdh6j6n+Vethd36/ozzzah6D6H+dbcHb/gFYkPQfQ/zrbg7f8Ar3cL9n5f8Atp55pw9R9T/Kuih6D6H+dc7D1H1P8q6KHoPof516mG6f1/MeObsP3v8APoa0Yeo+p/lWdD97/Poa0Yeo+p/lXv4Xd+v6M5zah6D6H+dacHb/AIBWZD0H0P8AOtODt/wCvdwv2fl/7aeeblFFFdB54UUUUX/DUD2H4BfHf4kfs2/Frw58YPhlrH9l+I/Cd4b4g/8AIK1HSef+Eg0HX/8AqWa/v7/Y1/as8Afth/BLQ/i94H22t1dD7D4u8NG7/tHUfCHiyMIdc0CVgCQUk+Zdmwc8IxWv86Ovuf8A4J/ftv8Ai/8AYh+NemeOLH7Vqnw38V/2ToXxN8IWWf8Aif6Vz/xPh/1M3g4dccEEg8E1+V+KPh1HirA/2ll6X9u04uVlZc8Ek3B6qN2vgba5Zap2cubzcVhfrW1l16v8t79uup/oc0V5p8MPif4I+MPgLwz8T/h5r9p4n8F+NtFTXfDOs2WNmoaW2ACmecFyVwQGyeeME+l1/GkoyhJwmnGUW04y0ldaNNPW66ng2tptYKKKKQBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRRpby/CwFYkAZNeJ/Gz40+APgT8OfFfxO+Jev2+g+FPCtm17fXh2bhsWZV0nSAJUaTXnZQERQTl1O1V3GL0rVdW03QtNuNX1W/tNO03TLT7deXd3df2bplhpy5O5mPyKEVMZcAAgDP3VP8AD/8A8FX/APgorqH7XfxOPw4+HOs3dt+zz8P77OjfYySvj7xWFAXxxrgJwqKAP+ECAAUsWcgO7GvruA+B8dxdncMFFf8ACPFwlWmlpCKcZuHN1lNXSV7xT53tG/XhMK8W+uj36/8ADaf1ax8iftuftheN/wBsn41638R/FIutL8N2hOhfD/wf9s/4lXhHwo2SSccf8JOzEnOOSemK+RaKK/ujKMowOXYCGW5fFRjBQikkklypJWtbtbf111PpErJLskvuVgooor2krJLsrDCiiigAooooAKKKK88AqtN1P1H8qs1Wm6n6j+VAGZP3/wCB1zc/b8P610k/f/gdc3P2/D+teZitl6fqj0DOm6n6j+VYU33f8+ordm6n6j+VYU33f8+orwsV9r5/+3HoGLP2/D+tYs33v8+gran7fh/WsWb73+fQV5eJ6/1/KdMd16r8zLm+7/n1Fc5N1P1H8q6Ob7v+fUVzk3U/UfyrwMVsvT9UetHZei/Izpvvf59BWFN0P0H8605+/wDwOsybofoP515uK3Xr+iOqO69V+ZnT9vw/rXNz9/8Agdac3U/UfyrMn7/8DrwMT1/r+U9aOy9F+RmTdD9B/Ov00/4Iz/8AJ+HgD/sTPiF/6YhX5hzdD9B/Ov1N/wCCMP8Ayfh8P/8AsS/iH/6YxXwXif8A8kfxb/2S0f8A0qB9NkDtnWU+t/ujE/sP+zn0H5D/ABo+zn0H5D/GtvyPf9f/AK1FnZX+qXlvYWVvdXOo3V6bCztLPgAdepIwAMk+lf5lRjKUlGKbk2kkk73vbZa7n79LGQpQc5uKhCN3JtpWirvV6beZo+HPB+r+L9d07QNF0/7TqOq8knAAAHUk8DA5yfx6Yr9ffg18K9K+F3hmHSLMfaNQvP8ATtZ1Y8NqGp5AdyR0JBJCggAADqc1yXwE+C1h8NNGNzfQ2tx4j1Zf+Jve7VJDEcaR8x5WPOSp6nOQcjP0oM7T2JPfPHPvn/Jr+luA+DVlGChjsbFPOZJO7Wi2aVn11Tel1tpqj+LvFjxGqcV455NgJSWSUZSUeWVvaSVlzO32b/Cr2b9530LQGAB+f1paB0Haiv09d3vbV9b+p+OJJKy0SCiiimMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCtN1/Efyr89v23/APU+Bf8Ar68Tf+4Kv0Jm6/iP5V+f37bf/Mi/9fXib/3A18Jxx/yR+cK39c9Ffjdn6F4VO3H2R/8AX9f+mZP9D87vs59B+Q/xo+zn0H5D/GtvyPf9f/rUeR7/AK//AFq/lOO69V+Z/ekcUrrRbrv39D8zv+CrsH/GCvxk+nhPn/uO+He/H16fnyK/jBh6D6H+df2jf8FboP8AjBX4x9v+RT56f8x3w79cn8B79q/i5h6D6H+df279HVf8Yfm2n/NUL84f8H8T8c8Q/wDkby9P/kTdh+9/n0NbUHf8f6Viw/e/z6GtqDv+P9K/p/C7P0/Vn54bUP3f8+prdh6j6n+VYUP3f8+prdh6j6n+Vethd36/ozzzah6D6H+dbcHb/gFYkPQfQ/zrbg7f8Ar3cL9n5f8Atp55pw9R9T/Kuih6D6H+dc7D1H1P8q6KHoPof516mG6f1/MeObsP3v8APoa0Yeo+p/lWdD97/Poa0Yeo+p/lXv4Xd+v6M5zah6D6H+dacHb/AIBWZD0H0P8AOumh6j6n+Ve7hfs/L/2088s0UUV0HnhRRRQAUUUUadduvp1Dc/av/gkT/wAFHbr9mbx1a/A/4s+IgvwL8b3y/Yr29DEfDDxTkb9bwskZHhtkyPHT7sRPtfa4Uo39sEE8FxCLmGYXFvc42kEEcjBAxjHT8sYJ4Nf5elf1N/8ABFr/AIKS/wDCU6b4b/ZC+M+rk+ItJs1sPg14vur7B1/SVdceCdfJljRfEkY3N4JGC8sS7FDELG/8z+MXhz7dy4qyKFo35qsYK1rJc1TlSTbSSUv7quruNpebmeF2atounZ9LeXySv939QtFA5APrRX87drvX+v1PBCiiimAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFK67oBCQo/kPX/P6UwksM/dHUnPb/AD+dKcM3Thc5z/n27+9fh1/wVx/4KOW/7KHgS4+FHwq1hT+0J42sWFl9kX5vAXhVyC+v5G1V8SswJ8DIEG+Qhzjb83VkWR43iHH08vwMXKVSSVkm0o3XNOTS0gurvq2oq8pa1FNvTuvPr/X3Hwf/AMFpv+Ckv22TxJ+xv8FtY/0W0Jsfjj4us7wg3ysBnwHoIDEE53f8J2VChYyse3Kkt/MvSXt9cX15c6hfXF1dXN3e/br28vf+Yh/+v6fz4Wv744J4MwfCOSxweEtKpKMXUk4pOU7RUpO1ve02TstIpWSt9NhML9Us+6Tt26v89L/5hRRRX150BRRRQAUUUUAFFFFABRRRQAVWm6n6j+VWarTdT9R/KvPAzJ+//A65uft+H9a6Sfv/AMDrm5+34f1rzMVsvT9UegZ03U/UfyrCm+7/AJ9RW7N1P1H8qwpvu/59RXhYr7Xz/wDbj0DFn7fh/WsWb73+fQVtT9vw/rWLN97/AD6CvLxPX+v5TpjuvVfmZc33f8+ornJup+o/lXRzfd/z6iucm6n6j+VeBitl6fqj1o7L0X5GJP3/AOB1mTdD9B/OtOfv/wADrMm6H6D+debit16/ojqjuvVfmZ0/b8P61zc/f/gddJP2/D+tc3P3/wCB14GJ6/1/KetHZei/IzJuh+g/nX6jf8EW/wDk/fwD/wBiV8Qf/TCa/LmbofoP51+pv/BFX/k/zwB/2JfxC/8ATEa+C8TteD+LEtebheKXm+aOi7s9zIJJZxlUm1ypybbdlaye/RH9mnkr/nP+Nfox+zj8ER4Rsz4u8SW4PiC8A+x2t2Qf7C0vORGmc5PGW79srjJ4v9m74JLPLb+PvFVvxgX3hrR7wA/YdxwNZXOPnfIUA9jk4yK++UEEUXC7Y1wAB1PPI5xjA657Y9OP5D8OuDOW2d49au3JGStbRNPVN7fJLXsfKeLPidLGuXC+SStSi37WcX8b2cE1ry3upu+usP5maAAAwAMelLRRX7atlbbofz/6hRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBXr4E/bU6+Bv+vnxL/PQa++6+Fv2yf+PnwMe2zxL/LQa+M45/5JDN/8H/uWmfoPhW/+M+yPuq9//KEj4C8lf85/xo8lf85/xrb+zn0H5D/Gj7OfQfkP8a/luO69V+Z/cX1p9n+H+R+Zv/BWiD/jA/42fXwn6/8AQd8O+nUn9fY5r+JWHoPof51/bn/wV0g/4wJ+Nnf/AJFP/wBPvh3p05+nr78fxGQ9B9D/ADr+1/o6/wDJG5t/2VS/KmflvF+uMV97dfl+n4G7D97/AD6GtqDv+P8ASsWH73+fQ1tQd/x/pX9K4XZ+n6s/OsT1/r+U2ofu/wCfU1uw9R9T/KsKH7v+fU1uw9R9T/KvWwu79f0Zxm1D0H0P8624O3/AKxIeg+h/nW3B2/4BXu4X7Py/9tPPNuHqPqf5VtQ9B9D/ADrnYeo+p/lXRQ9B9D/OvUw3T+v5jxzdh+9/n0NaMPUfU/yrOh+9/n0NaMPUfU/yr38Lu/X9Gc5tQ9B9D/Oumh6j6n+VczD0H0P866aHqPqf5V7uF+z8v/bTzyzRRRXQeeFFFFABRRRQAVY03VdY8OaxpviDw5qF1petaTe/b9F1izvf7L1XT9WP+c561XopSjGcXCSTi0001dWas9PQLX03uf3Ff8Erf+CiujftgfDO08I+PtW0q0+Pnw+sI4vGVmoWP/hLtKViE8b6CTIitksqeM12ZinYtkiTC/sb1A+oP5HP+TyPSv8AM3+B3xv8f/s6fE3wn8X/AIZ6wNC8WeFbw39mCM6TqIPB0LxAO/hg9PcHHSv7/P2LP2tPAP7ZXwT0T4reDgNN1ML9g8Y+EX+bVfB/ixcNruhS5+ZmRjkMDzkEkNX8b+K/h1PhvH/2zgYzeSVJNpxV1TnKzcWkk4wbvyOzjGXuNq8EeFisK8Nr06q2rb8u+v69GfatFFFfk6dzzAooopgFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUbgMVduSf8AP51FRXiXx0+OXgf9n34ceLvip8StYGheFPCdgb++u2wxvAwnVNI0dPOQy69KyFEjUfOT2AZoubC4WWMlHAYFSlOc4xSSbblOUUklbq33skruyWj1k+7f/DdD5u/b4/bM8C/sVfBTVPiPr32LVvFmsNqmhfDbwj9qUP4i8WAb4wWQq6eHoX8uTxrJy0agceZiWv4Ivin8TPF/xo8eeJPif4/8QXWu+LfFesi+1m8ux27Y9RnjA7e3T3P9tT9rnx/+2P8AGnWfiZ4oN3peiWQ+wfD/AMIm9UaZ4S8Kn5n0Z9iqvmSOS7sFUF2ZsDOK+T6/uDwt8OY8J4FVcwS/tycYybbTUYtJqKeqSSau00nK762X02Fwqwtm0m2k9lpor/dpa4UUUV+snSFFFFABRRRQAUUUUAFFFFABRRRQAVWm6n6j+VWarTdT9R/KvPAzJ+//AAOubn7fh/Wukn7/APA65uft+H9a8zFbL0/VHoGdN1P1H8qwpvu/59RW7N1P1H8qwpvu/wCfUV4WK+18/wD249AxZ+34f1rFm+9/n0FbU/b8P61izfe/z6CvLxPX+v5TpjuvVfmZc33f8+ornJup+o/lXRzfd/z6iucm6n6j+VeBitl6fqj1o7L0X5GdN97/AD6CsKbofoP51pz9/wDgdZk3Q/QfzrzcVuvX9EeiZ0/b8P61zc/f/gdac3U/UfyrMn7/APA68DEWb8nbXy909DTd7d/Lr5GJN0P0H86/qF/4Nwv+CdXxZ8e/HHTP21/F+jHQvgF4U0XxboPhj+2LFjqvxO8V6+D4eJ0EKCW8NeDVB2+KgNzsAoKgsy/Mv/BGv/gj14o/b58eWvxe+MOn694W/ZP8F6yx1e7w2mar8UNWTG7wPoIUE4TK/wDCfeLSVySqA7nXP+iL4H8EeFvh/wCGtF8FeBtH07wx4R8K6RpOheGPDuj2Q0/S9B0nQwiR6PEIywEYXCj5QdgZmDMWd/zfjLNsG0sljadrc7umraNp677aP7tk/huKOKXhb4DAOzUUpST1V7XXMrNS7Wemj6q/fABQAMYAxwMVZwPSiivzpJJWSSS6I/KOt+vfr94UUUUwCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBr/AHT+H8xXwp+2J/rvAf8AueKP56BX3W/3T+H86+HP2vv+PrwF/ueJv5aBXxnHP/JIZt6L/wBLifceGN1x7kb/AOnsv/Tcj4b8k+/5irPke/6//Wra8lf85/xo8lf85/xr+W47r1X5n9q/Wl2X4/5H5Zf8FdLf/jAn42cf9Cn6/wDQd8O+/vz6e/NfxBw9B9D/ADr+5f8A4K6Qf8YB/Gz/AK8vCf1P/E98O+g5/Q1/DRD0H0P86/tf6Ov/ACRubf8AZVL8qZ+ccUf76v8ACvyRuw/e/wA+hrag7/j/AErFh+9/n0NbUHf8f6V/SuF2fp+rPiTah+7/AJ9TW7D1H1P8qwofu/59TW7D1H1P8q9bC7v1/Rnnm1D0H0P8624O3/AKxIeg+h/nW3B2/wCAV7uF+z8v/bTzzTh6j6n+VdFD0H0P8652HqPqf5V0UPQfQ/zr1MN0/r+Y8c3Yfvf59DWjD1H1P8qzofvf59DWjD1H1P8AKvfwu79f0Zzm1D0H0P8AOumh6j6n+VczD0H0P866aHqPqf5V7uF+z8v/AG088s0UUV0HnhRRRQAUUUUAFFFFABX2r+wX+2T4v/Yp+NemeONL+1ap4B8QHSND+JvhCzvP+Q/4VHGccf8AFTeDxkeBMH5lLKcqWFfFVFcmb4HA55l0stzCCalFxs1o3JJLtZq+lndWutUhNJ7+nf8AM/0yfhX8VPA/xo8B+Gfif8ONdtNf8F+NNGTW9E1ezPF9G21d4HbAGNuMkqR0xn0+v4gP+CR3/BR25/ZY8eWnwY+KXiEL+z38QL4f6bfBiPhh4q3AvrRCsh/4RpkyPHTEnY5V9rbSjf23280F9AtxDOLi2uQLq1ubYggr8oBDZIbB4Bx82SDgjj+EOMuD8dwjnU8FK6puUnCWrjKDs7XtaM46pxu7pKasm1H5rF4b6o+uvn+XZa6eV9zYooor5k5QooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiikYgA844PfFAHLaxq2meHdNv9Y1a/tdO0zS7Q3t7e3t1/Z2mafp0e7Lu4OxNqxkbnAGdqhgdqH+Hb/gqz/wUW1D9sL4m/wDCAeAdYurX9nnwVeg+GbMFtvxA1cAL/wAJzroJO1OM+AQMDJLHLFifvD/gtN/wUj/tO88Tfsc/BfWB/Z1qTp/xm8X2d2Ab7Uuo8BaEVO1tpL/8J3wNiNsC5DvJ/NFX9N+DfhzHD8vFeeRUVvShONmk1FKThLVTabS05oxbXutyR7uEwr3a1XltotOnk+itbrqFFFFf0pzRbumvLVXt0/Q9MKKKKd13X9f8OvvAKKKKLruv6/4dfeAUUUUXXdf1/wAOvvAKKKKACiiivPAKKKK9AAqtN1P1H8qs1Wm6n6j+VcFn2f3MDMn7/wDA65uft+H9a6Sfv/wOubn7fh/WvMxKemj27ea/zX3noGdN1P1H8qwpvu/59RW7N1P1H8qwpvu/59RXhYlP3tH16f4j0DFn7fh/WsWb73+fQVtT9vw/rWLN97/PoK8vEp66P7v8P+aOmO69V+Zlzfd/z6iucm6n6j+VbU3Q/QfzrFm6n6j+VfP4np6f+3I9aOy9F+RiT9/+B1mTdD9B/OtOfv8A8DrMm6H6D+debid16/oj0la6vtfX0Odm6n6j+Vfsl/wSH/4JK+OP+ChPxHtvHHji21/Qv2Vfh9rf/FaeLwP7L1Xxhqw6+BvAPPQAgnxaOfA2MDLEA4n/AASr/wCCWPxI/wCCh/xZtrm+t9U8L/s3+CNZ/wCLm/Ej/oI9x4F8BHHHibjn/oRe2SQD/o2/Bj4OfDb4BfDzw38J/hL4Y0vwd4A8FWI0/RfDejg7dPXngA5xkMevPfoNo/K+KeIVhW8BgXGTa95pprXT1u27dlp03+W4o4o+qr6jgbaqzas+ivr3006evXY+G3ww8C/B7wJ4c+G/w18MaV4N8BeC9GTQ/DPhjSLUabpWmaYgXCIOgAILE4BBJbjI2+m0UV+Utttt6t7t76n5Q22227t6tsKKKKQgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAKzf6w/Q/8AoVfFv7WK+dP4JHHEfilc/wC7/wAI/j09/wD9fX7SP+sP0P8A6FXxv+1L/wAfngkdwninI9OdA618dx1b/VfNFp9nT5U7/wDBPsfDq3+uOTvtVev/AHCf+bPjz7N7f5/76qt9nHofyP8AjWrRX8wrdeq/M/sCz7P+rf5r70flx/wV6g/41+/HXp/x5eE89OP+J74d/wA8D/Gv4X4eg+h/nX91X/BX/wD5R+/H/wD68vCX/p88O1/CrD0H0P8AOv7P+jp/yRubf9lSn8rU9fTzPjM9/wB7j8jdh+9/n0NbUHf8f6Viw/e/z6Gujh6D6H+df0rhuvp+p8iaMP3f8+prdh6j6n+VYUP3f8+prdh6j6n+Vetht36/oeebUPQfQ/zrbg7f8ArEh6D6H+dbcHb/AIBXu4X7Py/9tPPNuHqPqf5VtQ9B9D/OsWHqPqf5VtQ9B9D/ADr3cN19P1PHN2H73+fQ1ow9R9T/ACrOh+9/n0NaMPUfU/yr1sMnrp1/T/gr7znNqHoPof5100PUfU/yrmYeg+h/nXTQ9R9T/Kvdw32fl/7aeeWaKKK6bPs/6/4dfeeeFFFFFn2f9f8ADr7wCiiiiz7P+v8Ah194BRRRSAKKKKLPt+Hp/wAD8ACv6i/+CKX/AAUjGq2uh/sd/HDVwdSs2Fj8GfGF7fE/2hpChwPA+ufOqowDkeBWALSRgxsGG3b/AC6VY0fVdQ0PUtN1jStRutL1LSb37fZXlne/2Vqun6sfTj8vxwK+W414LwnF+SyweLTjVipOFRR96M1F8sk9L2vqm7STad09cMVhfretttXpq9vL/htPJn+osGAGT07Hrkdjx6+9OBB5FfjD/wAEpv8Agotpv7X/AMOLXwB8RdVsLT9oT4fWMEXiazIVP+E80dHbZ450E713KWZU8aIqkxzyEj5XOz9nAQOM9OnuDyMevpX8I5plmNybHTwGOi04Nq8otXt8LUmknF2TTTa3i3zqSPl2nF2Y6iiiuYQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUARsMKB6Hn9f618Fft561+1TB8E9S8P/sjeCLzxR8UvFTNodn4itNb0bSh4A0sgl9dB8SOFk19VdVjRkO0rubdIAV++aQkDGR39M49/wDPNThcR9TxkcZyxlyuLjGabi5RcWuZbW01W/5DTat5O69dP8j+Cub/AII4/wDBQ++mubif4Pi6urzH228vPGmhj/3aMkZ496T/AIcuf8FDv+iIWv8A4Wngn/5pq/vOor9sj4/cTwjGEMq4YUUkrOE9bKCV0mld2V/VnprM8UunS2l1+h/Bj/w5c/4KHf8ARELX/wALTwT/APNNTv8Ahyp/wUH/AOiM2v8A4cLwRX95lFP/AImA4o/6FfC62s/Z1Fb4dfi9PvYf2piu35+Xl5fl2P4NP+HKf/BQj/ojFt/4cHwT/hSf8OXP+CiH/RINB/8AC28E/wCFf3l7h6/55/w/zkUbl9R/nP8Ah/nIrn/4mD4m/wCffDS/7df+Yf2piu35+X+X5dtf4Pv+HKn/AAUR/wCiQaD/AOFn4L/xo/4cqf8ABRH/AKJBoP8A4Wfgv/Gv7wdy+o/zn/D/ADkUbl9R/nP+H+cij/iYPib/AJ98Nf8AgL/zD+1MV2/Py/y/Ltr/AAff8OR/+CiH/RKPC/8A4c7wT/hV/wD4ckf8FD/+iT+GP/DmeCv/AImv7sty+o/zn/D/ADkUbl9R/n/9X+cil/xMFxRdWjwzf/A//k0H9qYrt+fl5eX5dj+E3/hyR/wUP/6JP4Y/8OZ4K/8AiaP+HIH/AAUP/wCiX+GP/DneCv8ACv7s6KP+JgeM9LU+Gen/AC7f93z8193lq/7UxXZ/j/l5L7j+Ez/hyB/wUP8A+iX+GP8Aw53gr/CrP/DkD/god/0S/wAG/wDhwPBP+Ff3VUUf8TA8afycM9P+Xb/u+fmvu8kL+1MV2/Py8vL8ux/Ct/w48/4KG/8ARMfC3/hzvBNH/Djz/gob/wBEx8Lf+HO8E1/dTRS/4mB40enJwzrbalK+vLt72+qt8u2p/amK7fn5f5fl21/hd/4cdf8ABQ3/AKJx4D/8OF4IqvL/AMENP+Cgx6fDfwJ9P+Fm+C/w6gHrnp696/uqoqP+I68fP7dGz6Ki7fL99tv8rfN/2piuz/H/AC8l9x/CHN/wQs/4KHHp8OPAZzz/AMlN8FZ9+35fkB3qtN/wQf8A+Ci3/QgeA89f+Sm+Cv5fl9M+lf3k4f1/X6/5/EenBh+5H49O/t0/xHpx5v8AxGvjR/8ALyGu96L8v+numyvv8up/auJ/mX3y/WJ/BJN/wQX/AOCi3b4f+BPTH/CzfBfb049SPzHTjOaf+CBP/BReb/mn/wAOu5z/AMLM8Fn2zwD34H8q/vs+X+8P++R/h9P8nhfl9R/3yP8AD6fr68H/ABGHjJ7zp62u+T0/6eXW3y++/Qs/xaSVldf3tPu5b/ifwATf8G/f/BR/t4P+F/b/AJqbov59PfH19zVab/g30/4KPf8AQofC/v8A81O0T274xz0/HFf6AmB6D/P/AOoflSYHoPy/z6D8qX/EVuKWrOVPz/cz8v8Ap55b/wDBvf8Ab2L7S+//AIB/n0/8Q8//AAUem6+EPhf1z/yU7RBn8x2P+earS/8ABvD/AMFJjyPCHwl/8Oboo69ewPce/r61/oTbF9P5/wCew/KjYn90fr/nsPyrzv8AiJuetr3qetvszv8AZ6+0t36dPPXb/WjHq2kbevp5ev4H+eRL/wAG6H/BS8j/AJE/4Tcj/opui/4Y69D+Br0f4N/8G2H7Z+t/E3wpp/xvn8CeDvhLda0f+E08SeHPGejeJ/FGn6SBn/iQaGVIHiX/AGuVHPcGv76dw9/yP+HuPzo3D/IPt7e4/Os5cecRTi4udNcys3bZNJaLm3Sva6fTTVoX+tGbtWvGzVvs3s7ed9F89EeB/Aj9n/4Y/s2fDDwj8Ifgx4XtPB3gPwVYnTtE0eyHCbkTzNY1uRUD+IPEDyRhmkcs2TjK4iC/QtFFfFSk5Nyk223dttt6+b1Pm22223dvVthRRRSEFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAV6+fPi98LNQ+IkujPY6vbaaNMOpsftVmXzuAXK8gbR1yABt5x6fQdFeZmeWYTNsG8DjV7r1ktr2afTfRfh0e3TluZY3KMasfgLKSd4y0bi2uW6urqyfS1111d/hn/hmLxR/0HND/APATWP8A45Tv+GX/ABV/0G9D/PWP/i6+48H1H5f/AF/85PtgwfX9Pp7/AOc/THyn/EO+HdrLot/Tzt+mvofc/wDETeMtLZs7f4Y/5H4pftxf8E7vi9+1H+zF8SPgh4G8TfD3QPEXje101LLWvE15ra6Vp3leIP7fPHh3wxvKlwQpCkN16HNfzdQf8Gqv7d8I/wCS7/ssDnv4j+Ko4/8ADW/4fSv79sgdV5Ht9M+x7kdunrUBnTgnOM4GAcA8ce2fyr73hdvhLBvBZIuWO+r5m3dO71UV0v5epyV+POJMXbnqRfw6uK/u7Wa0dm1fbu1ofwNf8QsX7c0PT40fswZ9/EvxTz/6q3nH+fbRi/4Nd/25h/zVn9lYdP8AmZfin+H/ADS7oQcH3/Gv73M/7f8A47mjd/t/+O//AFq+uXGWcJL97Turbxn5dvTv27Hnf65Zz1d/NxSvt/e/qy+X8EkP/BsL+3PBj/i5/wCzD+HiXxz/APOu9x1qyP8Ag2Z/bvh6fEj9mo/Xxl44xj/w13r265/Cv7zdw9/yP+HuPzo3D/IPt7e4/OqXiHnelpx+UXrtb/l55ef53P8AWnOHu4+ekfLu/wAH2R/B0P8Ag2o/buh5Hjj9n/p1/wCEx8cjp9fCvHJ9fxqz/wAQ337d0P8AzM/wA5/6m/Xx/PwqK/u9orqXiLxLZax6bR6abfvNOu/kYf60Y7uvPT08/X8D+Esf8G5f7d0OP+Kh+BGf+xy132xwfCwx2x71pj/g3Z/buh/5mH4Ik5/6HPXOvbr4WHt04PFf3THZnt+R/wA9v85NA2e35H2/z+fqa6V4n8Tq3v0la32PT/p501+6/k5/t/GeX3v/ACP4WR/wbzft3wjjUPgl6/8AI5MB06c+FvT/AOvxVr/iH0/bvh6f8Kc4/wCp/b8+fCw9s+nHpX9y9FdC8WeMlb95S/8ABe+3/Tzy1/4e/P8A2/jPLz1f+X4fifw8j/ggH+3dDwLf4TZ/7KY3H/lrH/I9qsj/AIIL/t3w5xp/wm/Dx+39R+nXpiv7faKpeNnGun7yH/glrt19tpt1v+dz+1cV5/e/8j+IH/hw/wDt7/8AQI+Hf/hf6N/hUH/Dh/8Ab2/6F74Yf+F9o3+Ff3C0V0rxt4+/5+U+n/LuXl/09/q3krr+1MV2/Py/y/Ltr/Dh/wAOIP8AgoR/0K3wy/8ADlaP/wDG6X/hxZ+39/0J3w7/APDsaN/8TX9x1FC8bePutSl/4Lku3/T5+X3egf2piu35+X+X5dtf4Zv+HGX/AAUH/wCif+BP/DmeC/8A4is//hxr/wAFD/8Aom3g7/w5vgr/AOJr+6miheNvH2l50ntvTlbpv++2/Relz+1MV2/Py8vL8ux/Cx/w46/4KH/9E38Gf+HN8F/4e/8AP0NJ/wAOPf8Agoh/0S7wb/4cHwTX90+B6D8hRgeg/IVa8d+M1uuG3t/y7af2fN6+996+4/tTFdFb7329Oy+5dj+EWX/gid/wUHh/5pR4Xx/2U7wSM/hj/PTrVab/AIIq/wDBQft8INAP/c6+CPxx2Pb29Oa/vJIfseO3Tpz/AJ/H64MP6j9P8P8AOfrgXjrxnpdwv1aUrfZtb3tlb52+8/tXE91+Pl5W/wCG8lf+Dab/AIIuf8FB4P8AmkGgc/8AU6+CT+ZH+RVb/hzH/wAFBv8AokFp/wCHC8Ef/E1/ebRXo/8AEdeNGtfZNW25Xqvd0+Lsrb9vMP7exl1pFLTzf39z+Hr4M/8ABMX/AIKjfAL4keG/ix8MvhhaaF4t8KXn2+yu/wDhNPBGNQGOdC1//iqP+RZA6jPrxiv7KvhL4g8XeK/hv4Q134ieEJ/AfjLU9EjfxJ4Qur9dT/4R7VQcayh1tAA8YbcUOVHyKFBYMw9ZA56D6/y4x9O/rTq/OeJuL8bxZJTx+VwjNN+/CPLdNLe8pXV1ffT7Nrs5cTini7WVtnpZ66O+iXbttdFiiiivnFsjlCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKVl2X9f8ADL7gCiiiiy7L7v67L7gEwPQfkKMD0H5Cloo5Y/yr7l/XRfcAmB6D8hRgeg/IUtFLlj/LH7l/XRfcAmB6D8hRgeg/IUtFHLH+WP3L+ui+4Aooop2XZfcgCiiiiy7L7kAUUUUWXZfcgCiiimAUUUUAFFFFABRRRQAUUUUAGB6f5/yB+VGB6D/P/wCoflRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAJgeg/KjA9B+QpaKACiiigAwPT/P8AkD8qMD0H+f8A9Q/KiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKVl2X3IAooopgFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFGR6/5/wAkfnRkeo/z/wDrH50AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUZA6nFGQehzQK6va6v26hRRRQMKKKKACiiigAooooAKKKKACiiigAooooAKKMj1/z/kj86Mj1H+f/wBY/OgAooooAKKKKACiiigAooooAKKKKACiijIHU4oAKKMj1/z/AJBooFdd194UUUUDCiiigLre+ncKKTI9R+YoyPUfmKLPt/X9NfeK67r70LRRkeo/zn/A/kaMj1/z/kH8qAuu6+9BRRRQMKKMj1/z/kj86Mj1H+f/ANY/OgAooooAKKKKACijIPQ5ooAKKKKACijI9f8AP+SPzoyPUf5//WPzoAKKKKACiiigAooyD0INFABRRRQAUUZHr/n/ACR+dGR6j/P/AOsfnQAUUUUAFFFFABRRRQAUUUUAFFGQOpxSZHqPzFFn2/r+mhXXdfehaKMg9CDRQO6ezuFFFFABRRkev+f8kfnRkeo/z/8ArH50AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFGR6iij9dvMV13X3hRRRQMKKKKACiiigAooooAKKKKACiivIPiX8Xfhh8FvDTeL/ix8R/AXww8OLeCybxB8SPGeh+BfC51Mg5Qa/4kkRFZsEKzOU65GDw0m3ZJtvZLVv5Cule7Stv5ep6v5Hv+v/1qPI9/1/8ArV8bf8PEv2Af+j6v2QP/ABJn4L//ADV1718Nvir8Ofi34ZtPG3wt+IHgz4m+FL5SLHxd4C8T6D458MXvy5ATXfDbTROy/wAWGKr1O4VDwuLSvJSiu7Ul+cVr5ErEwbspRb7Jxb6dE/6v6W9XoooqiwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAqOUqEJJ6YI59Dn+np9Khc8fUgf1/pX5hf8Fe/2u/8Ahif9gX4+fGjSb5dL8fHwwfAnwyvhwdP+IfxAP/CO+HtcGDj/AIo/e3i5j3Hh0+prfC4aWMxcMHBXc5Qjov5pRWq00XMm7PRXOPF4pYTByxllpG/bvbX5dtdmj+Sj/go1/wAHIP7a3gH9tL46/Df9lHxv8OdK+Bnwz8aar4E8MG7+H3grxM2o6t4f2+H/ABBrv/CQ+IgCQ3ihdd4+6ygK2UBrz79kH/g5j/blv/2m/gnpv7UPxA+Hep/AHxB8Q9H0P4nfYPhp4N8KHT/Cmvyf2F/bv/CQo6sB4QcDxbIudsq/u3VoyVr+WCafz5vtE/69+v8An36+1TV+7/6n5P8AUVhP7KXPyL373lsm7vdrm97p3R+P/wBv5v8AXfrqbUVLu7WvFa7JPdJ/gf7d64IyP4ufz/L/ABqzX4uf8EIP2tk/a6/4Jw/BLxNquq/2r43+GVm/wb8f3VwNp/tjwAQuhnggEt4Zl0FiSQSSx64r9mU6fT/AH+vHtX4Ti8K8Fi54KSs6cpRell0s1G+0l0bbta/Y/YMJivreDhjNNYp6bbK/b8Lrs2WqKKK5zrurX2Xn5leivm74mftXfsv/AATvP7J+NH7SHwK+FGtSL/yCfiN8XPA/hLVOcEY0XxF4miuMEYwy7sjoetQ/Df8Aa0/ZY+NF6NI+Dv7S/wACPifrirxpHgP4ueB/FeqMcjg6J4e8TNMSBjnaBx3o+p4y17Ttpryytrbray3OX61G9k4t3tv6eb7/AK+n0/RSAg9CD9CKWjbfQ6k01dO6CijI9a+YviR+11+yh8FtTPh74xftMfAn4YeJSvPh7x58XPA/hTVh6KND8Q+J0lGOvCHHAyCKaTeyb9E3+QOUVu0vVpfmfTtFfNXwz/au/Zg+NF2NO+Dv7SPwL+J+tKvGk+A/i34I8WaoTkcNoXh3xNJJ9WIx6knivpXIPQg0OMlumvVNfmClF7ST9GmFFFGQOpxSHdb307lfyPf9f/rUeR7/AK//AFq4Lxv448G/DvRLjxR498ZeGPAvh6xXF54k8X67o/hjSLDI/wCWmt+ImSLLchdx5HQgAAfNmm/8FF/2BtW1f+x7L9tj9lW71Ef8udp+0F8Lj75P/FUD8Omc5NKOExkleMZNb3Sk/wD23fy3IeJgnZyin2bin91+v6vyt9sUVy2ja5pPiLTrXWNDv7PVNM1W0F7ZatpV4NS0y+XAHyMuVI6EAAcZVmDKVrqapprdNeqsUmns0/R3KzZAOOv+f6V+P37eX/BZz9kr/gnD8UvCfwm/aMsPihceIvG3gFfHuhP4C8FjxRp0mjHW9f0BjKn/AAkUIicy6FIpjAc7QHLK0hjj/W671XTrAf6bf2tr7XV4B+OGK9D6nP4V/nrf8Hcd5YXn7dH7PM9lc212T+yZppza3q5Kt8WviKwPyk54PHIOByAeK9zhjK8Nm+bxweMjL2c0/es1FKycbNK2t2tHuuqueFn2MxWCwcsZg2ubbldr3079Omz38tf3X/4isv8Agmfkf8Sr9ozA6j/hWWjc/ifFh/rX9LUE3nReePbGRkD27ds9+pJzX+I3X+2PZ+IdB/s+A/2xpvzWqnP22PoEx65x3ORnsARk16vFHD2Eyj+zVgYTlzKTlZSle1lazulaLeiVtNLnl8M5rjM2T+vNRWjV5Ja6Wettm306eR/OH/wXf/ah/wCCmv7Cej+E/wBpf9kr4geF7r9n2YDwj8UPB/iT4Y+DvE2rfD/xQwz4b1469KxeTwx4yXEckzgf8IZLAxKq3jAJH/L/AP8AETt/wVu/6Kv8L/8Awxfgr+WcCv8ASP8Ain8L/AHxw+G/i74U/EzQNM8Y/Dj4h+GtU8K+KPDV6u7Stf0fxAqhkIU85AYggnDtuG8DDf5TP/BVv/gnT4w/4Jw/tUeLfg/Ncapqfwl8WHV/FnwY8X3oIOv/AA+B6c7SPEvg7H/CJ+PCOCMMCQQT6HA39iY2TwGYZVGc9WnJR5kk1e129VovNLVHNxNHOMIljcDmj5W7OK2tora6O9/6aP6yP+CEf/Bd74g/th/FzxL+zX+2drPhofFrxCsevfBnxdomj6L4W0zxEYnV9d8Ca7oPh+TyY/ErAP4o8FHyvNmjPigGUeRGo/ryyFA6n071/iceCfHHjH4Y+NvDfxA8AeINU8L+NvBGt6T4t8MeJNHvR/avh/V/D/8AyL+u+mR+Ff6q/wDwSI/4KN+FP+Ckn7KPhvx/PcaZafGjwQum+E/jp4OsAqnTfGDJsGvroxIaPw74wjJ8UQ4dAqMUyFRAOfjHh9YGUcbgValK6lFbRd0lZbJPaSWidmlqzo4Zz54xfUsc0p2Wslfm21767q/lqj9G/jR8Y/AHwA+Fnjz40/FHXrXwx8OPhr4a1fxZ4z8SXn+r03SNBHmPI4GMnAIXj5nKqSodnX/O6+M//B0T/wAFF/EvxU8f6x8F9f8AAfw6+E134n1f/hX3g/xL8MfBXinVfD/hLj+wB4g1/wD6GU4G4cq2ORxX1n/wc9f8FR7nx94+P/BPL4L+IM+Afh9eDXP2gdYs7zjX/iCOdA8Ck558N+D2YkkYH/Cc7RjPgrc38fFe5wfwtgpYJ4/MopxeijOKaikla6ldXe700Vla6d/D4nz7GfXY4HAPbqna9/TorNb77ef9NnwD/wCC+n/Baz9qH4yfDn9n/wCE3jj4X658R/iF4l0zQNFtf+FG+Ck0tVb7+va66srR+Gscl0KsMBtwIr/Qv+GWl+NvDvgDwlo/xH8U23jvxrpHhzSbXxl47sdG0nwrpniHxPHERr2up4fhZl0NWcNIIQdvlyYaISDB/mi/4Nt/+CVNv+zP8ILb9sf40+GPsfx7+NWi7/AWk6xaFW+H3wo10KyADZz4j8ZDc7sHX/ih4/CaFXVpAv8AVcZQQCo/QjI/P9frmvheJMRgVjngsvhGMYuyaSSvonqlslZO+vNdW91X+pyDD4xYRYvHyld9He+63V/O9+3zLlFFFeGfTblbHGP5/wCPX6V/G5/wX2/4LHftz/8ABP79r/wV8F/2bPG/gTQPBOrfBnwt48vbLxJ8MtE8U6r/AGtr3iHxJ4c3HX/ERIAb/hHy+OoBw4ByK/sqA4K8jGRnHXOea/zkv+DsgY/4KJfDYf8AVq/hP/1OviJX0vB2DwWOzpQx8U4NSTUrON7wSVmmmuVyTT3266/L8T4rF4LKW8Emn1adnb57aPRWurddbeBf8ROf/BWb/oqPwn/8Mb4M/wDiqX/iJ1/4Kzf9FR+E3/hi/Bf/AMVX8+VftTZ/8G9f/BV/VdNt9Xsf2bxdW2rWf26zH/CwvBPBPQH/AIqjjtgY9OxFfreKyPgzA2eOVON/hTsk3ZNaKyto736J9j86wuLzrG6YJyezfW+1/wBT2L/iJ1/4K0f9FY+E3/hi/BVH/ETr/wAFaP8AorHwm/8ADF+Cq8v/AOIdr/grZ/0bUP8Aw4Xgn/5qKP8AiHa/4K2f9G1D0/5KF4J6+n/I0VzcnB1tI8MWtppHmt92/wCp1pcT3V1LdX37xv8Am/vR/e//AMEdv2mPjB+2L+wR8G/2gfjrrOma98SfGlx4vOt3mjaDo3hnTM6D4g1zw6vl6L4fJhUfuD5kXLElJMoQC/6phwTjHcd+/bI7V+TX/BF79nb4v/so/wDBPP4I/A/46eFx4R+J3hO48YS61owvdF1QWX9veOdf8Qoofw5+52sspOGKlvlYHaGI/WTYFO4n9Pyz61+I5n9T+vZmsFy8vO7KPw21tZbWttbS9raH6tlntFgovF/Fpfm76W3877akghyAc9ff/wCtR5Hv+v8A9auJ8YeMvCHgjQ7nxL418V6B4M8P2SgXniXxNrOj+G9I05SDzLrOvtFGpODsYkbsEL0wPmSH/go7/wAE/b7Uv7Ht/wBtj9lS41I9bMftA/C0H/1KMd8/QfWuSOFxkknGMmv7sZO33RdrdrnT9Zgt5R+bj5ef9X9D7Zo6VxWheJfD/i/RbXxF4Q17TPE2ianGTZ6v4a1jSNV0u/AHGzWIvMEmAcHY7MuQB1212h5BxzwelW01o00+zTX5lXT2afzKxYAA84z6/XOc/wCelfzZ+Jf+Do7/AIJs+Ftf1vwvf6R+0AdS8P63q+g3wtfh3ozD+09BwZEH/FVjhivBIIUD7pHFf0XTa5pECGCbVdNUnPBvULdAOgYgcc4zX+Ll8Zf+Sv8AxR/7KD4s/wDT74jr6/hbh/CZvLM1jozUYQpuD96PxJp7aS0S0aaV1pdny3Eua4vKYxeCad7X1T1uvu0s9z/UP/YT/wCC2/7HP/BQ74y6l8EPgBZfFC18X6V4M1Xxzet488LppGmLpOhyeHVYq3/CRS5b/ioI/l2BWaNSxAJx+0n3gCeAeo9ecDnr1r/N3/4NULyCz/4KP+Np724trW2/4Zl8fH/SzgjHiD4csRk9sDLAYJXIGSef9G2HVtHv5PIstWtrifGSlpeIxx3xsZh9AM9K8zibKsPlGNeCwMZOChB81m0m273lbslo9dezSOrIc0xWa4NYvGtKV9E99UrO2/kvS5u0UVz2papp+h6bcavq17aaXp1nZ/a7y9vb0afptkgGSXYn5RnJbdnJ/wBpwp8JJvRK78ke+2lu0vV2NnyPf9f/AK1Hke/6/wD1q+NZf+CiX7BEGsDQJ/2z/wBla31n7WLH7C37QPwtEm/qBz4pVRxxg7cN1IAr6h0DxL4f8U6Pp2v+G9X0vXNE1SzN7ZavpF8up6VfoOEaPXELKVOMKThgAQcY20/qslq6cku7jp0tqo+enoxfW47e0WnTmj5dOb+r+luxorm5td0C3l8ibV9Ntro4OBern9So9Mgmp7PXdIvpPIh1bTLm4xytpeKxwP8Adc5P4/QU+Se/JK3flf8AkHPDbmjftzL/ADNQ8gjPqPyr86/+CgP/AAUl/Z4/4Jt/D3wT8Sf2hIPGQ0P4geMz4O0T/hBfDL+KNUOrrora+26FSqkYUBGyc5JAXALfoNPe21lB9ovJ7a1g7vc3Srjn1fg+mAcjHNfyC/8AB3jqmn337KX7K8Flf21yG/aD1U4tL1c/8iF4gGCVLZ5z1PUHHGM9GQ4SWNzeODxik4Skk5JPlUWr3TW3vWWjv1vujzc0xaweDeNv7yW3VvpZX/rQ+ox/wdW/8Ezx00j9oz/w2Wi9/wDubP8A9VfvV+zr8d/BH7THwN+GHx++HX9qW/gr4reF9J8YeGzrFk2mat/ZL7to1pWZ8HhhtzjBGOrY/wAYuv8AWY/4I3atpEH/AAS8/Ynt59Q0y2uP+FE+EuBer/tZ6468Z59O3NfY8X8P4TKMLGWAU5OTV3eUr6bO7dtdOre2p8/wzn2JzbFtYy0FrbRRX2drWXXy00VtE/1gorNiuLe4h8+3uBcwdvsuDk/QE8D6+laVfCaq1007apqzv6H2nS/Tv0+8r+R7/r/9ajyPf9f/AK1cD488f+APhnoFz4n+IXjrwv8ADnw9ZjF34k8Y+JtF8NaOnA+WTXPELxx5AIx86kjG0nv86ab/AMFEf2Cdc1BdI0n9tD9lXU9Suhmzs7T9oH4XM96MdEC+JyC38JxuzjjPeY4XGSV4xnJd1GTW9t+W3493snaPrUE7Ocb9rxv06X/q/pb7RorntO1DT9bsrfUNLubXU9NvbT7ZZXtpejUdNvlfgbW5DjJBG09c/wASso6Graa3TXroUmns0/R3CiiikMKKKKAKzY2nPTqf596/Af8A4KWf8F9P2U/2ALnW/hbpl3cfHb9obTB9gvvhX4O1ZNM03wfqjIwC+P8Ax4zSW/huWNvLb/hFsS+NJMMBAoIYfK3/AAcQf8FhNX/Y28FWn7LX7OviJtN/aO+JeivqHiXxdpLI2pfCL4fyOsgkA2k/8JN4sIKQAMAqFiQxKlf8728vtQ1W8udQv9QutU1LVr37fe3t7ejVNV1DVu/+c/T0r9B4X4UWPSx2O0pK3LBJpu1m3J7pdrWfW7TsfB59xP8AU28FgtZK6bum9N9b37rZdt9D9/8A4+/8HL//AAU++MWo3I8HeP8Awb8CNDvP+PLRvhZ4L0Q6rp+ev/E/8S/8Jr4r56kcDvjOa+KP+Hzn/BU+e7+3f8Nv/Hfz8Yx/bQxgdBjp0wMdvSviD4QfAj40fH/xhbfD/wCC3wv8ZfFrxtd/6f8A8I34P0TW/E+qke+Bj6//AKif1Ug/4N7P+Cs9xoQ18fswanbH/oWrv4heCDqv5DxR9f0r736pwXglyvkTaUVpFdVpZrun+fU+RWKzvGfz9G1Zrtv5tX87nsX7Pn/By/8A8FP/AIL6jpy+MfiB4N/aA8N2gIvdH+KXhfQxqt/6Ea94cHgzxVxwVyCM9jyK/r+/4Jpf8F1/2UP+ChqaV8NSbr4K/tG3Fiq/8Kr8Ya0NQ0zxDqawhM+A/HaBYfE5LgsY1SDxioc4izGpb/Nl+Pv7Nnx//Zf8Xj4f/tCfB/xj8HPFh/4mFlpHi/RhpY1AHGP7AIBHiUHjnpyPbP0z/wAEz/2Gfjx+31+1D4T+F/wJ1DU/Bv8Awj17pHi3xn8U7Ia0D8IPCY1zjxyMEf8AFT8/8UEDjJ5J9PIzfhnIsTl8swhKFK0HJTjyqNklZuKdmraa7rZp2Z6WVZ5nOFxqwM4yaur3V+2qb187W738/wDXwHQYorzfwR4bl8G+DvDfhqbXtb8UXHh/RNJ0G88TeJLxdT8Ua+dH0WPOta3II13eIp5V8yU/MWZlcgqVC+kV+MvRtXvZv52e9j9XT0TfZXK20e/5n/H2H5UbR/kn29/YflXK+JfFXh7wfo93r3ijWtL0HRtLUNe6t4hv10zTbENwS2tTKETLfLubJOCGKkYr5Zuv+Cj3/BPiw1H+xrj9tr9ky31M/wDLm37QPwsBHHfb4oA/AULCSdmqcmn1Ubr71HdX6fIX1qCdnKKfa6v/AOlH2zRXnPgP4gfD/wCJugW3ij4e+OfCvxF8PXvy2niPwP4n0XxPo7HB+WPW/DkroSwB3YdiADur0ahprdNeqsNNPZp+jT/IKKKKQwooooAKKKKACiiigAoPQ/SijpRv5+XcHs+nn2P4cf8Agtf/AMFtv2//ANi79vzx/wDAD4A/EDwZoHwv8PeDPh5qOjWurfDHwX4l1RtX8QaB/wAJB4g3a94iOSMcKG3YwvdRj8stH/4ObP8Agq9favp1rP8AFD4YC0vL3SrE4+BngvqxyTkEHk88dM8YzXO/8HNBz/wVm+MBHAPgj4TkD/uRPDdfhF4c/wCQ/ov/AGGtJ/rX7lkmQZLPI8rnLKISlOneUrK7fLGV23dtX1W+ystD8ezHNMaswzSKzayU4+7d7KUdEtErJWX4H+2ypyqk91B/MUtNT7i/7q/yFOr8NP1+Pwx/wr8gooyB1OKzLq+trGE3F7cLa2/AP2sD174P6E8jpQtXZat7Jb/cNtJXbSXduy+8+Bv+CgP/AAUJ+BH/AATh+FnhX4wfHuDxhdeG/G/xB0v4a6M3gTQ28T6sNYfQfEPiNFeHKZ2RaBrYLFtx6fKc1+Tx/wCDrP8A4Jnn/mE/tGf+Gy0f+niwV45/wdw6rp99+wJ8AoLHULW5z+2H4R4tL0ZGfhR8ZuPlyDjPOScHPUYNf569fpvDPB+EzfJ5Y/HKUZpysm3F3i7JuN1vbqvM+EzzPsZhMbHB4J6e7d72V4vV9rX3v230P9l79l79oTwB+1l8APhf+0l8MoNcg8FfFXRDr3htfEFmdM1f+zF1l9CY6xCd2yeRtEztLuTHtyWyCPpcg7MHOR2/HgV+OX/BDHXLCD/glD+xRBPq2m/aP+FYaoD9rvFwceOfEp5JYHgEfjt96/X6K4gvoPPt7gXNuen2TnPf1yev1r86xeDlhcXJOMoxU5RTcWlaMmr3aV723PsMLivrmETuua13rrdqKta72/E0qKTI65GPXNeHfEn9oX4H/BGyt7741/Gf4TfCK3utos7r4o/EHwZ4CjvTjpFL4k8Rw+Z/tFR8pGCF6HBJvZN+ib/I6rxjo2l6tL8z2k9R9f6H/AV/N7/wdJ/8or9c/wCyz/CX/wBPjH+fNftL8M/2vP2T/jdq48P/AAb/AGmPgT8T/Eqpn/hHfAfxc8EeK9WwOx0Lw74nlkY55ztb1yTmvxa/4OlP+UV+uf8AZZ/hL/6fGr28ghJZ1lHNGSTqNvmi0vhS69NHr6nm5pJf2TmjUk/d0s12iraP+rn+alX+nl/wbO/8om/g1/2PXxd/9T3Xa/zDa/08v+DZ3/lE38Gv+x6+Lv8A6nuu1+heIaSyinZJarZJfZj2Pzrg5t5vq2/i3bfSPc/oGooor8gWy9EfrIUUUUwCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAqrCcEscdT17flnj+WK/gO/4Oy/20J/G/xs+D37FXhXVgPDfwf0b/hbXxQtLRs/2l8QtfUx+HNFYjAL+EPCqq3QH/i4wB4Wv7pPiZ8TPCXwm+G/xA+K/jrUbTQvCXwy8M634s8U6scEWOjaDo58Qa02cdolPAxuY5Yg5I/x6P2tP2jPFH7W37S3xr/aQ8Y/6LrXxY+IOreLPsfP/FPaT/zL+g5x/wAyd4Y/sDwlk5z+dfc+HeVfXcf9dktKeqbv8Uvd0b2ajdX/ALy+XxvGGMWFwawaerV7J3dnay2/rXzMT9nD4Ia/+0l8fvg78APBx/4nXxi+IPhTwJZXvQad/wAJBrvOu9cYxyf/ANZq1+1F8CNf/Zl/aK+Nn7P/AIqP/Ey+DnxB8V+A/teP+QhpGga7/wASDXfb/hMfDA/4S0DH5V/Qd/wau/so3Hxp/bc8X/tH+JNJ+0eEf2ZvBLX2i33Hy/Ffx+D4e0BucjjwuPH559snB5P+Dqj9lf8A4VJ+2p4P/aH0LSPs/hH9pnwSBrF9Z5Jb4r/D4Dw7rzE4GWbwt/wj5PA5J4r9G/tj/jJlkjkuT+bm+1o3HqvhV7PWy0PhVlUnk317XV9U72dlf02+7sbv/Bqv+2HcfB39sDxt+yh4j1gf8ID+0d4XGo6JaXeP+Jb8WfAAI0AruHH/AAl/hc+IAQeCf+EUXODX+iixBXjnPT9P8f8ACv8AFd+Cfxi8Yfs9fGb4XfHDwBcfZfG3wn8Z6T480bP/AEFvD+ujtxx6+ue9f7EP7Ovxn8H/ALSPwR+F/wAePANwLrwn8V/B2i+O9EbGMxa7owZQSM/dDMuc84yeuK+B8Q8qeBx/15Jcso66JLmVkr27x63t7qWl1f7Lg7FKWEWCk7tNW12vZWV9eq89229z2yee3sLe4uJ5hb2tsPtV3c3Bwqrgk5OQAuBgkAYwAoya/wA6f/gr5/wcIfHn4+fEfxb8EP2NfiPqvwl/Zx8PXmqeHz4+8CX39nfED4v4BOva1/wke0N4e8Lgs+0+EcudzFiSSR/bt/wUrvfEtj/wT5/bUv8AweJzrVr+zH8b30/7CB/aQK+BPEQ1rZngHyVckpwNpPA25/yAarw8yrB46csdjvecX7sXqk2k7td2n92iSZPGGa4vCKODweiaXNJ6WTsvi12Sbatpazet1dvL7UNWvLnUL64utU1K7vRf3t5eXv8AxNdQ6fXv/PjjFVYJ7iCb7RAPslz9Mfz/AKY6fSv6y/8Ag2a+NH/BNv4cy/Fjwv8AtO3Hwu8L/tIeIfiDpI+GXjv4w2eiDwsPh9/YQKaLoGveJGXwp4d8SL4oGv703IXjPhbaxZRG/wDXr+0r/wAEvv8Agn/+294Wuv8AhZ3wK+GGrXPiGxzo3xT+HOjaD4Y8fx8DGtaB4/8ADQEnzZJXO8n5ucbQfqM04ujlONeAxuS3pq0VPlSTvGLvF2s0lu7p3T0srvwss4beMwn13B5w+Z6uDbTTdk1bR/pr6o/gA/YA/wCC7P8AwUA/Y88X+FfCv/Cc6/8AtPfCY3elaAPhD8Rr3WfFOr32c40T4f6+4k8U+HPEw6gMHXIBPgBhX+mB4Q+JdrefCXQ/i1440fV/hRbXfgCPx34n8O+Ov7J07V/h/po0Ma7ruieIBGAqf8IeCyzPhVVOZPk3Bf59v+Cbf/Bu78H/ANhr9qPxV+0N8QPH8vx0bQ9cKfs46Tq2g/2avgrTRH5h8ceP3CtF4i+JmCUWbDW3mr/wnBcTtFF4L/T7/gsjc+JrL/gl9+3DP4N+0DXV/Z+8XLi0Hz/2OEj/AOEi2jAIH/CMtree2MAgHFfneeYnJ83x+VrAwcL8rm1ZXk5RT0W9k9W0tdLdV9lkmHxmVYKo8ZJy+K19Wkkmn19bXsrO3RH8SH/BWX/g4D/aH/at+I/jX4T/ALL/AMQfFHwb/Zetb7VtC0a98H3g8L+P/ihpWcf23r+vqkfirw54a8XrhR4TxkoFDMWr+biae4nm+0XFx9qubv8A5ff8/wCeOaZX9j3/AAbNfGf/AIJpeCfAvjzwT8fX+D/g39rHxB8QXvfDfiz4uWmgKPEfw8k0Lw2vh7RvAfiHxMv/AAjHhkxeJh4gZfCcM0TZzkSHaF/WMTHA8O5LF4PJ3N2i2+VSd24pt+631vJrom9t/wA7w7xvEOOaxmb8ivortLdWW6tbou7sfx2wz3FjLbahY3F1a3Nr/p9jeWeP+Jfx2/X8q/ev/gnH/wAF4P2/v2cPHfgr4Xa74g8ZftZ/C/xDrWkeE7H4Q+L7zWvFPxWvm11v7ATRPAHj5lbxUfE8b4dNwZQ4BIPNf3VftXf8Elf2A/21vC2qWvxF+A/gHS9c1a1Y2HxU+GGkaR4D8fWZZCy60viLw4mPEBDFcDxWtyiorAoGPH55/wDBLD/g3v8AhR+wD8a/Hvx/8e+Obf46+NtJ1vUrH4AaxeaEdMbwB4TYLINa1zQ9jwyfElwSss0TOEAZUZZCJIvlcVxfkuMwUo4zJoqok1y2SfNy2V2ldO/lfftr9LheHM3wmLjLB1LwbV5OWlrxb3bW3a3brZf0R+C9bufEPhvRtXvtA1Xwzearo2maheeHtbXOq6C0gib+xtZHmHbrsfmFGU5wygAkgM/88H/BbT/gun4f/wCCf9nP8Af2fF0vxj+1Vr9ib67u7wLqfhT4QaQSR/buvqNw8ReJCACnhHdvAKh8MpA/bz9qn4+aT+yt+zr8bPj74jiF3o/wg+Gfi/x6bQkIdS1HQdHzoWggRlX3+KfEJWCORWyGdC+CeP8AH0+Mvxh8ffHX4p/Ef4zfEzV7nXPH3xM8Tar4s8T6vdgAX+q6+MAADgYHTHAHQengcHZDHOMZLF4xfuabXu73d00nvpGNm03Z8yTuua/qcT5pLBYSODwb/eSte299E7ett/u2TO3/AGiv2qP2iP2tvG1z8QP2hfjB4y+LXiT/AJcv+Ek1r+1NK8PjJ/5AGgceE/DXp/xR+fpXz9X9JP8AwQ0/4Ilaf/wUOh8R/H/9oy/8U+GP2cPBWtHwlouj+Gr3+y/FXxP8VgH/AISAnXs7vDnhjwedqgIrOzMoCkbiP619d/4N2P8Agk1q3g6fwxb/ALN40K4Nn9h/4STSfiB45i8WaeORxrr+KCwPbDY69a+1xPEmTZRi/qHs3JRajJxhzqLdrKy1vbWyT3t1V/jcNkmc5qvr3tOXZpOdr7X8nra63/E/zy/2Nv8Ago7+1/8AsJ+I7fXv2e/i/wCKNB0Q3pv9a+G+sXx1P4WeIOCP+J74DBBBwThlII4wRxX+lF/wSr/4KdfDH/gpb8AV8feF49M8IfFfwVLpGgfGP4V/bzqUvhDV9qFdZ0R8ky+F/FqrLL4HkOGMKAOsrK7S/wCeR/wV2/4Jua1/wTN/afuPhTD4g1Txh8J/HGiHx38J/F+rFv7Uv/Co10q2g66zKhbxH4PIIWQookUhwNrDPbf8EHP2pdX/AGYP+ClnwBmj1a4t/BPxt1zR/gT40smvAdKvtN8eMNA8ONgjG6PxUvh50OMq6hhggERn+UYDN8mWZZfFKTipKSXLzR5VaMrpXVtubVPotUdeVZpjspxywGObavbva9rapvR3/pH7O/8AB4ec/F39h4/9U++OH/p++Hv+f8a/jVr/AFbv+CkX/BHb9nH/AIKf+IfhJr/x08bfGHwfc/B7SPFui6P/AMKt17wZpf28eJ5NAllOuHxJ4R8Z7wh0MeWu1MjhmUgbv4Qv+C5f/BOL4Lf8Ezf2lfhN8IPgd4n+I3ifw342+DGk/ErWrv4kXuhatqp1X/hOviH4eBH/AAjPhjwYACNB3ds5/GsuB89wKw2WZJZKd5Xbi/PTmt+bv5dnxRluOeLePu+V68relm9Lq9nba9nvqfidRRX+h/Zf8GlX/BPu4tIJ/wDhc37WIFzaBf8Aka/hhnG0HJX/AIVVgHkYGTkd6+mzjibAZSnDHwTclJQtT5tlZ6qLto1rp5LRnhZTlmOzWSeCk4qLi5a22abvex/S58GefhP8L8dR8PfCX5/2FoY/nXwN/wAFWv8AgnV4E/4KS/st+J/hDqlvpWl/Evw9aav4q+B3jC6VA/hH4hoqsqybdzN4c8Xxn/hF/HCEqTbyEhGK5P6R+FdBtfC/hzR/D1jcfaLbQdG0nQ7U3J5YaDGYgzEDglVGODt2LzxmupuGA4PqB7YP8+vQV+AUcU8LjvruDdn7Tni1672vfVaSV7tNr7TR+0vCrE4F4KVvhSd/RJbd9Gt11tqf4qfxa+Ffj/4IfEjxt8IPiZ4XuvBvxI+Hus6r4T8TeG7zpYat4f8Af/8AV0zX0h+xF+3n8f8A/gn9488beP8A4BeJ7bQtS8b+CtV8C61Z6vZHU9K1H+3+fD+uf2ACCfEvg7xMP+Et8CA8EZVwQSD/AFg/8HVH7DPwht/Avgn9u3RNf8L+BPivceJNF+GnjPw9fMfM+MGlHcNA1zQ1x/yM3g0Kp8wMQ/gguuFMZ3fw2V+75TicJxHky54+8mlJSV9VZS0fRtd3p0Wp+O5phsZk+NdtVfdPXo1Z2dmls+mna5q67rms+Kde1LxT4j1i613W/EN7quva1rGsXn9qapqGra/g+INe19s8Hr2H6nH9BP8Awb8f8Es5/wBu79osfHD4q+F/tn7MH7PusaXqHiVNYsv+JX8QfiCgB8P+BADx4iVcr4r8ek4RcouQfGyg/ih+zh8CfFH7UHx9+E37PHg/WNB0HxJ8YvGek+A9G1jxHeHTNL08eIO2FGSenA56YBr/AFw/2Mf2Svhh+xB+zr8OP2cvhNBdnwn4A0VLS51W9sol1fxb4pKxr4i8beIGRyX8R+LZP3srhiPnCKZAAD5PHWerJ8FHLsDZc0Um0rWjopP79Ffd62dmerwfljxuMeOxrb1Xut6Nry3v1266LU+vRiEDHIxx3AH6elWaKK/FL3s3u1/Wp+spWVlstEFFFFAFev8AOZ/4Ox/+UjHw3/7NX8K/+p38Ra/0Zq/zmf8Ag7H/AOUjHw3/AOzV/Cv/AKnfxFr67g7/AJHtP/r2/wA4Hy/GH/InXy/KJ/LrX+1l8N5FPgXwQCcEeDvCo9uNGj/Dv17c59/8U2vZof2hf2gIIvs8Hxw+MnYf8lO8bfh/zNFffcUcMTzhwcakYW3vFy5trbSi1bR31vofCZDnqym6lG+ydvOy7Pf5dd+n+0N9oUdAg5PXj374/n/KlBVs/dPuDk8fgPzzX+Lx/wANC/H7/ot/xk/8Of42/wDmpr9Q/wDgiv8AG/4z+K/+Cp37GOi+JPjB8T9e0PV/iaRfaPrPjPW9U0nUM+BfEQIIPicjgdmB9xjg/J4vgOWDwTxzzenJJNuHs229E7XdRrol8LPp8LxisZjFgXlW7S5m9Fsrq66Ls/xbP9UbgDPoP0Ffgh/wWj/4LBaP/wAE2PgrpekeAYdA8VftQfF621hfhh4d1eRZNI8J6XbyPHr3jvxGwjiZfD6FQfBUJjX/AITO6jaIFvKLP++eCT3PAwe3+GOvTr261/mdf8HSM3iib/gqRrVtrguBotp8F/hQfBn2rhTpbaH4jLkAevik+IGJPJ6nk8fOcH5Xg82zpRxvwpuy2T5XCyfk21f/ACbT93PsVi8JgL4O0W009tNE77dOvbtrdfi1+0h+1r+0h+1742ufiB+0X8YPGXxQ1sXv+hDxJrQ/srw8McDQPD//ACKXhoYOPTt2GfnaveP2Xdb+C/hz9pD4J+IP2hdHuvFHwL0n4neE7/4naPZ/8xDwn/budfyOPrxjj86/1V/gAf8Agmn+178IbbSPgb4V/ZM+MPwbTRVsv+EO8M+D/hfq2j6HpzptKa14E/4R1W8OqrEKEnt4lZ2DIMkMv6xmmdLhxwjHJVKntzWsoxVldNRevlt2aPzvLculm93/AGw4zv8AC5NPmvF2euuumivdbbn+V1+zt+17+0x+yV4qPjD9nP44eO/hNqX23/TbPw3rX9maT4gHT/ioPD//ACKniT16ehNf6Gv/AAQo/wCCp/x2/wCClfww8a6b8ePgvead4j+D/wDZOn3/AO0B4OtotJ+F3j/VHaNJNI/sGZ0Tw98RbdWMtxF4S80NGTsj8GOscEnzp+2x/wAGuf7MHx28ceE/G/7MPi8fsv2t34m0c/EzwLZaKfE3gHUfCrOV1/WfAfh9v3fhrxSQYvLHmf8ACESFzmKEAbv6Kv2a/wBmX4UfskfBnwV8C/gn4ZtfC3gPwTYDT9GsshtRu/kDSazrk6wq/iDxCzIGkmlUMxCkFNsSL8bxbnmS5rhqc8FTUKiau3BRlBJxlKLau2vJNpvXofUZHlucYTFS+uzvGzSbldPZK3nu73v95/k1f8FDv+T/AD9uL/s8P9pv/wBWv4lr42r/AEhPjN/wa8fsOfG74tfFr40eLPi7+05B4s+MXxB8W/EnxNb6H4o+GOl6TY614+1zX/EPiH+woj8LJPKVpPEEo5klCrGmWZpCqf51fjzQrfwr488beF7G4urq28PeKNW0Cy+2f9S/rvGOvb9eD0r7vh3Ncvzd8mBS5qcaftFytP3lZO70d3F7Seqs3dXPj81y3HYR82Obacny66NJ3Xd9u2lrHH1/SF/wayf8pQ9N/wCzf/iv/wC65Xxz/wAETP8Agn/8H/8Ago9+1nrfwH+NPifx54Y8JaT8JfFXjuxvPhXfaHpWrDVtA17w4uCfEvhjxmv/ADMGTxnsMniv7mf2BP8Aggz+yj/wTv8AjzbftC/BXx/8dfEvi238Gav4QWz8fa94J1Pw0dJ17/WMkfh3wl4NDMnDKPmByC20dfJ4pz3AYbC5rllv3k4vkfs2372l1JJpWdt2n5bX9LIMsxuKxax3M+RW0TdtLL4dNdV0tqraXR94/t7/ALb3wh/4J8fs6eL/AI//ABYl+0W2kolj4V8JWF2mmaz498WOH/sHwX4fLIV82TccEoyDBbadzIf8xz9vv/gqf+1x/wAFCvGOpax8YviBqel/Df7YL/wx8CPAl7rel/Cvw+Mn/mAcnxJ4mGTjxZ4wyfSv1U/4Okv2tdf+MP7dWi/s4afq2qL4A/Zn8GaTZNo1neAaXqPxE+II/wCEh8Q682O//CMf2B4SPXnOc81/Nz4D8EeMPib428I/Df4f6PdeKPGvxC8T6T4S8MaPZnOq6hq/iDXR4d8P6H+J5/IVhwfkOBwuC/tLHpXd3G+tl0STT1a37PToh8S5pjcXjVgIyaV4qybWumra6K1rXv2WrOOr9B/2C/8Agpx+1f8A8E9/Hen+Jvgh8QNUuvBBu2vvE/wT8R3+t6n8LPGAYYP9u6EpB8NeJznA8XIdw6g8Zr+1H9iP/g2F/Yy+Enws8OT/ALWfh7Vf2gPjZq1mL3xmb7xJrWmfD/QdXk2Y0bw9oPhuWP8AdxZbzPFLFZW2EoANnmeHf8FKP+DZj4BeJPhD4p+I/wCwb4d1/wCHHxi8GaNrOuWXwr/teTxR4W+JWmiNpf8AhHNEPiDz/EnhzxNGiSp4InW5ESzokCgvIoPVLi/hjGP6g6a5HLl5nBOL1SV9b2vfVpQtZ3UdSVw1nOEX13nbfL8PM3pZaWt9yun5u6P4mf2tPjTp/wC0Z+058fvjxpWj3Wg6b8Yvid4s+Jdlo95e/wBqar4f/t/Xf+Ej/sL8h7f0r9d/+DZjj/grZ8Hz6eCfiz/6gniSvwTmguLeb7PPB9lubT+fXnPv9OO5r97P+DZj/lLZ8H/+xJ+LP/qCeJK9LNIQWR5q1GNvZ6Oy2tHr10PNyyU/7ayq8pb66u1/d3Tdu+5/TH/wdm/8o6fhzzkf8NS+DyP/AAh/iRX+dJX+vH/wUN/4J5fCH/gpT8FvDnwK+N3inx54b8I+HvH+mePbW7+HF3oel62+saBo3iHw/FtfxH4a8XxKka+IZlKlCzZQmQMrCT+Ij/guj/wRe/Zo/wCCY/wV+C/xH+B/jb4x+MdZ+Jfxc1XwjrFr8VPFPgrVNLsdJOhN4hb+wl8O+FPBO3BXAwzZB3fKCAfmOBc+wEMNDLppe1qSqKD5HeWsptKVtLRVvesrqyd2r/TcT5ZjHiXjbvljHVJvlSst1r1ey18j+ZOiiv7gf+Cf/wDwbYfsQftS/sd/s9/tAfED4rftK6Z40+K/ww0bxbrVn4Y8UeDNP8M6fq7swP8AYMXiH4Vs4UYG1snOW3bVQk/Z5vmuByiK+vq/PpF8jlq05LSKdlb7Tsr2V7tJ/H5VlmNzWX+xS5bNN6223/B2/Ha5+/X/AAQsGf8Agkz+xMPT4T6qe/8A0O/iP/P+RX5s/wDBbf8A4LzWP7EX9o/s1fsxf2X4o/afu7IHxj4ivPM1Lwv8EdKKurs6mVh4j+IzqwMdowIiAEkpM7BIP1D8bS+Av+CQX/BMvxXD8P7/AFzxR4J/ZP8AhN4nbwCfHd7o+qarrmqDWZDoGh6y/h+PwdFOZfE/iBYJDGkDrA7kyiRIkH+Uv8SPiB4w+Lfjzxr8T/H/AIguvFHj/wCIPifVvFvifxJef8hXUdX8QH/ioD1xkZ/AcV+ccL5Rgs5zbM8fjL+y5pVI22fNPmWj6LS663SfVP7nPczxeT4PK8EvjcUpStduySt17+e3zXffHH9pL47/ALT/AI1uPiN8fPiv4x+LPiy5AVdX8X6z/aY00AYA8Pr08NBQBgYAx7V4jX9On/BC7/ghj4S/bx8Lan+09+1Hret6X+zjpGs6n4T8G+DfDl+NL1f4narojMmua9r+uAlvDvhrwnIpjiUKWkkBRMkGv6o/GP8Awbtf8EoPFXhG68L2H7O//CL6jcWP2G08YeHvHvjqPxRYA4O4SN4nKEAZyArZOMla+pxPEuTZRi/qCpOahaMuWF1F2W2mtlq+Xme6s2mj5nD8OZzm2F+u+1ceZu152btr331/4Zo/z8P2Kv8Agpx+2P8A8E/fFGm6r8BPivrlt4Htrs32t/BzxLe614p+FfiFTlWD+H+cd8+K/CHJHOMHn/Sr/wCCZX/BRv4O/wDBSv8AZ70v4veAoU8L+LdLbS9A+Kvw2vb0X+seAfF20zyJ8hUzeG5XieTwV4oG1ZowzMv7ty3+bb/wVT/4J9a//wAE3v2svEfwBvfEN14z8D6ro2meOfhj4vvLP+zNV174f667poaa/wBh4nSXw/4i8IsAcbvDbEZBzX17/wAG6f7U+v8A7Nv/AAUl+F3g86hdW3gD9prHwX8Z6N/zCtQ1fX+fh7rvTt4oHGeh8R8ZFcmf5Tgc2yb+08DFKXLz3SceaFk+VqybVneKesW9LXsdmRZpjMpx31DGNtJqN272ult5X22e2zP9RqikHIH0FLX4+fqyd0n3VyM9G/D/ANCauF8V+INE8H+HNf8AFuuX9vpejeFdF1XxDrl794WGlaHG2t6855AIEUZLLnpjHzEA92h+8e38up/rX53/APBVrxXP4V/4Jx/tt6hZZ+1H9mj4s6enHRvEHhybw8ec/wB3XST07c0sJh1icbC+icoQ3tpKUU392tmv+By4q6ws901Bet0j/K2/bR/aZ8T/ALYn7UPxr/aP8YfahcfFfxnq2u2FledPD3hMYHh7QR/2J3hf/hHwB/8Arqt+yP8AszfED9sP9on4Xfs3/DoW1t4j+JnibStCOr3YLaX4f0gfN4h13XlALN/wh/hnOFUEnOACTXzZX9QH/Bp74I0fxR/wUT+JHii+trW7ufh7+zH4s17RbsEA2Gr+IPHXw78OhR2yfDOv68vTv1HWv6JzXFLJshTwVkowV9FbSKXTRWtbtbW5+LYTDPGZhfV+/wBXe+qf6X1/4K/uO/Yh/YR/Z4/4J/8Awg034Q/AjwjaaXbLZ6d/wmHjC6tC3ijx5rCLs/t3xFrgIM0hZmO37kYAAAkAd/uKjrRX87YjEyxUpScm5t3cr7vRWSVlb3ei0Vlskl+5RjBKN0rJRWyWlkvLsfJn7Vv7IXwA/bY+EuofBj9oPwNpnjzwhdgm1+1BR4m8P6sI1Ca34f18oH8PeIwuNrxgHIGfl+RfL/8Agnz/AME9/gN/wTh+Ci/Bf4M6feXX2u8/tzxn478QjST4r8fawQyvrviF48rwDtHAKFSQxJG39CV287f6/wBfxobb3P06/wAh9PpXQsZjFg/qanLkunyNtxurPmS+V7aq+r6Ncv1PB/WljOWPNouna1r301+aXUgBBGQeK/m6/wCC0X/Bdrwh/wAE+LSf4FfA+DTPiJ+1Xq1j9ua0uyupeFfhJpALqNc8Qghj4i8RjIkj8JpIJOQJMYKt+xH7cP7SWjfsi/sqfHL9o3VdOttU/wCFT/D7WPEWi6Vcsmdc8VL8nh3Q+mR9o8SHREygDqGcxsjIGX/IP+LXxU+IHxx+J3j/AOMHxN8QXXij4kfELxPq3i3xPrF5/wAxDVvEHpzwPTP6V9Twbwz/AGxOWMxn8OmkndO0pLldtkmkrX6N3V9JI+Z4mz14JLBYK3M1q10SfzfTRu2l3roz1r9pX9sn9qD9sTxhceMP2i/jP4x+J+oi+F9Y2Wr6z/xSnh7r/wAgDw/x4T8Njjt6D1r5jr9c/wDgkb/wSq8f/wDBUD416n4fh1i68B/Av4ZDSb/4tfEi0sxqeq2A14Z0DQdAycf8JN4wHh/XySDhQCT1Ff276N/wbT/8EqdM8KDwzefB/wAYa9cNYrY3vi7WPib40bxXfE8klhJtIzjGwEY6A9v0TM+Jsjyfly5U1Jx5U1GMbK9rK+i26J81mmlY+PwuR5zmy+vKTS3s5NXWl9Nn0fzV2f5vfwT/AGhfjh+zb42tviB8Cfiv4y+E3ja066x4P1rWtL/tD/sP/wDQye49u/f+5n/git/wcLj9p/xJ4b/ZQ/bPGlaB8bPEKppvwx+L1kq6X4U+MGqISRoOuaApRvDXijBITc+zxsSGVB8278Af+C1H/BFHWP8AgmprOjfF74S6xrnjv9l/4ga3/Ydnq2rknxX8MPFLFgmieICVU+Ii4U/8IJ4q42tuX5gFdvwJs77UNK1K21jStQutL1LSb37fZXlne/2Xqun6txxjt+f9KWIwmScTYDnpxSdtJRSTTVr7q+jvdNb7pMMNisdw7jUpSbu/eUm2ujvu7338j/bpi27Rg56nt+fT/PfmpK/I/wD4I0/tlaz+3b+wP8EfjN4pv11H4jaTZ6p8N/ivfYVv7S8X+AWfQJ9bC4LI3jCJdD8Wh+AxuGHVef1mTp/L/P6fhX4nisM8Hip4OVuaDkpcu2nWz1s9Wr2drOx+r4TFLF4OOMsldXt91/Tfpe2yLVFFFYHUncKKKKBhRRRQAUUUUAf5gX/BzR/ylm+MH/YkfCf/ANQTw3X4ReHP+Q/ov/Ya0n+tfu7/AMHNH/KWb4wf9iR8J/8A1BPDdfhF4c/5D+i/9hrSf61/Q+R/8k/lX/Xp/lE/C8x/5Hea/wDXyH/pUT/bYT7i/wC6v8hTqahG1ef4V/kP8R+dOyPUf5//AFj86/ng/cofBH/DH8kUzyFBzySM++Rn29cfyr+a7/g6d/5RhXB/6r/8OPp/zMdf0psxGMdz/kfjXwf+3x+wX8Jv+CiPwNHwD+NWv+OdA8FP4l0fxWbzwBf6Lp3ib+1NAd2h2SeJfCvi9SoDNnbEXbcoJIClu/KsWsHjsvxrV405RlJNXdnFPr8+l72POzPDPF4N4NP3nHdPrdW+Xz6dj/IBor+pr/guZ/wRI/Zg/wCCZn7M3wx+MvwQ8ffGzxP4j8bfH/RfhreWnxT1zwTqul/2S3gb4jeIjkeG/CvgkLg+HcKdzbgTwvQ/yy1++ZVmmCzXBfXcEnFJ6q1k+Wyfu2XW9tNemtj8bxeFxuExv1LGvXTl1d1qra/c9310urIr/VP/AODfX/lEn+yUf+pY8V/T/ke/Etfgf/wTg/4Nxf2KP2xP2JP2ev2jviL8R/2i9C8e/EzwU3iDW9J8H+KfBOmeGNP1Ya7r/h7GgReI/hczE40MdGJBwMYZSf6OtV0LwD/wR7/4JpeNbf4b6hr3ifwT+yx8J/FOu+DW8e3WjajrGuamPMfQtC1tvD8Xg+KVJ/E+uRwyIgiZYnkkEwkEIHwPGGd4HOZQwOBXvRqqL91xfMmotJuKbu3uvW9rs+y4ayzHYJPHY1u1m11Vla1t7bevS1z8cP8Agu//AMF4b/8AZS1HUv2QP2RdR0x/2hvsbn4mfFQj+09I+F6NlRoGghWKv8SivOG/5EbKllDKNv8ABd8SPib8Qfi34w1L4gfE3xx4y+I3j/xDe/b9a8SeMNa1rxRquof9x7xJk/0PSq3xC+IHjD4qePPG3xI8f6xd+KPGvxC8T6t4t8T6xeY/tXUdW8Qa7/wkXiA/r+HQYr9df+CMH/BJ7Wf+Cm/xk1vUfGGrap4P/Zy+Dx0m9+JXiLRzt1PxDrPiFWbw/wCBdDcBvL8RgKSzlWKqCEV5CqN9Pg8Hl/DWXKdRRbai5zkk25O3e7bu0ox10sknoj5vFYvHcRY7lg5L3mopS21VtumnfzPxms764sby21CxuLq1ubO9+32V5Z8f2f8A4+3vnmv0o+IX/BWP9rf40/sa65+xT8d/G918ZPAV54m8JeLPDPjHxhe/2p4/8Hjw9kjQv7f/AOZl8M5Jx/wmI/Pv/f8A2X/BvN/wSSt/B58It+y9pV1/oRsP+EkuvGfjlvFZHYjXf+Em3Zz0AHt6V/FT/wAFvv8Agjzc/wDBM34heHPF/wAM7/XvE/7NXxfvdV0/wdq2rhjqfg7xcI1kPgXXWZU8xArf8UE6gA4YMFdWVeTB59kec4yGCdLkknem5wUJcyVrw3adm7bS5W9Gr29HE5HnWVYP4m07X5W3dO1r73v893t1/CKv9PL/AINnf+UTfwa/7Hr4u/8Aqe67X+YbX+nl/wAGzv8Ayib+DX/Y9fF3/wBT3Xa5vEX/AJFELbcy/wDSYk8G/wDI3Xf3vyif0DUUUV+PR2XovyP1oKKKKYBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUh4B+hoWrS7ivpfyufy+/8HRn7Xlt8Cv2F9O/Z58O6sbT4g/tWeJ28Oi1tVAY/CfwDs8S/ENlK8bXI8PeFDgDJ8RDcBjFf5xVftz/wcDftZj9qz/go78WhoOrjU/AHwId/gV4NFnfE6Vv8CSNJ4k17/wAKp/EGMdiBwMCvxb0HQ9Y8R6l/Y/hzR9U17U7v/lz0ey/tTVh+P+P4V+7cG5YsFkqlL3XNXd1yu7S01s00rK77bI/FM/xX1vObJtrZddmtLK+nXbrc/sc/4Ijf8Ffv+CaP/BOr9jXS/hh8RvFXxPtfjD428Y6z46+J91pHww1vVtJ/thivh3w7ov8Ab33SV8L+HtCABGSH+8BkFf8Agtp/wV//AOCaP/BRf9jbXfhR8OvFPxPu/jD4J8Y6N47+GF3q/wAMNd0rSRrCl/DviHRBr2SBu8L+IteBx2VeSMAfyH/8Kd+MX/RJ/ih/4Ret/wCNH/CnfjF/0Sf4of8AhF63/jSXDWTfX1mPtnzc3Or1Fo7RvH09dnprsdf9t476msB7N2tbSD2v5r8vXbQ89r/Qb/4NTf2wx8VP2VfH37JXiPV2/wCE3/Zt8Urr/he0ub0+ZqHwm8furBF2gkjwl4pXXUkBwvl+JPCxYjGa/wA/nXtD1jw5ef2P4k0fVNB1L/n01iz/ALL1X6Y/L86/VT/gh9+13/wxt/wUT+BfjbXdY/sv4f8AxE1k/CP4hXl5fY0r/hEviDwdd1/v/wAUf4mGg+LfofSuvjLLFm2Spxs3FX0euiStdX3vZ273t0OPIMU8JnMVqttGrau197J2T2+8/wBWbV9I0/XtN1DSNU0+11LTdTszZXtlec6be6awO5WGWGCsjAgcgEEN90j/ADMf+Cwf/BDv47/sM/Enx/8AFf4L+B9d+Iv7HuqXmq+INH8Q+G7Qarq3we0di6ronj4KSdnhPY2zxcQMhWBAZWVf9O4HI9DgHp/LPH88V+a/7Qf/AAVG/Yj/AGX/AI8eBv2cPjd8cvDPgv4jfEEA2dhf36DSvCIb5dBX4ga8sbf8Ix/wlagNF/wlLosj8OSp3t+OZFmeNynF3wMZSSirx6Wvvs+l+7to12/Ts7y3B4zBxeNaUny2bfXSyvo2uvZM/wAjivq39nb9u39r/wDZRlt5/wBnr9pD4n/DDTLW8+3N4a0jxPrZ8KaiCCCP+EAOfCeD05znPev9NP8AaE/4I5f8Ey/2s4bjxP4y/Zo+HMGt+ICdQPj74VoPAXinUvlAGspr/wAOHj/4SF2baUMhkUr8pbcQw/jx/wCC1f8AwQb8Af8ABPH4WxftLfAL4r674n+F2p+NdJ8Jax8OfiLZ6Q/ifQdT8QM6eH9d0LxF4diiTxFoCvG4kgHgyRosLvYeYoH6dhOJ8oznkwVWlKE52i1UjdylZcyclzJfaWr12V3a/wAFiOGs3ylfXadSLildKMklrZrS/wA7/fax9/f8Ey/+DoXX/Enjbw18Fv8AgoTYeF7TTfEV5pmgaN+0D4Ps/wDhGE0HVpB83/CwPDuSp8N9ceLfCKsqlmZo2JFf2beK/Cvg/wCIvgnxL4H8Q6dpmu+CfiF4b1Tw/wCJ9HvMX+leIPCuv6I+g69ozbSGZJ/D7bGCht4cnaQXav8AFZr/AFsP+CNnjXX/AB9/wTD/AGKPFPi+e5udbu/gV4TsDeXQG5tJ0Dd4e8PkkEYz4b0TQ2IPOTnqxr5fjjIsFl8qeNy+KTlJWhHT3rc11FWS1i72tra63Z9DwzmuLxsXgsc7rl3et17t7u6v5aL5q5/Ah/wVl/4IoftDf8E//iF4t8b+B/B+u/ET9ka61jVNQ8HfEPSLRdWbwXpLjI0H4ghSf+Ea6EDxd0O04JFfh9X+t38aP+Con7CfwT/aX8M/sk/FT48eGNA+LHjS0Y3en3so/wCEU8JeftGiaP4/8Rm3k8NeFZfFSNMtsvimZFcMUdkRkMXmf7Qn/BEf/gmJ+0z9p1fxj+zP4M8L65qyC+vfF/wfJ+GWqXrDgAt4b2eF2U4GcxliTncR068Fx3jMJg6cc7yrnTjFRk1urJc1klutbxTWt0kt+TF8IxxblLATSd3dcystVvq9NXvst9U2f5rH7OH/AAUJ/bX/AGS5bYfs9/tH/Fr4daHaXv27/hDrTxNrWq+ACD6+AfEufCXT17Zr+t3/AIJcf8HOdz8W/HXhz9n/APb50HQ/C2ueK73TND8LfHfwE39meFjrLKwOhePfD7ME8O4LZTxX4TzCG2kqCqsn5M/8Ft/+CG3hj/gmr4J8FfH74PfFbxT4w+E3j/4gjwJfeDvHlnorePPB+ryaD4j8R+HseIPDqofEfhzZoGuNIpRWTcnUbWP84FfTfUcl4lwDx8YKL5HaUY2mmttbJ6Nbaq6V01v4ixmccO42OBcm9rtu615ejb21t1dtOy/1Kv8Ag4l1O/0v/gkv+1A9iBnVV+H+n3pB/wCYU/jzw40o9ssgJ569a/y1a/1Bdf8Ahd8SP29f+CBXhnwNfLe698W/ib+xL8Ptc0VrwKdU8Q+P/D3h3w74l0BzySPEXi9tCVC2AfN8R4ICkMf8wWaC5gmuLee3+y3Np/x+2d52yc/5/wD1GvP8O2o4bNsD7ralpfd25U3a+if5p20N+MbvFZTj7uzV3ZaK9r36XTbeqb1u+tvf/hv+0n+1h8OfCtt4X+Enx4/aW8B+CLS9N/ZeG/Afxb+KXhfwqMdv7A8N+J/69vXNd9/w2X+3/wD9HYftkf8Ah9fjb/8ANTX7tf8ABvb/AMFnvhv+xtp2s/slftQ6gugfAzxX4mbxV8PfiQAmqaZ8PvFfiEofEOh6/lWceGfF5UMo+VPBDryGbxiCn993ww+MHwg+M/hq28X/AAf+JXgL4n+GrpTeWWs+BPE+i+KdMbsG3+HpJMg9MPuYnknJ5yz3iWeVY6S/sSDinaM3JvmVlq7U7R95NNXutXs032ZXkn9p4T/kcON7PlbcWtm0tY7p389Nep/jq/E74m/tEfGm803UPjH8QPjJ8Wrnw9ZfYNFvPip4n8beO/sHT/kAf8JKD/Lrz2ro/wBl3Q/FEH7S37N9xY6Pqlrc2nxo+E/2K8+xHt468O9/f3H4V/qRftsf8FaP2I/2EvDOuXvxa+NHh3XPHtnaD+z/AIP+AdX0TxL8Ur3UAu1Yj4fWVm8OsuPv+LXgUAoAPleN/rD9mb9oP4W/tXfBPwF8e/hBr6a74E+JWhx63o96EiTUbPzirSaNrUe64eLX/DEu6F0kYvviYhWG2eTzpcdY/wCpNPJ4xi1ZSbktXa+jgltdrVt9d7nQuGcH9dT/ALWUnFp2TbbSa7vrZb9beh9JP9xPXA/qP/rV/npf8Hdv/J+P7PX/AGaTo/8A6tb4yV/oXy9B9f6tX+eh/wAHdv8Ayfj+z1/2aTo//q1vjJXy/CH/ACPaf+Kbt6wie/xPZZNHyaV+tk0tX6H8n9f7buj/APHpbf8AXoP/AEIV/iRV/tu6P/x6W3/XoP8A0IV9R4iWtlW2q18/g3/H8TwuBP8Ama/9u2/8pbfj+Jt15z438ZeEPh/4W1vxx431/TPDPhTwno2ra94m8R6vdrpel6DpOgh31zWZZAr7FjXcxPX7u0s7hH76v4bf+DnP/gq0Lu8uf+Cc3wH8QXX2a0/079qfxFo96P8ATRnPh/4TLgAYX/ka/HfHCjwoB3J+EynLJZtjIYOCdnJc0k7KMVrf1e0Vqr72V2vsM1zNZTgnjL+81a2zvpZWvt3tba2ux+Cn/BZb/gpZr/8AwUl/av1Lxhoeoana/AH4ZnVfCXwL8OXhx9g0rgeIPHZ0HP8AyM3jEADJP3V8KDIwMfkZRX9on/BF/wD4IB/Dj4+fsXfFD43/ALXejXFt4l/ab8GroH7ONk1ps1X4YfD3IOhfFZRsYt4o8Y+Iw7qnG7wMnLKnjV3T9txGLy/hfA04WW8YKMVrfRbJdtW+iTb0PyfD4bGcR4yUteXWWrdrf5+bfkj+MfTdV1DQ9S03WNK1C60vUtJvft9leWl7/Zeq6fq3H9eSc/nzX+mx/wAEHv8Agqrpv/BQf9n+18D/ABO1e2X9qj4KeGNIsPidbXZVdS8f+GWeOPw/8U9G3SHzGuAY4PG5W3YxeOFkUSJ5kaV/nW/tZ/ssfFD9jX4++Pv2cfi1p/8AZnjX4faz9gF3aAjSvEGkHnw9rugDgjw14x684IIAI7Vpfsafta/FD9iD9oTwD+0P8JdQ/wCKj8J3o+3aPea0RpXi/wAJjnxB4F188H/hGvGHHTGD06CuTibLcHxHgFVp8rlGHNFr3k9E0uZXdm0k7Xutruw8qzOWT49Qlde/ytar7Svo+uunbrfr/sqUV8hfsc/tX/Cn9tn9nvwB+0b8GdRurnwn410eP7Vpd46pq/hTV1ETeIPBPiBFHyeI/CUrvDKijJHQbZTj69r8LcXFuLTTjpZ7qx+1Rakk073Sd/kFFFFIZXr/ADmf+Dsf/lIx8N/+zV/Cv/qd/EWv9Gav85n/AIOx/wDlIx8N/wDs1fwr/wCp38Ra+u4O/wCR7T/69y/OB8vxh/yJ18vyify61/et4c/4NGv2V9U0HRPEE37VH7Rltc6toukXxs/7F+FwwToYAB/4pY9Qc5zjjvkV/BTX+tB4L/4Ky/8ABNCy8E+EdOvf23v2c7a4tPDOj2N7aH4h6IBldFXjrn7ozwcHBBzkZ+147xWc4SOUvAuVmteVOT0t0SfybW/c+M4Ww2Cxf9qfXrJaWvZWd189L9Ox+LX/ABB/fsn/APR1H7Qf/gl+Fv8A8y9fQP7I/wDwbN/s8fsdftKfB79o/wAK/tD/ABj8Y+JPg74k/t7Q/DniTR/Bi6TqL/2BL4eKsyxlo1Ua3kuMkE4C7gob9W/+Hun/AATL/wCj2/2cP/Dl6N/8V7f5yaT/AIe5/wDBMv8A6Pb/AGcP/Dl6P/8AF+38/U1+cvMuJ5Jxkqri7ppwbVnZO/udr/0j7FZdw0mnFpSTTTu07rltrZdbf01f9GicV/N//wAF8v8AgkTqH/BRP4d+GPin8GINPtv2ofgpYarYaFaXt4+n6X8UPh8qnxG3gRmVWx4jTxMmfA0sxVFkl8TJvZ5kUfuZ8E/2hfgd+0j4QuPG/wACPid4N+K/guC9fRG8R+D9YXVNK/tVSqtpDuo27wGXIySegBCEi78bPjh8KP2c/hx4j+L3xo8YaF4E+HHhKxOoa34k1i7Kx6eM464IzjOApJ65IBJHmYXEY3CY2LwakpprRKXNrZvRa663W97dj3cVh8Hi8Gli2uVKyk2rfffW1lstk+5/jb/Fr4O/Fj4EePNb+F/xo+H/AIo+F/j7w/e/8Tnw54v0X+y9V08HnjsQQOO39cXwf4x8YeANe03xh4A8YeKPAfiTSf8Ajy8S+D9a1vwvqun8Hpr/AIb9z/j2r/Vz+F/j3/gm3/wWM+Clt4msdC+E37RngjSS1ldeG/HXhbRz4++H+pKiqEm0SRpPFnw7l3ndu3ws6juI5C35tftPf8GtX/BP/wCMGm6jqHwP1fx7+zB42ulLaOPDV6PHnwuGqAZ3a98PvEnzkZG3Hg7xr4IJPTJGD+rYPjrCuCwWZ0ZRdoqT5XJK/Kr6rm03fu6K7u7H53iuEMUmsbl0490lJJ6W7W6aP9LH8uP7I/8AwcZ/8FH/ANmbUtNtvGfxHP7T/wAN7Q/6b4P+Nf8AxMtXv9KHH/Eg8fqf+EuB46f8Vue5BFf3zf8ABPX/AIKF/An/AIKS/Ae1+M/wXurvTdS0m8GgfEH4ceJbxF8WeAfFxkEjaHr2xkLBxGP+EO8TALHcJhowpDxv/k/fGz4VeIPgR8YPi18F/FeoaXqniT4TfEDxZ8NNavdHvf8AiVahq3w/14+HfEB0Hrn/AJAPPtwBwK/pX/4NLfHHi/Q/28/jH4A0ye7bwR4q/Zx1XUvE9kOdLOr+HPHnhx/D2uAHGTnXteABPXxGPejjLhfAwwP9oYGMY3XO2kkmrJtta663u9+9tC8gz7G/XVgMa2+ivvpZLX1vbvqj/RIn+4v0P/oVf4q/xf8A+Sv/ABZ/7KD4s/8AT74ir/aonB2Lx2/9mz/Lmv8AFX+L/wDyV/4s/wDZQfFn/p98RV5vhjpVzfp7lP7uar+B1cebZXb+aV/Tlha/luf0W/8ABqF/ykq8bf8AZsvxB/8AT98Oq/0gDwCfSv8AN/8A+DUL/lJV42/7Nl+IX/p++HVf6QFfPcYt/wBtS13hG/nqz3OEb/2KraPmmr/+A2/r1P8AI6/4LI3uoX3/AAVD/bguLwAXA+OniywGB0HYD0HPTPT0r2v/AIN/fDfh/wASf8FYP2TbbW4La5ttK1jxbrtk131Gr+H/AAJ4j/4R8gnPI68g9s5Ga9R/4OPvgFq/wQ/4Kn/GLxBNYC10P486L4U+LHhi9B/4/wA69oZ8N+Il6cEeKPD/AIgB4HI556flZ+yL+0l4n/ZC/ab+Cn7THg7Tv7U1L4OeNNJ8WnRvth0v/hINJ6eINCJ6AeMfDJ14Ywcbh7Cv1DCr65wrFYKybpqNk2rOUYqysr2vfbWzT1PzzFN4PPE8dtzX+V09fl30bP8AZhyAq5OMgdMjt7UnylWOB0Oc5OOCe/vnp9a+M/2Pv21v2eP25vhZpHxW/Z78f6L4y0m6stLvNY0l72H/AISnwfqTorHQvG+gKxfw34iTDKUmXcWXKgxohbwz/goz/wAFLfgD/wAE8fhD4h+IHxE8TaFqnxFOh6ofhp8IrfWlHizx/wCKWWT+wo4/D4PmJ4dEiwiXxW4WMR5EZ3ghfwtYHG/XVhPZy5ubble6a0dk1a/2tVaz6n668Zg3gvrnPFx5dE2vK1k9bvyV73P8y7/gpj4c8P8Ag7/gob+2f4f8K29ra6JpP7TfxY+x2dn/AMw//iufEOfToePxBFfot/wbMf8AKWX4Qf8AYj/Fn/1BPElfht8R/H/ij4q/ELx/8UPHGo/2p42+IfifxZ488T3nbUNW8Qa7/wAJF4g5P5e+ea/cn/g2Y/5Sy/CD/sR/iz/6gniSv3bPU48LWd78tm+r92K/HXyPyLK3/wALcX/fv+Z/p8nqn0H6nn8+/rX8hv8Awd8/8mp/sof9nI6l/wCoD4hr+vI/eT6LX8hv/B3z/wAmp/sof9nI6l/6gPiGvx3hn/kdZSv76uv+3Fuvv/E/Tc//AORRmX/XvT1vHbzP8/6v9bP/AIIy/wDKLz9h3/s37wn/AOgvX+SZX+tn/wAEZf8AlF7+w5/2b94S/wDQXr73xH/3PKmt+XV9d47/AI7+Z8fwZ/vf3flA+Lv+Dmi/v9M/4JMfGM2X39T+IHwn02/9tLfxxG5/9l/D6c/5jtf6zX/BZH9nbXv2nv8AgnF+0v8AC7wrYXGpeKW8FHxb4N0izwuo6jrfgN4/EkehoSesz6MyjaTvc7eWC5/yZa18OWnlVVKznd3V9XeMOXzs1on3TW6YuMV/tavdLldnvbbVefU+k/h7+01+2B4A8K6b4Y+GP7QH7S3g3wTpP/IF8N+A/id8UfC/hXTzwP8AkAeG/E4+p6da7X/hsv8Ab/8A+jsP2yP/AA+vxt/+amv6IP8Ag3t/4LW/DD9l/wAIr+xl+1brA8G/DAa1qmu/Cb4p3oH9k+EdU191bX/A3j5gN48ORr5ni2LxYGCfvHEiEMCv91/w3+KHwn+Lvh+38X/C74i+A/iR4cvFN3a+I/AfifQ/FGkMOmRrXh6SWMBskfO27acEkYFGacS1cqx0vreRQna7hJydpbJNNUpW87tu/dWY8ryRZng9c5cVpdOVmtFdauN/uP8AHO+JHj/48fGnUtN1n4xeOPjJ8Wdb0my+wWWsfFTxP428earp+k/9ALPiT16/r1xXuv8AwTx0PxRB+37+xPcwaPqlr/xlt+zL/pn2L/qrHh33P+R9a/0rf22/+Cw37Dn7DOgal/wsj4weH/GXxItbFjY/Bb4Xazovjr4hXrjaFWSJGMfh7JDtI/i2SFGO0JGQd4/QD4HfGn4eftFfCfwT8bPhF4gtPE3w6+IWiaX4g8L6zZrkahpTlvm/3shsdMjIwAQK8zFcc476lZ5NGEH7qvKWz5backVt5u/qdOF4Zwaxq/4VuaUbO177NNrfSztfZaXWuh7eOg+gpaKK/Mz9EWy66IK+R/23PhJf/HX9jn9qr4OaJbi48S/E39n34teEvDFkoznxVr3gbxCnhzJzncfEpj9eeOBivrikIyCPUEVUXaUX2afbr3FJXjJd01+B/iEV+7//AAbm/tQaP+zN/wAFMfAFt4q1G20rw38efBeq/Ai9vLvGf7V1/wD4RzxH4fBJ6bvE/h/QFPQ4JwQcVxP/AAXj/YM1f9hn9uj4kXGk6Bcab8E/jzrOq/Fn4S31jZf8SoHxBrobxD4GAzx/wh/iXxBkZyNreE/UNX4wwz3ME1vcQXH2W5tP+PK8s+2Tj/P/AOsV/Qi+pZ3kSiteamkkrN+9COnq++6a20s/w1/XMmzC72c232Svfra/ftt10P8Abi3n+6e3r/h37UhnHcL6cZBHPoT2OTjH8uf4cP8AgmZ/wdC+H9A8E6H8If8AgoTY+NNT1Pw3aJZ6H+0H4atZfEmp+IdMj3bf+FhaDC8bS+IjuBfxR4SLxOFUeWDkn+hvR/8Agu3/AMEo9c0satH+2P8ADfT4CDutdXsPGulaiCDkfu38M5AbgcM2SMlh0r8UxWQZzg3Z5bVd3o4Rk072s/cg+y32tbbU/XcJnuU4uK9+Kdle7S6JuyVr77vV6W1P13BB6f5zz+frQT+GeB/np+dfypftn/8AB0V+yD8HPDmr6T+yUmrftK/FG6tHsdG1S70bW/C/wn8PanIM/wBra5rmvrB4n8SrG4UJ4X8JwyTlQV3qWLDyD/g37/4LXfEf9rH4v/FD9mn9sLxTa658UvGutap8S/gZ4m+xDS9Mv4UdZfEfwkVGR12+FNg8U+CAAjNGfFbB98cWE+Gs4+pTxzjKMYpNJ9V10tdRi927Xs3a1m8P7eyf62sEnFydtfN2td329G7vW6eh+hH/AAcw6rf6V/wSa+Mo0/GzVfGfwmsbw/8AUMbx7oJkH/fQU49WOK/zFK/1tP8Agrx+zZq/7VX/AATy/aV+DHhCwOp+NLzwY3inwBpFsVQal4w8CSJ4k8PaMOes02hhNoxl3Cqoxg/5Iv8AqJvs8/8An6H9R/kV+i+HTTymrDTni5Rkut3GLTtvs7ddmr3TS+O4w/3tStpy3v00Svrtf/M/0g/+DVDwz4e0v/gm7rPiSzt7f/hJPFP7RfxFvfEt0Dwx0LRfDHh/w+SOPmXwzCgQ5AO9wRjOP6cFbPB69q/zo/8Ag3J/4K4/D/8AYu8VeNf2WP2kvENt4X+BXxX1vSPF3gvx5dkrpfgD4hjb4f19fEDAAjwx4x8NDw9uzlfBC+GyrKysRX+hD4b8deCfFPhaz8f+HPFuga54IvbA6hYeLdI13RdS8M32mBQRrA1tGMTKFyGcTbFYEAMMtX57xNgsbhs4mnGUlOStJptSUlFLpZfyqOj929tU5fX8M4vC4nKINTSsmpq9r2tqndPz7fij8mv+C/vhrQPEX/BJn9rz+27e0uh4e8FeF9e0cXfQ6voPj3w4yH1yFLA9iWPYCv8AKyr+1P8A4OQf+Cwvwh+KvwsX9hP9mjxvpvxDfU/Euma18dPHfhu+/tLwpY6RoEmdB8E6FrkcskPiYyeKEV/G4IMkCeH3QFDLLGP4rK/T+AsHi8Hk8541NKUuZcy5Wk4xSdt1drmtvdtuzbPheKMVgsXjUou7Wia62atfpvbrbQ/0HP8Ag0W1TV7n9iX9o/Rb4BtO0n9p3+0dPDZwZNc+FHw6k1wnpja6g/gOMV/WkcDJPPt1HXjg8Z6Zr+fz/g21/Z11b9nv/gmT4A1TxHYXWl+Jfj3408WfHa+s7phuXSvEK6B4f8PEjkrnwv4d0EgkDp3xx9W/t8/8Fef2Mv8AgnSdH0D44+Mdd1Hx/wCIdGOu6J8LfA2iz+KfHY0tF2LreuWzlU8OQ7Tu87xTJCJWVWAdSSfy/PV9d4kzX6iuZOSSsrq6stOm6ld7d0mfd5Y/qeT5X9daVkr9+lrq927eet9PL9Vg4Prz/ntVqvxQ/YX/AOC4X7Cf/BQLx2fhh8K/Ffj7wN8UbzR/t2jeA/itokfhXVtejbh/+EcaLxP4t8LeIWVc4fezgDIVm2iv2tDDaGA644A/Dj+n5V5WJwuKwb5MZHkdtE012T10ur6aK176nqYXFYTFpvCSTtdO3qraXte46im7l/vL+Y/xp2QehzWB1XT2afzQUUUUDCiiigD/ADAv+Dmj/lLN8YP+xI+E/wD6gnhuvwi8Of8AIf0X/sNaT/Wv3d/4OaP+Us3xg/7Ej4T/APqCeG6/BnQbi2g1jTbmcf6NaXuk/wD6/wDD8hX9D5F/yT+VW/59P8on4XmOmd5rfT95B/Lmjt3P9tdYAQDhuQD1Pp/9b+XtS+QPRh9TwMf04/Qe1fkd/wAP2v8Agkx3/be+Evv/AKL439v+pZ+v6evC/wDD9r/gkx/0e98Jf/AXxv8A/Mx9f8nj8CeWZxzP/hJq77unUXVatcnpfTv5n7LDM8FyxvmdNe7HTmXZaX+a1P1zBBzjscfjU+ce5OfbP/6h6+lfkMP+C7f/AASZPX9t74SD/t08bH+Xhev0s8CePvC3xO8E+EfiV4H1ey8TeCfH3hvRvFfhXxHZ3Stpmt+FPEOiDxBoWtggkKJY2QKcK6I5ZsD5V5MRhsZhVfGRlFaWUoSg03bpOMW/W2+hphcXg8Xf6pKMt7tdfx167PVWdz+Y3/g7t/5MI+AH/Z4XhD/1U/xnr/PHr/Q4/wCDu3/kwj4Af9nheEP/AFU/xnr/ADx6/bOAv+RNrtee/a6PyjjC/wDbEPlf7o7n+rz/AMELuP8Agkx+xPj/AKJJqn/qceJq8m/4OKtV1HSv+CTH7R5sRgXVz8O7C8Pf+y5PHfh9pM/iqntzn6V6z/wQu5/4JMfsT45/4tJqn/qceJq9D/4K5/ArWP2kP+CcX7WHwq8LQDUvEF98L9X1zw3YZULf6z4GdfEkWj9QQZZNBeIDGWlcAA4Jr8xT5eKbt8sf9ZndvZRTWrvol0u9Em9j9FV3w2lbV0l0d/hTa9Xa1up/kh1/pEf8GsXhzRdL/wCCZCatpkFoNS8V/tB/FjUtaHJJ1WM+HPD3HuvhzQY29T05GRX+bvX9dP8AwbK/8FN/hd+z3rPj39jL4/eLtL8CeFPiV4m0rx38FfGHiG+TS9M0/wCIEo/4RvxF4D8QeIGIVk8ZDQPDz+BI2+UtF4oLKX8YKK/WeO8Ni8VkqeCTatd8qbdklfRat9UrO+iUXsfnPDGK+q5zZ2s73va2trJX06eh/oB9Vyc5B4x9e3tzj8O+K/nb/wCDnrw7oGu/8EpfiBf6sbYXPhT4sfCTxBotyQpI1f8At5vDrHI/6ljX9dB5IGOMZr+iLzVRFIIzyMZAx3x9cHp36ZzX8Hv/AAc7f8FQPhj8WtF8I/sL/AHxdoXjC18J+Mx47/aA8W+HLxNU03TNV0AA+H/AOg69F+78R+XnXvFPjtU3rhPCjeY5dsfk3C+FxeLzrLFGLbhNObs7Jqzu97XSsrve2j1P0TPsXHD5TJpxfOkrXV9bbKzaWr9ddrn8a9f6eX/Bs7/yib+DX/Y9fF3/ANT3Xa/zDa/08v8Ag2d/5RN/Br/sevi7/wCp7rtfofiKrZRT/wASV/8At2P+R8Jwc75x5+8/wifv4GycAfjQMjH8Q/l/Mn+mK+Gf23f+CgP7NH/BPX4ZW3xJ/aR8bjwvp+q3n9neGPD2kWQ1bxZ4u1ReTHoGhBt7kPy2WAG4nJINfmp+yx/wcY/8E4v2oPilovwd0vWfif8ADPxZ4s1hdA8MXnxg8L6LpHhrxDrBDDRdGHiPwv4q8YKksoYlP+EsWAK5Zi2GGz8ow2V43FYT64oTcV9pKyWl7a2vsrNJq73uj9OxGaYTC4uOClJcz6aX1tvq0t9U39x/Q3RRRXMdm4UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAN28Yz/nOa/Nn/AIKk/ta/8MQfsP8Ax++P9lqFva+LNI8LvoHw0WUId3xB8SY0Hw6UIDFxAWbxQqZVAmgsSzFVDfpNu4zj/OcV8IftsfsGfs7/APBQHwB4d+FH7SWm+Kde8F+HvEw8V2ej+HPGOt+FW1HVl0OXw+Brsnh94wyqNdchBnG8OCqs1b4N4SOMhLF35YyUpK172d7LVK77v8rnHi/rTwklgviasr/K1+vfo9T/ACBLy+uL68udQvri6urm8vft97eXnP8AaH+Hv745r+0D/g0t/YzOreJfj3+294q05WtvD9oPgx8JVvk3Z1TXceIvH+vrk/K0fhw+HPCwYhv+Rh8WAAMysv7Hf8QxX/BJrv8ADD4n/T/hc3jYH/0Iiv1r/ZT/AGUvgv8AsX/Bbw58B/gDoFz4Y+HPhu91bULOyvtWfVNWXVNf1mTxB4gfWdbIJdjIxUkYBjyvJ2s36Hn3GeEzXL1gMApU1aKbbik0uW692XVJp82lm76Xv8fkfDOLwmO+vY9qV23rZ9b/ANadn5n1jsT+6v8A3yP8KNif3V/75H+FOor82u+7/r/hl9x91yx/lj9y/rovuP4Uv+DtH9jv+z/EnwE/bl8Oaaq2+v2jfAj4trYdP7U0J38R/DzXmOBl3X+3vCzggc+H/CoyxG6v4tK/2Rv2rP2UPgl+2j8Gdd+BHx/0GfxR8OPEd9pGoXdpZas+l6s2q6BrEXiDw/JouuAghxKpwA3EQCkqcuv5Jn/g2L/4JN9vhh8T/cH4zeNs/wDoWP1r9JyHjHCYDL1l+OhKSiuVNJSfL9hayVmo2XbRNJKyPhc84YxeLxyx+BaVmm7adYt7Pey0/N2Kf7LP7Wv7V/7bP/BFPwz8UP2RNY8G6t+2JoPw+/4VrrVz49K6qt98RPh6U8Pa/IfMYsPEvi/w0kfitB4rAAk8T73VmYOn+cd+0JpXx40r4zfEi3/aat/Hdr8df+En1a/+IP8AwtT+2/8AhP8A+1eSf7f/AOEkHofT06jiv9Yz9iL/AIJ7fs3/APBPnwf8QPAv7M+j+MvDHhPx/wCKNK8Wa7o3iHxnrPiopqo0RdC/tnQ18RSNJ4czGI1ljAIk/sFPlCn5el/ap/4J+fshftnaZFZftI/AjwJ8RdQtLMWmi+JL6zbTPH2gLtG/+wPHmgmLxVCFA4VZdvWRhksK8TK+J8HlONzKSpqUJu95RSlFSaa0fk3dXVttXZPrzPI8bm2CjFztJWsm2ruNl31+71ta5/lzfs7f8FOv29/2WNHt/C3wK/af+J/g/wAEWgxZeAv7a/4Snwpp4Oc/2BoHiXjw2CCfasT9qz/gof8Atn/trwaJp37THx28TfE/Q/Cd4L/RPDV2ND0rwpp+qjAGuf8ACP8Ahrp4l7D0x2Ff3FeLv+DUX/gmz4zu57jw94m/aW+G9uetl4a+IPgvVFB9j4m8J+MSR6ZRT7cYrpPhl/watf8ABNLwNqdvqHivVv2gPi0toBt0jx38Q9F0zTMnPBT4b+FPBIAGOzk98en18eLuF+ZY5UV7Wys/ZSTvZJ+842av1vZLR6HgPhziRx+pub9ml1krJe739b/Lpc/hk/4J8/8ABP343/8ABRj4/aJ8GPg7o90NDF7pN/8AFr4p/Y8+Ffhf4Txn+3dfPGeh/wCED8Jcf8J1jjgYr/Sh/aw+D37TPwR/4J2XPwX/AOCYen+G9N+LHwp+HnhjwL8NLTxHsN6PCnh7RIPDurnQPN/4pr/hZpiBaFvFA+yM4u2mPnmGvtn4A/s1fBD9lfwHB8Mv2f8A4YeEPhf4KtWa9Gj+EdDj0xbzUjEgk1rW5Ik3+INekeLzHknZpA24bkXyUT6GfPTqD2x+efzGK+Hzzid5xjoytyxi04Rez21k9tk1ZNqz6tu31OWZF/ZWDcU05ONtL7teX3La2lj/ABVPi1pfxY0r4n+P9P8Ajhb+MrX4tDxPq3/CwbPx5/bY8f8A/CWf8zB/b/8Awkn/ABVn/CTfhmvsX9nv/gqf/wAFB/2X9B03wf8AB39qj4n6D4J0rIs/B95rI8UeFdPH/UA0DxLz4b4P09a/08P2rv8Agm/+xj+2dZuf2i/2f/Anj3XLayNnZeOmtT4a+IFhpu3BSLx74fdPFaAhchRIEBz8q/Mx/Gzxh/waf/8ABN/xFqE934f8b/tQeAbZgM2Xhr4h+CdTA4HfxR8LvGBxxxlQx6Y719hheMckxWDjDMMpi3FLomtEl231Ts0rLvufNS4bzrCS5sDOT1Ttd/3XbW/dp62t23X8KX7VH7dv7V/7bOpaLqH7TXxn8UfEW28P/wDIs6PrGNL8LaATgZ0HQPDf/FJk8D3Hf29j/wCCZ3/BOL40/wDBSb9oPQ/hf4H0fXtL+F2ka1pN98aPimLLGk/D/wAJ4xxr3T/hJyoH/CCeE/QZJ4zX9wHwq/4NYP8AgmX8O9St9R8Uz/Hb4xLaAlbTx98QtH0zTM9fmi+HPhTwOQBnkbwSPTjH76/BT4D/AAf/AGc/A2l/DL4FfD3wx8L/AIf6OG+w+EvCWjppWkxFlAOwLnJOOSSTyQDtJFc2L45wWFwX1HIqdlZq7VkuayejV779Ld7HRg+GMbi8Ysbnbelm1dPa1tfN62vfT0Oi8D+B/C/wx8EeCvh/4H0600Twl8PvDmjeE/DOjW+1U0/RfD+jJoGhaPndgiGIAKTyXjXjLFq/hd/4L6/8ELfiD4d+JHj/APbX/ZL8D3fjLwD44vdW8W/Gb4ceHLEDxR4A8VHL69458PaCHceJfDXi8cNhh/wgzK0gUIRX98BUHkip2AZeRkY7fzH86+EyzNsblONeNjJN3u03pLW++6d3e9nrra10/rsyyvB5pg/qT0SVk1urctvlr369Nz/EJor/AFZv2pv+CIP/AATi/a+1fUfGHxB/Z903wx498Q3Q1PWPH3wyvD4B8ValqxRlTV/EB8On/hG/EDhgkkjzQyEBivL5Ef5w3n/BpH/wT0n1IXFt8ZP2p9MtyMjSLTxZ8LwuOeMj4VljkD+5jpzX6fhfETJpJe0p66XUoqTbtG7ulJXvdb3v26fnuI4PziLSpysk7pqVtLpJ6W/4dppvZ/529f20f8GoutftzWl58RvB9/4A1u5/YW1+z1TxDZeMPE4GmaToHxWjdWJ8Ajcp8Sf8Jf8AKfHTZxHII5CCVAP7Tfs9/wDBux/wS5+BN3pviGb4Man8WNb0tSVuvjb4lbx1poPqdAYDwqO3y+UcHlieAf218PaFo3hTRtN8P+G9K0zRNH0myGn6TpOkWSaXp1hpsYLCPR9EhXy0CZ5RVABJxuVmVvA4n4wwWOwSwOBotK6bcoxj1TTjZNttrS6Vk+6s/cyHhnGYTF/XcdO6ta1729fl/wANuzs8ADucZ9u+R+Xr9a/zvv8Ag7sO79u79no+v7K+kf8Aq1vjLX+iERkEZxmvyh/bd/4JD/sQ/wDBQj4jeHPix+0x4R8X+J/FfhLwWvgLQrvw94/17wtp3/CJnW/EGvqrDw/IrPJ53iDXD5jMu4OEbDASv8vkOZ4XKcfHG4vWEVK6Sve6SXZW7+b7be5n2WYvNcE8Fg3Ztp3vvquv/AfRq1tf8mav9tzTj/xLrf8A69UH8jx/nua/n8/4hjP+CTRxj4YfE8g9f+LzeNv/AIrjuOep6V/QdDCIIfs4x1BHUcevT0yen/1/U4oz/BZystWEjOKinzXSs1ZN2abT0V999Ejm4YyLGZSn9bkm3a3bdXv36q3X5Jn4s/8ABaT/AIKY6B/wTf8A2VtT1jw9qGmXH7RPxNtNV8IfAvw1eOzv/aceTrXjhtGbDP4Z8Hxsry5aRRO/hpRJIpzX+W74p8R+IPG/iTWvGPjDWNU8T+JfFet6tr/ibWdXvv7U1bX9X8Qc+INd18/lg469+9f6q/7Xn/BFv9hf9vL4pH4y/tFeHfiJ4u8XW2i6X4XsBZfFbxppGj+H9M0V3cjQ9ASQx6BM8pd5mjcb2cuSvmKzfMY/4Niv+CTff4YfE/8A8PN42z9fvGuvhrP8oyfCu8JSqSveSSeulruUtNle+l7trVnmZ7keb5ti1Z2itVrayXL2Vr29H80fx0f8ELf+CYGof8FEP2obbWfiB4fuj+y78Er3Sde+LV4CP7K8Yar/AMwH4U8kceL87mwf+RE4GSVB/wBQzSNJ07QdO0/SNK0+103TNKsxZWdnZ2h03TbDTkwQipyqgKmcKQNwLFQdzH5r/ZE/Y8+BP7EXwe034I/s4+Eh4O8BWN9qeuNa3V1/amqajrGuktLrOu627btdd8AfPIwVShUlhk/XZb5Qcde3+fUV4Oe57LOMbfZJe6le22rlf7T112to7vU97IsrWUYVJ6trW+r2Sa380l1fXsfzP/8ABwx/wSth/be+Ag+Pvwg8K/af2mvgRpD3tjaaLZF9V+KPw8IZ9d8EN5af8VB4j8JKsnivwK83lAXCmFDKHiLf5tNf7doUYIzkHsf6j+fT8CK/B34tf8G6/wDwS7+L/wATPG3xW8VfCHxnY+JfiD4k1TxVrVt4R+JfjPwt4ZOs+IEH/CQS6LoHhp4YvDwc9oUjXecKFGdvv8McVLKMLLB41SnB8rjK6k97NNX22s7t+89kkeVnfDDxmMjjsGkpNXsrNXfLd/P01tdt62/jt/4ILf8ABVu+/wCCf37RI+G/xU8QXa/sm/G7WNL074gWt5xpnwt8WN/yAPiwpxlc4B8ejkf8IOqtgnwSAP8ATc03VbHVrODULG4trzTry1+2Wl7aXgv9PvI2H3lcfLIqnBG3g88hkKj8Aj/wbF/8Em/4fhj8Tj9PjL42P85BX7Nfs9/AfwJ+zN8JfBvwT+HMvimfwX8P9FGg+GP+Ew8Sax4s1a00pCvl6Sde15nldVIG1S6ttGCq4Bry+JcxyjNcZ9dwMOS695WS5nor2i2nLRa2tbR3S07Mjw2b4NfU8c7rS0vusvPT1ufQ1FA5APrRXzJ9OV/r/nnIr/OZ/wCDsc5/4KMfDc/9WreFf/U7+IuK/wBGavyX/bV/4I4/sQ/t8fFnTfi/+0z4Q8ZeIfGWjeCtG8B6dc+HPH2v+F7D+xdB1rX9fRH0fQ5sSTGXXpGZ3wxVkVl3gyye5wvmeGyjHrHY3azVlZvmlKFmk7KySerfVNa3Pn8/y3FZtg/qWCly26vrbV99vLprc/yd6K/02f8AiGL/AOCTf/RMPif/AOHl8a//ABdH/EMX/wAEm/8AomHxP/8ADy+Nf/i6/RX4i5O7XpN7Wvyu23npa/4Hwq4NzhbNK9r2la+2/u+v3eSv/mTUV/ps/wDEMX/wSb/6Jh8T/wDw8vjX/wCLo/4hi/8Agk3/ANEw+J//AIeXxr/8XS/4iHkzWlDVrTSG/u/5/wDkv3NcHZzde92+16eXr/W/jn/BqKCf+CanibH/AEc38RP/AEw/DsfzxX4j/wDBzlpf/BSaf47/AG/4z22p3X7FNprKn4G3fgOz1j/hVunbxnd8QQnyj4nHB58YHBIP/CuiQK/ti/Yu/Yo+AH7AnwnuPgh+zpoWu6D4LuPE2reL7qz8R+Jtb8Vao+r68irJINc8QStI6MNHChDjYVViTmMt9IeMfB3hf4geHNS8H+OPC+h+MvCurWn2PWfDXiXR9I8SaNrulsm3y9d0TxDF5cyg5O1w+Hyx5Chfg455HCZzLOYxTTkpcrVklyxhtZpbXV1rdrTdfZPJJYrJlgXJ81lbV66/11V90up/jNfCX40/Fj4E+MLbx/8ABb4keMvhf42tf+PLxH4D8T614X1XnPbw529/TOe1fo/ef8F2/wDgq/feELnwfP8Atf8Ajv8As26svsP9sWdj4J0vxVn1/t//AIRcHOM88cHB61/cP8cf+Dbv/glp8brqfxBB8J/GXwU1q5Qbm+CvjP8A4RfTWIwM/wDCP+IE8ZeE95wThYApOcAYwflCz/4NKP8AgnxBqX2if40ftZXdrxjSLzxr8LyMcY5Hwt9TivulxTwxjPex9Jqas1ejeWiUlblUravvpfTu/l1w3xJg9MFUutdOdWaTSvq7WSv+V+3+el/xOPEesf8AL1r2t6te+2qarqOreIPyx1+vNf6Jf/Bt/wD8Es/GH7E3wl8aftLfHzw9d+Gfjt8eNI0XQdE8H6pZjTNY+H3woE0fiA6H4gUOhHiLxZ4odGuckYh8O+FVAZmwP0i/Y8/4It/8E+v2J9dsPG/wk+CFrqnj7SF/4kvxG+I15J458WeH8htw8Pz+Isnw3xggxIrowHOWAH61lQQAOAOnHH5cf5+tfN8T8ZPNsLHAYFONNPV9XZxSsu1r6txd9GrNnuZJww8JjHj8brPR2vez93S+mt9tHvoxpOLd29f/AIn8fXFf4q/xf/5K/wDFn/soPiz/ANPviKv9qsqCAOcZ9PrnOfXn8SK/n613/g2n/wCCVfiPV9a1/V/hh8RDqfiDWtU16/ZfjL43Ctq2vYEhVTKxUE8LlmKn+/jni4Wz7B5NPM5YxScakaSXLbRQUm29VZJS3118zq4lyvF5vCKwbV423stW1drTt5dj+YX/AINRDj/gpV42P/Vs3xAH5+IPh0P61/pDkbgMdCc9cev171+RP7F3/BGn9hr9g74tXfxn/Zt8H+M9A8Z6x4W1bwle3XiLx/r3ifThpOvf2BvA0bX5cKSdBi2bcOu18bmI8r9dcYGDyO/bHOR0yeTxXncTZnhc3xzx2CTS5YpRaWrTd72b0as9e23U6sgy3F5Tglg8Y02m3umk2ldN92t9PLofgl/wXO/4Jc23/BRz9mZp/AFrpf8Aw0z8Fm1nxF8Jb+6JsBqGmeIPL/4SHwLLIEXH/CZJoiLACM/8JhCrZRQVT/Mn8beAPGHwy8YeJPh/8RvC+veDfiB4T1r+wfE/hvxJZf2Xqnh/Vv8AP+cmv9r7cCpPbng8fh+Nfmh+2N/wSp/Yc/bsb+0Pj78B9I1Pxra2r2Fj8R/Dsj+GfiBZAruBPiDw8VOvYkO0L4tW4RV2lVAJ2e7wtxi8nj9Sxy5qUrWtq1ezl5SWzWvMlok3ZPzM/wCGf7Wf1zBtKaV/yW2/S17tenX/ACVdB13xB4cvf7Q8Oaxqmg6lwftmj3v9l6r7989Pp7e/W+CfA/xQ+O/xI0TwP8P/AA/4o+KHxR+IWtfYNF0fR/8Aip/FXiDVv5fz7+tf6EP/ABCg/wDBOD+2P7Q/4T39qv8Aszy/M/4Rv/hYPgn+y+uNu7/hV/8Awk2f+234Y+av1+/ZC/4JffsU/sK21xcfs5/BfQ/C/iW6shp998QtWc+JvH2oacAGEc3iTXhI4UMBuKYQrkSK6sEr6fF+IeTpf7BSUpecUtdN21flvu1FtrRJ7PwsJwhjtsbN9NL32ttrbdKy9N7H+Sd8SPAHij4V/ELx/wDC/wAY6f8A2X41+HvjTxZ4E8UWZvv7U/s/xZ4e13/hHfEH/pgxn/HFfuV/wbMnH/BWX4QH/qSPix/6gviSv7CPiT/wbqf8Ewfi18T/AB78TvGXw4+Il344+JnjXxV8S/Fl1ZfFvxrpmm33inxHrsmv65KER2KpLNreE+8SobPzI232P9kn/giD+wF+xV8bNE/aA+AXw+8ZeHviN4fsdZ03SLnWPid4z8UafHpviDRF8Pa6p0LxDLJGC0TZABOSVbKFglcub8d5Tjsunl8YSUnCSW2knGyekrpJ/Lc6sHwxjMHjo43dJpaPpdfdaz6X9T9iuw7dOnb2/pX8hX/B3v8A8mp/sq9x/wANG6rjnPH/AAgniL/PvX9fbEqABx1GfYf4/pXwD+3F/wAE9P2Z/wDgoP4J8FeAP2mPDuveKPCXw/8AFB8W+GrPw54n1vwuV1ZtFfQSXfw8ysUXzDtQLiPJVQBwPznI8SsFm9PHvVU5J2+Ju0XGyXXR6add10+xzPCPGYJYPrKO+tr3TXfRPvfY/wAgiv8AW0/4IzZH/BML9h49h+z94SP5Kc4/MflXxGP+DYz/AIJNkHHww+J5IP8A0WbxsOPpu6/p+NftP8BvgR8Pv2dPg/4A+CPwt0+70v4c/DPwuvhPwZZ3t42qapp+kIzEAa2xJ3An720FiATjaqj6ji/iDB51hYRwcKkXBr40l0SdtXfV/LU8DIcixeVYpyxbUk1dWd102aaS03vffW3T25sEEE9/1I7+xFf55/8AwXp/4IafEb4MfEjx9+2R+yT4IuPGXwC8b3eqeL/id4D8M2e7U/hB4qfd/b2vLoWFDfDNgpPH/IidehDN/oYAhweMY/8Ar+317e4o2ggA5/TOPTuCP88dK+ayrNcZk+MWMwjskkmm7dr7/mr2d9H197NMqwubYVpqzWztrfTR6+mz1Vref+IlRX+qV+0p/wAEJP8Agmp+1Lq2peLvGH7P1n4G8basBf3XiX4RX58A6nf6qAqrrMmi+HWk8MPISS3mmLLDhwHIZvz9l/4NI/8Agn1PqH2qH4zftX2trjP9kjxb8Lyn/fZ+FQ+vAwPWv07C+ImTyS9pT96y5k4qV3aN9k1ve3XXprb88xHCGcprklZXumpW0dlfp/w7TV9n/nb1/dL/AMGpfiL9tey8FePvA/jDwBr11+xFqwbxb8PPHfiQLpn9g/EElV8QaH4DQ5/4Sbwt4tkZJGYYKEDkBmVv2B/Z3/4N7f8AgmJ+zpqVhr1h8Bl+MWu6ShOnaz8dtc/4T/Ts8jP/AAjsiR+EOD03eDiMjGfT9qNL0/TtCs7fR9KsLXTdM0y0+x2Vna2o03TLDTVxhEAxGoVY+iFRkM2AS7t4HFHFOCzbCLBYGlZKzc2lFd3ZfE2mluoqKejbXKe5kHDOMweMWOxs72W179lr6JWfy06nVUUUV+en3gUUUUAfnj/wUI/4J+/Bj/gop+z74k+CPxct2024LPrfgHx7ZWDal4o+H3itAxj17QfNcgkJ8reGw2JAAGB/diP/ADJf+CgH/BLj9q//AIJxeO7jQfjf4HutW+H15e/YfBXxs8N2Z1T4f+MQRkf8VBkf8I34lIIx4T8YYyO/Q1/rzKwPA49sf5FeceN/A3hH4keG9S8FePvCmheOfBmv2Bsdc8NeL9G0bxP4X1vTHQEjXdC8QRulwuTkqUcb1DkEhQv0uQ8TY7JnbeDabjd3jtdwdn0TvF6OXVat+BmmRYTN0r6SVvv07r5tW0P8VCiv9PL40/8ABtt/wSy+MV5Pq0Pwn8Y/B3W7pPnf4PeNtZ8M6VuHY6D4i/4TDwrubgkCALzgEYwfk6L/AINIP+Cff2v7QPjd+1j9n5/0I+KvheFP/Ah8KifT+HPPfAB/R4+I2TyS5lJPTSUbvZX+G67rfp2dz4T/AFOzhbOy6WlbT7vL8ux/nfV+p/8AwSw/4J/ftz/ta/H7wB44/ZK0fXfAdt8NPGek67/w0frNjremeAfh/qvh7BONexnxJ4n4/wCRSXnHXgmv7vvgZ/wbp/8ABLj4IanaaxcfA/UfizrlraENd/F/xRrfirSsAH/mAMYvCobHJ/dnHYY5r9pPB3hTwr4F8O6d4Q8FeGNB8GeHNLtPsej+G/Dej6P4c0jTtLVeRoOh+H12QoMAhFWMFssMMxz4GbeIWFlBwwFOOqtea933tL8qu36Pla77X9bKuD5KSljpNNWvrrurq/o7ddLG5o8N9Y6Zp9vq17b6lqKWR+239vZ/2WNQ1Dje40cMwUEAsBv3cAkJnj+Dj/gvh/wQt+IPhD4keP8A9tb9kXwPdeMfhv43vdW8W/Gb4W+G7D/iqPAHipsvr/jrw/oKs48S+GfGAJD4IPgZgzhArKa/vpwpzx/kZH6f54xQQCORkf5FfC5ZmuMynGrG4N2vutErX10SslbZ238m0/r8yyvCZrg3g3ulo+rsk02+2ivrr5OzX+IhVuG+1CCzudPh1C6/s26/4/rP7b/xKvp78da/1Wf2pv8AgiD/AME4/wBsPVtQ8YfEP4EWvg/x9q//ABMdY8d/DK7bwBrGp6oYyU1jXz4e2+GvEEikLI5milcruDAHJj/OSb/g0i/4J8TaiLqH4z/tZ2tsRn+yF8bfDBkx67h8K+h9SBjrX6dhfEPJpJOpTXNZKV4qTbtG+qT63S6+S6fnmI4PziLSpy92+nLK2miu7eX5ppuzR/nbV/Rb/wAEU/8AgiL8Tf23fHnhT48fH/wlqXg39jvw5eLr32rWLI6Zq/xxDkpHoOgKPmPhp2BXxz4rAy7DYmWGK/ry/Zw/4N7f+CZf7Nus2Hiew+B0/wAYfEekg3un638d9dPj7Td5Gf8AkXGjTwhwDuH/ABRzA46EHNft1Y2FvYWkOn2Fvb2lta2gsrS1tQuLIbcAD0VQF5wCMZ53Ma8vNvETnh9Qy/3VJNKVrOKa1t0una3NZLfW1n6eV8HyTUsc27NPe92rNa3ts3b06dMrRtIsNC0i28P6Hp1ppWi6XZaZZaPpFnZLpunWGmKqRLpEagFRmMYKhB99QVBLA/5YP/BfK+8X33/BWH9r3/hNxdf6J4m0mw8L/a+n/CJ/8IL4d/4R8ADHbGPUV/q0kjBPOOnv1xX42/8ABQT/AIIo/sX/APBSXxHpnj34v2Hj3wF8UdJ0MaGvxP8AhZrOiaR4rvtH/g0TX4/Enhfxn4X8QRKcph4S6scZwBn5fhjNcJlWYPG4+LlF7v4neTTbk27vR9E222z6XPcsxeaYLkwUuVxskttvd2Vt2t+l/LX/ADhv+CY//Cb/APDxT9ij/hXP2r/hJP8Ahpv4T/YfsmMf2T/wnXh3/hIM/wDcsf2/+Ge2K/1xfHeuah4V8FeLNe0nRhr+p+H/AA1rWvaRoyOFOualoeiSsmj4HzjzWQAYOQxOD8jY/If9gD/ghL+xD/wT28df8LY+H9t8R/ij8WrWwFlo3j74u63oeq6p4fAIJXw/oHhrwv4M8LeHS65C+XESc4UqxDD9vScFcdPpxz05/wA/0rq4uz3B5xmEJ4GPLGKt7yte7g7tdopfa973noc+Q5Vi8qwbjjHdtNJL0TT2833+Z/jSftH/ALV37Q/7WvxN1H4r/Hb4r+J/HfizVbz7dZfa9a1saT4ewQBoXh/w/wD8y34ZA4wABxX9U3/BtP8A8FW/jN4y+OP/AAw3+0L421T4j+FNf8Fapf8AwX8SeMbw6r4p8H6p4ckWQeB/7cCuG8O+K/DKmSDKFlfw4QhXe+fnj/g4/wD+CUfwi/Y81Hwn+198A7q18NeFPjZ8TtW8JeNfhEAi6V4f8WPofiTxImteBEWR8eHki0DXDL4UAWLwSWWSFVR/Lj+EP+DdT4d6/wCP/wDgrB+z1daNb3P2X4f2Xizx1rV4xGLDS9C8DeIvDarzgZd/EAVR/EWAHJr7rFQyfNeFXjlFRcYNR91JqcUl0vZpprRtO2nd/IYWWNyvib6m5OSk0073TTcd9rdF+LP9TWiiivxY/Vlql6IKDwCfSig9Dxnjp6+1HqN7O2/Q/wAwH/g5nOf+CsvxgPr4H+Ex/wDLE8N1+Atf6sv7W3/BEH9gP9tb42a3+0D8fPh94y8Q/EbxBYaNp2sXOjfE7xn4Y06TTfD+ht4d0JV0Pw/NHGSIlyckYIZsttKV85H/AINi/wDgk52+F/xP/wDDzeNPz/1n+FfrGV8eZVgcBlWClGbdOMeayjeTildxV7vTo9XsfmGacL4zGY545Nat6PqtLad9fv3P8yeiv9Nn/iGL/wCCTf8A0TD4n/8Ah5fGv/xdH/EMX/wSb/6Jh8T/APw8vjX/AOLrpfiJk6dvYve20fLz839zOT/U3OGt185enTl/q3kr/wCZNX+w3/wTk/5R/fsQ/wDZpn7PP0/5JL4Z/wAj8a/L7/iGK/4JN/8ARMPiefp8ZvG39W+v8/av2++E3w68L/Bb4b+Afg74It7m18KfDLwZ4V8C+GbS8u31DUdP8J+HNDTw94fV3OQx8vQ0UHG19jkKpUonxvF+fYPOMJF4GDg4yT1ikndWsrN33Wu3Ta1vqeF8jxmUa413TSa95/3X8tvytofzQf8AB3X/AMmA/AD/ALPB8I/T/klHxn/yfwr/ADxq/wBg/wDbe/YN/Zv/AOCg/wAOPDXwm/aa8O674m8GeFfGY8c6La+HfFWteGNUsPFSaB4h8PB9/h0iSRR4d8Sa5DyxbfIG53MT+ZR/4Niv+CTfb4YfE73z8ZvG/wDjXpcMcU4LJsveBxkJS+LWKT1k73eqe/8AXfkz3IMZm2NWNwVly8t763+G9lr0+4+oP+CE6n/h01+xKe3/AAqbVT+XjfxL+nPT1we9fr4VyMdep578HH9OvpXzl+zr+z78Nv2X/gp4B/Z/+EllqelfDn4Z6O2g+FrLV9XfVNVsNKGtSa8RJrmd8uH1qRwRsyqoFJCl2+hd3y7unH/6vzr4XF11i8VPFrSMqlSfo5zcu/S7/wCBc+xwuFeFwai9bRSaet7KK+/8D/NR/wCC+n/BIjxz+x78c/HH7S/we8HXWpfsr/FXXG103Wj2QOlfCDxXr7H+3fBGvZUDw74XddreA9uQGLRkl0YD+b+v9rrxT4Q8K+O/DeueEfF+haT4m8L+INPOiaz4f1ewGq6Tf6VIu/8AsnWNHbdE8YDHIKMM4ZsKNr/gD8fv+DYz/gmT8aNYu/EPh3w98TvgRqF2Re3Vl8H/ABPokfhhm7r/AMI/4o8LeMlPTIKtgjOM8V+i5Fx5yYL6jmClKKaSlbmbiktZLfmfVRjZ6PTp8LmnB0pY369gXZvpe1m7ba2tt8uvf/Oph/aE/aAg8E/8K3g+OHxktfht9i+wf8IH/wALO8bDwr/ZOD/zL58UDwnjnHQVieD/AIO/FD4jeFfiR8QPB3gfXte8JfBzRdK174g+JLOy/wCJV4P0rxBr3/CO+H/7f18Z/wDreuK/0LfhX/wal/8ABODwBrNtq/jLxR+0D8ZLa0HGj+PPGuiaXpfbPHw38K+CuASO/wCFfr3qX/BOr9ji8/ZY8afsT6L8IdC8CfATxzohsPE3hDwIP+EW1K+LNEo1s+IEP/CTjxNv0VCnih5fPkVSUeQK2z1cT4h5PhJRWAp3u0m2uSyulK2nM2knypKz0TlE5sLwhjpX+uyeuqTbkr9FrLv3111vY/yDK/06/wDg2dGf+CTfwYP/AFPvxcH/AJfevZ4/Ks4f8GxX/BJvv8Mfid+Hxm8b/wCP6frX6x/sl/sn/Br9iL4NaH+z/wDAHR9V8P8Aw58NahrGpWFlrOua14n1Qar4g1mXXtdeTXfEMjmRHZmZVYoOFJVHj+bweJ+KcFneDhg8HCUeWUZNyVnpq9eZuyfXS2mnb08hyHGZRjfrmMtJNWS69LafLb7r7n8Lf/B2jq3i64/b6+EukazdXL+CNH/Zl0u88G2wIOmM+t+PPEcXiLey4BcNGVfgYdfCo2jGK/loh+0ebbeR9q+0c/YfsfXHfr/nNf67P7ff/BMv9lz/AIKN+BNE8I/tBeGNUk1PwXc6rf8Agvx14Uvxo/jrwhNrwX+3RoGviN2jWbADptkRSilY97v5n5v/ALJn/BtR+wH+yx8WvDnxet774yfGvxX4K1qLXPBNr8atb8F6v4Y8PaxoWf7E11/D3hrwj4NTxAYhsZGdpEdjhwgAY75Vxhg8Hkn9nygnLlcLqKfM0kr7cqb+Je9u7dr8+ZcNYzGZwsepNJu9tkldNa3u9+lu9n0/cz4Bf8Jr/wAKJ+Cf/CxfP/4WP/wqb4ff8LA+2Y/tL/hL/wDhB9C/4SbGOPN/4SXzN+7jd97vXuNHSivzZu7b7tv72foUVaKXZJfcgooopDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACjA9BRRQAUUUUrLsvuAKKKKYBRRRQAUUUUAFFFFABRRRQAUUUUrLsv6/4ZfcAUUUUwCjAPUZoooATAPUA/hS0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFKy7L+v+GX3AFFFFFl2X9f8MvuAKKKKYCYHoPyFGB6D8hS0UAFFFFABRRRQAYA6DFFFFABRRRQAUUUUrLsv6/4ZfcAUUUU7Lt/X9JfcAUUUUAJgDoAPwpaKKACiiigAooopWXZf1/wy+4AwD1FFFFMAooooAKKKKACiiigAooopWXZf1/wy+4Aoooosuy/r/hl9wBRRRTAKKKKVl2X9f8MvuAKKKKYBRgDoAKKKAEwB0AH4V86/tK/Hzw7+zJ8B/il8ffGPhjxj4n8NfCnwxq3i3WfDXgLRG8TeLNR0vQVYsdC0JWG92ALZXDADP90j6LrLnt7e4huYJoPtMF1xd2pG7rjtlc5wMjjJGR3pppNN7Jpv0vqJq6a8j/KE/wCCj3/BQ74//wDBXj9o/wAJix8Ia9beHNKvh4T/AGc/gT4bGs+J9Xsm19Qu99oUeJfib4xC+H1OAAAAqqoAA/tR/wCCCf8AwSdH/BOb4I618WPjRpFof2oPjza6QPFFlvOot8Mfh8HVfD/gFHVlAdmJ8VePNzqGlCQNj/hEMj9J/wBnH/gmd+xD+yX498TfE34B/s6eB/Bvj7xXrWq6jd+MUsjqOq6H/bTK8mi+HZNeeT/hG/DBYqqweEvJMmHRg8ZYD9DCF8lR154/EA9/8/jX1eZ8TPFYKOW4H3MostNE3y8t3dN6Xu3803qfM5bkX1bGvHYz3pJ6fhfV3el7pWtrqWwcgH1GaKBjAx0xx9KK+TPpwooooAKKKKLLttt5AFFFFKy7L+v+GX3AGB6UUUUwCkwD1A/KlooAMA9RmiiigAooooAKKKKLLt/X9JfcAmB6D8v8+gpaKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9k=`,
  url: "https://ibb.co/mCG5M50f",
  fallbackText: "AX",
};
// ============================================================

// Brand Colors
const BRAND = {
  teal: "#2DD4BF",
  tealDk: "#0E7490",
  purple: "#7C3AED",
  purpleLt: "#A78BFA",
  orange: "#F97316",
  pink: "#EC4899",
  gold: "#F59E0B",
  bg: "#050B18",
  bgCard: "#080F1E",
  bgGlass: "rgba(8,15,30,0.85)",
  border: "#0F2545",
  borderLt: "#162E56",
  textPri: "#F0F6FF",
  textSec: "#64748B",
  textMut: "#334155",
  lineGreen: "#06C755",
  lineGreenDk: "#059246",
};

// Helpers
function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatThai(s) {
  const d = parseDate(s);
  const M = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function formatThaiLong(s) {
  try {
    const d = parseDate(s);
    const M = [
      "มกราคม",
      "กุมภาพันธ์",
      "มีนาคม",
      "เมษายน",
      "พฤษภาคม",
      "มิถุนายน",
      "กรกฎาคม",
      "สิงหาคม",
      "กันยายน",
      "ตุลาคม",
      "พฤศจิกายน",
      "ธันวาคม",
    ];
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return s;
  }
}
function formatMoney(n) {
  return Number(n).toLocaleString("th-TH");
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function fmtCal(dt) {
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
}
function getDiff(s, today) {
  const d = parseDate(s),
    t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / 86400000);
}
function payStatus(diff) {
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "upcoming";
}
function contractStatus(diff) {
  if (diff < 0) return "expired";
  if (diff <= 30) return "critical";
  if (diff <= 90) return "warning";
  if (diff <= 180) return "notice";
  return "safe";
}
function parseDeeds(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw || [];
  } catch {
    return [];
  }
}

// GCal Links
function gcalPayment(c, p, isReminder) {
  const d = parseDate(p.dateStr);
  const base = new Date(d);
  if (isReminder) base.setDate(base.getDate() - 7);
  const next = new Date(base);
  next.setDate(next.getDate() + 1);
  const title = encodeURIComponent(
    isReminder
      ? `🔔 แจ้งเตือน 7 วัน – ${c.name} งวด ${p.installment}`
      : `💰 ครบชำระ – ${c.name} งวด ${p.installment}`
  );
  const desc = encodeURIComponent(
    `📌 ${c.fullLabel}\n💵 ${formatMoney(c.amount)} บาท\nงวด ${
      p.installment
    } · ${formatThai(p.dateStr)}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmtCal(
    base
  )}/${fmtCal(next)}&details=${desc}`;
}

// Messages
function msgPayment(c, p, type) {
  const dt = formatThaiLong(p.dateStr),
    amt = formatMoney(c.amount);
  const label = c.type === "จำนอง" ? "ดอกเบี้ยจำนอง" : "ดอกเบี้ยขายฝาก";
  if (type === "early")
    return `📢 แจ้งเตือนล่วงหน้า 7 วัน\n\nเรียน คุณ${c.name},\n\nAssetX Estate Co., Ltd. ขอแจ้งให้ทราบว่า\nครบกำหนดชำระ${label}งวดที่ ${p.installment} ในอีก 7 วันข้างหน้า\n\n📌 รายละเอียด:\n• ประเภท: ${c.type}\n• ยอดชำระ: ${amt} บาท\n• งวดที่: ${p.installment}\n• กำหนดชำระ: ${dt}\n\n💳 ช่องทางชำระเงิน:\nธนาคาร กสิกรไทย\nชื่อบัญชี: กิตติชัย โสมทัตถ์\nเลขบัญชี: 194-8-33331-3\n\nAssetX Estate Co., Ltd. 🏠`;
  return `⚠️ วันนี้ครบกำหนดชำระ\n\nเรียน คุณ${c.name},\n\nวันนี้ (${dt}) ครบกำหนดชำระ${label}งวดที่ ${p.installment}\n\n📌 รายละเอียด:\n• ประเภท: ${c.type}\n• ยอดชำระ: ${amt} บาท\n\n💳 ช่องทางชำระเงิน:\nธนาคาร กสิกรไทย\nชื่อบัญชี: กิตติชัย โสมทัตถ์\nเลขบัญชี: 194-8-33331-3\n\n⚠️ กรุณาชำระและส่งสลิปยืนยันด้วย\n\nAssetX Estate Co., Ltd. 🏠`;
}
function msgContract(c, diff) {
  const mo = Math.max(0, Math.floor(diff / 30));
  return `📜 แจ้งเตือนครบกำหนดสัญญา\n\nเรียน คุณ${c.name},\n\nสัญญา${
    c.type
  }จะครบกำหนดในอีก ${mo} เดือน\n\n📌 รายละเอียด:\n• เงินต้น: ${formatMoney(
    c.principal
  )} บาท\n• วันครบกำหนด: ${formatThaiLong(
    c.contractEndDate
  )}\n\n🔔 กรุณาดำเนินการก่อนวันครบกำหนด\n\nAssetX Estate Co., Ltd. 🏠`;
}

// Status Config
const P_STATUS = {
  today: {
    bg: "rgba(239,68,68,.12)",
    border: "#EF4444",
    text: "#FCA5A5",
    label: "วันนี้!",
  },
  soon: {
    bg: "rgba(245,158,11,.1)",
    border: "#F59E0B",
    text: "#FCD34D",
    label: "เร็วๆนี้",
  },
  upcoming: {
    bg: "rgba(56,189,248,.08)",
    border: "#0EA5E9",
    text: "#38BDF8",
    label: "รอชำระ",
  },
  past: {
    bg: "rgba(34,197,94,.08)",
    border: "#16A34A",
    text: "#4ADE80",
    label: "เลยกำหนด",
  },
  paid: {
    bg: "rgba(34,197,94,.12)",
    border: "#22C55E",
    text: "#86EFAC",
    label: "ชำระแล้ว ✓",
  },
};
const C_STATUS = {
  expired: {
    border: "#EF4444",
    text: "#FCA5A5",
    bg: "rgba(239,68,68,.08)",
    label: "หมดอายุ!",
  },
  critical: {
    border: "#EF4444",
    text: "#FCA5A5",
    bg: "rgba(239,68,68,.08)",
    label: "วิกฤต ≤1เดือน",
  },
  warning: {
    border: "#F59E0B",
    text: "#FCD34D",
    bg: "rgba(245,158,11,.08)",
    label: "เร่งด่วน ≤3เดือน",
  },
  notice: {
    border: "#F97316",
    text: "#FDBA74",
    bg: "rgba(249,115,22,.08)",
    label: "แจ้งเตือน ≤6เดือน",
  },
  safe: {
    border: "#16A34A",
    text: "#4ADE80",
    bg: "rgba(22,163,74,.08)",
    label: "ปกติ",
  },
};

// CSS Styles
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Kanit:wght@400;600;700&display=swap');
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #050B18; font-family: 'Sarabun', sans-serif; color: #F0F6FF; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: #162E5680; border-radius: 4px; }

  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes linePulse{0%,100%{box-shadow:0 0 8px rgba(6,199,85,.3)}50%{box-shadow:0 0 20px rgba(6,199,85,.6)}}

  .card{
    background:linear-gradient(145deg,rgba(15,22,45,.9),rgba(8,14,32,.95));
    border:1px solid #0F2545;
    border-radius:18px;
    transition:all .25s;
  }
  .card:hover{border-color:#162E5680;transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.4);}
  .btn{cursor:pointer;font-family:'Sarabun',sans-serif;transition:all .2s;}
  .btn:hover{filter:brightness(1.2);transform:scale(1.02);}
  .glass{background:rgba(8,15,30,.85);backdrop-filter:blur(16px);}
  
  .line-btn{
    background: linear-gradient(135deg, #06C755 0%, #059246 100%);
    border: none; color: #fff; font-weight: 600;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 10px; cursor: pointer;
    transition: all 0.2s; font-size: 12px; font-family: 'Sarabun', sans-serif;
  }
  .line-btn:hover{transform: scale(1.03);box-shadow: 0 4px 20px rgba(6,199,85,.4);}
  .line-btn:disabled{opacity: 0.6;cursor: not-allowed;transform: none;}
  .line-btn.sending{animation: linePulse 1s infinite;}

  .skeleton{
    background:linear-gradient(90deg,#0A1628 25%,#0F1E3A 50%,#0A1628 75%);
    background-size:200% 100%;
    animation:shimmer 1.6s infinite;
    border-radius:14px;border:1px solid #0F2545;
  }

  .badge-mortgage{background:rgba(56,189,248,.12);color:#38BDF8;border:1px solid rgba(56,189,248,.3);}
  .badge-sell{background:rgba(249,115,22,.12);color:#FB923C;border:1px solid rgba(249,115,22,.3);}

  .tab{padding:8px 18px;border-radius:30px;border:1.5px solid #0F2545;background:transparent;color:#475569;cursor:pointer;font-family:'Sarabun',sans-serif;font-size:12px;transition:all .2s;}
  .tab:hover{border-color:#162E56;}
  .tab.active{border-color:#2DD4BF;background:rgba(45,212,191,.1);color:#2DD4BF;font-weight:600;}

  .toast{
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, #06C755 0%, #059246 100%);
    color: #fff; padding: 12px 24px; border-radius: 12px; font-weight: 600;
    display: flex; align-items: center; gap: 8px; z-index: 1000;
    animation: fadeUp 0.3s ease; box-shadow: 0 8px 32px rgba(6,199,85,.4);
  }
  .toast.error{background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);box-shadow: 0 8px 32px rgba(239,68,68,.4);}
  
  .status-dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
  .status-dot.success{background:#4ADE80;box-shadow:0 0 8px rgba(74,222,128,.5);}
  .status-dot.warning{background:#F59E0B;box-shadow:0 0 8px rgba(245,158,11,.5);}
  .status-dot.error{background:#EF4444;box-shadow:0 0 8px rgba(239,68,68,.5);}
  .status-dot.loading{background:#38BDF8;animation:pulse 1.5s infinite;}
  
  .log-entry{padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:6px;font-family:monospace;}
  .log-success{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);color:#4ADE80;}
  .log-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#FCA5A5;}
  .log-info{background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38BDF8;}
`;

// Logo Component
function Logo({ size = 40 }) {
  const hasBase64 = LOGO_CONFIG.type === "base64" && LOGO_CONFIG.base64;
  const hasUrl = LOGO_CONFIG.type === "url" && LOGO_CONFIG.url;

  if (hasBase64) {
    return (
      <img
        src={`data:image/png;base64,${LOGO_CONFIG.base64}`}
        alt="Logo"
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          objectFit: "cover",
        }}
      />
    );
  }

  if (hasUrl) {
    return (
      <img
        src={LOGO_CONFIG.url}
        alt="Logo"
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          objectFit: "cover",
        }}
      />
    );
  }

  // Fallback: Text Logo
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: "linear-gradient(135deg,#2DD4BF,#7C3AED)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {LOGO_CONFIG.fallbackText}
    </div>
  );
}

// LINE Send Hook with Logging
function useLineNotification(targetUserId) {
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);

  // useRef เพื่อให้จับ targetUserId ล่าสุดเสมอ ป้องกัน stale closure
  const targetUserIdRef = React.useRef(targetUserId);
  React.useEffect(() => {
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

// Components
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ height: 88 }} />
      ))}
    </div>
  );
}

function LineButton({
  message,
  type,
  label = "ส่ง LINE",
  compact = false,
  onSend,
  destinationId = "",
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleClick = async (e) => {
    e.stopPropagation();
    setSending(true);
    try {
      const did = destinationId && destinationId.trim() ? destinationId.trim() : "";
      const url = did ? `${APPS_SCRIPT_URL}?dest=${encodeURIComponent(did)}` : APPS_SCRIPT_URL;
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendLine", message, type }),
      });
      setResult("success");
      if (onSend) onSend(true);
    } catch (err) {
      setResult("error");
      if (onSend) onSend(false);
    }
    setSending(false);
    setTimeout(() => setResult(null), 3000);
  };

  return (
    <button
      className={`line-btn ${sending ? "sending" : ""}`}
      onClick={handleClick}
      disabled={sending}
      style={compact ? { padding: "4px 10px", fontSize: 11 } : {}}
    >
      {sending ? (
        <>
          <span
            style={{
              animation: "spin 1s linear infinite",
              display: "inline-block",
            }}
          >
            ⏳
          </span>{" "}
          กำลังส่ง...
        </>
      ) : result === "success" ? (
        <>
          <span>✅</span> ส่งแล้ว!
        </>
      ) : result === "error" ? (
        <>
          <span>❌</span> ลองใหม่
        </>
      ) : (
        <>
          <span style={{ fontSize: 14 }}>💬</span> {label}
        </>
      )}
    </button>
  );
}

function TypeBadge({ type }) {
  return (
    <span
      className={type === "จำนอง" ? "badge-mortgage" : "badge-sell"}
      style={{
        borderRadius: 20,
        padding: "2px 9px",
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

// System Status Page Component
function SystemStatusPage({ lineHook, apiConnected, lastFetch, targetUserId, onSetTargetUserId, savedUserIds = [], onSaveNewUserId, onDeleteSavedUserId, syncStatus = "idle", triggerActive = false, onSetTriggerActive }) {
  const { sending, logs, testConnection, sendTestMessage, addLog } = lineHook;
  const [customMessage, setCustomMessage] = useState("");
  const [editingUserId, setEditingUserId] = useState(false);
  const [userIdInput, setUserIdInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleSaveUserId = () => {
    if (!userIdInput.trim()) return;
    onSaveNewUserId(userIdInput.trim(), labelInput.trim() || null);
    addLog("success", `✅ บันทึก User ID: ${labelInput.trim() || userIdInput.trim().substring(0, 10) + "..."}`);
    setUserIdInput("");
    setLabelInput("");
    setEditingUserId(false);
  };

  const handleCancelEdit = () => {
    setUserIdInput("");
    setLabelInput("");
    setEditingUserId(false);
  };

  const handleSelect = (id) => {
    onSetTargetUserId(id);
    addLog("info", `🔄 เปลี่ยน Active ID → ${id.substring(0, 10)}...`);
  };

  const handleDelete = (id) => {
    if (confirmDelete === id) {
      onDeleteSavedUserId(id);
      setConfirmDelete(null);
      addLog("info", "🗑️ ลบ User ID แล้ว");
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const sendCustom = async () => {
    if (!customMessage.trim()) return;
    addLog("info", "กำลังส่งข้อความ Manual...");
    try {
      const did = targetUserId && targetUserId.trim() ? targetUserId.trim() : "";
      const url = did ? `${APPS_SCRIPT_URL}?dest=${encodeURIComponent(did)}` : APPS_SCRIPT_URL;
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sendLine", message: customMessage, type: "manual" }),
      });
      addLog("success", "✅ ส่งข้อความ Manual สำเร็จ");
      setCustomMessage("");
    } catch (err) {
      addLog("error", "❌ ส่งล้มเหลว: " + err.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* System Status Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >
        {/* LINE API Status */}
        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>💬</span>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.textPri }}>
                LINE API
              </div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>
                Messaging API
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              className={`status-dot ${apiConnected ? "success" : "warning"}`}
            ></span>
            <span
              style={{
                fontSize: 13,
                color: apiConnected ? "#4ADE80" : "#F59E0B",
              }}
            >
              {apiConnected ? "เชื่อมต่อแล้ว" : "รอตรวจสอบ"}
            </span>
          </div>
          <button
            onClick={testConnection}
            disabled={sending}
            className="btn"
            style={{
              width: "100%",
              padding: "8px",
              background: "rgba(56,189,248,.1)",
              border: "1px solid rgba(56,189,248,.3)",
              borderRadius: 8,
              color: "#38BDF8",
              fontSize: 12,
            }}
          >
            {sending ? "⏳ กำลังทดสอบ..." : "🔄 ทดสอบการเชื่อมต่อ"}
          </button>
        </div>

        {/* User ID Management */}
        <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>👤</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700, color: BRAND.textPri }}>User ID ผู้รับแจ้งเตือน</div>
                  {/* Sync badge */}
                  {syncStatus === "syncing" && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(56,189,248,.15)", border: "1px solid rgba(56,189,248,.3)", color: "#38BDF8", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> กำลัง Sync...
                    </span>
                  )}
                  {syncStatus === "synced" && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(74,222,128,.15)", border: "1px solid rgba(74,222,128,.3)", color: "#4ADE80" }}>
                      ✅ Synced กับ Script
                    </span>
                  )}
                  {syncStatus === "error" && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", color: "#FCA5A5" }}>
                      ❌ Sync ล้มเหลว
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: BRAND.textSec }}>
                  {savedUserIds.length > 0 ? `บันทึกไว้ ${savedUserIds.length} ID` : "ยังไม่มี ID ที่บันทึก"}
                </div>
              </div>
            </div>
            {!editingUserId && (
              <button onClick={() => setEditingUserId(true)} className="btn" style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12,
                background: "rgba(45,212,191,.1)", border: "1px solid rgba(45,212,191,.3)",
                color: BRAND.teal, display: "flex", alignItems: "center", gap: 5,
              }}>
                ➕ เพิ่ม ID ใหม่
              </button>
            )}
          </div>

          {/* Active ID banner */}
          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 10,
            background: targetUserId ? "rgba(45,212,191,.08)" : "rgba(239,68,68,.06)",
            border: `1px solid ${targetUserId ? "rgba(45,212,191,.25)" : "rgba(239,68,68,.25)"}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span className={`status-dot ${targetUserId ? "success" : "error"}`}></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: BRAND.textSec, marginBottom: 2 }}>
                {targetUserId ? "🟢 Active — ส่งแจ้งเตือนไปที่:" : "🔴 ยังไม่ได้เลือก User ID"}
              </div>
              {targetUserId && (
                <>
                  <div style={{ fontWeight: 700, color: BRAND.teal, fontSize: 13 }}>
                    {savedUserIds.find(u => u.id === targetUserId)?.label || "ไม่มีชื่อ"}
                  </div>
                  <div style={{
                    fontSize: 11, color: BRAND.textSec, fontFamily: "monospace",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {targetUserId}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Saved IDs list */}
          {savedUserIds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: editingUserId ? 14 : 0 }}>
              {savedUserIds.map((u) => {
                const isActive = u.id === targetUserId;
                const isDeleting = confirmDelete === u.id;
                return (
                  <div key={u.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 10,
                    background: isActive ? "rgba(45,212,191,.1)" : "rgba(0,0,0,.2)",
                    border: `1px solid ${isActive ? "rgba(45,212,191,.35)" : BRAND.border}`,
                    transition: "all .2s",
                  }}>
                    {/* Select radio */}
                    <div
                      onClick={() => handleSelect(u.id)}
                      style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${isActive ? BRAND.teal : BRAND.textMut}`,
                        background: isActive ? BRAND.teal : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all .2s",
                      }}
                    >
                      {isActive && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#000" }} />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => handleSelect(u.id)}>
                      <div style={{ fontWeight: 600, color: isActive ? BRAND.teal : BRAND.textPri, fontSize: 13 }}>
                        {u.label}
                        {isActive && <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: .5,
                          background: BRAND.teal, color: "#000", padding: "1px 6px", borderRadius: 10,
                        }}>ACTIVE</span>}
                      </div>
                      <div style={{
                        fontSize: 10, color: BRAND.textMut, fontFamily: "monospace",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {u.id}
                      </div>
                      <div style={{ fontSize: 9, color: BRAND.textMut, marginTop: 1 }}>บันทึก: {u.savedAt}</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {!isActive && (
                        <button onClick={() => handleSelect(u.id)} className="btn" style={{
                          padding: "4px 9px", borderRadius: 7, fontSize: 11,
                          background: "rgba(45,212,191,.08)", border: "1px solid rgba(45,212,191,.2)",
                          color: BRAND.teal,
                        }}>ใช้งาน</button>
                      )}
                      <button onClick={() => handleDelete(u.id)} className="btn" style={{
                        padding: "4px 9px", borderRadius: 7, fontSize: 11,
                        background: isDeleting ? "rgba(239,68,68,.2)" : "rgba(239,68,68,.06)",
                        border: `1px solid ${isDeleting ? "#EF4444" : "rgba(239,68,68,.2)"}`,
                        color: isDeleting ? "#FCA5A5" : "#EF444490",
                        transition: "all .2s",
                      }}>
                        {isDeleting ? "ยืนยันลบ?" : "🗑️"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new ID form */}
          {editingUserId && (
            <div style={{
              marginTop: savedUserIds.length > 0 ? 4 : 0,
              padding: 14, borderRadius: 10,
              background: "rgba(45,212,191,.04)",
              border: "1px dashed rgba(45,212,191,.3)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.teal, marginBottom: 2 }}>
                ➕ เพิ่ม User ID ใหม่
              </div>
              <input
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="ชื่อเรียก เช่น Admin, ทีมงาน..."
                style={{
                  width: "100%", padding: "8px 10px",
                  background: "rgba(0,0,0,.35)", border: "1px solid rgba(100,116,139,.4)",
                  borderRadius: 8, color: BRAND.textPri, fontSize: 12, outline: "none",
                  fontFamily: "'Sarabun', sans-serif",
                }}
              />
              <input
                value={userIdInput}
                onChange={e => setUserIdInput(e.target.value)}
                placeholder="LINE User ID เช่น Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoFocus
                style={{
                  width: "100%", padding: "8px 10px",
                  background: "rgba(0,0,0,.35)", border: "1px solid rgba(45,212,191,.35)",
                  borderRadius: 8, color: BRAND.teal, fontSize: 12,
                  fontFamily: "monospace", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleSaveUserId} disabled={!userIdInput.trim()} className="btn" style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, fontWeight: 700, fontSize: 12,
                  background: userIdInput.trim() ? "linear-gradient(135deg,#2DD4BF,#0E7490)" : "rgba(45,212,191,.1)",
                  border: "none", color: userIdInput.trim() ? "#000" : BRAND.textMut,
                }}>
                  💾 บันทึก &amp; ใช้งาน
                </button>
                <button onClick={handleCancelEdit} className="btn" style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 12,
                  background: "rgba(100,116,139,.1)", border: "1px solid rgba(100,116,139,.3)",
                  color: BRAND.textSec,
                }}>
                  ยกเลิก
                </button>
              </div>
              <div style={{ fontSize: 10, color: BRAND.textMut, lineHeight: 1.6 }}>
                💡 รับ User ID โดยส่งข้อความหา LINE Bot แล้วดูใน Apps Script Log
              </div>
            </div>
          )}

          {savedUserIds.length === 0 && !editingUserId && (
            <div style={{ textAlign: "center", padding: "16px 0", color: BRAND.textMut, fontSize: 13 }}>
              ยังไม่มี User ID — กด <span style={{ color: BRAND.teal }}>➕ เพิ่ม ID ใหม่</span> เพื่อเริ่มต้น
            </div>
          )}
        </div>

        {/* API Endpoint Status */}
        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>🌐</span>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.textPri }}>
                API Endpoint
              </div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>
                Google Apps Script
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              className={`status-dot ${apiConnected ? "success" : "warning"}`}
            ></span>
            <span
              style={{
                fontSize: 13,
                color: apiConnected ? "#4ADE80" : "#F59E0B",
              }}
            >
              {apiConnected ? "Deploy แล้ว" : "รอ Deploy"}
            </span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: BRAND.textMut,
              wordBreak: "break-all",
            }}
          >
            {APPS_SCRIPT_URL.substring(0, 45)}...
          </div>
        </div>

        {/* Auto Notification Status */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>⏰</span>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.textPri }}>แจ้งเตือนอัตโนมัติ</div>
              <div style={{ fontSize: 11, color: BRAND.textSec }}>Daily Trigger</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className={`status-dot ${triggerActive ? "success" : "warning"}`}></span>
            <span style={{ fontSize: 13, color: triggerActive ? "#10B981" : "#F59E0B" }}>
              {triggerActive ? "✅ Trigger ทำงานอยู่ (8–9 AM)" : "รอตั้ง Trigger"}
            </span>
          </div>
          <div style={{ fontSize: 10, color: BRAND.textMut, marginBottom: 10 }}>
            {triggerActive ? "ระบบจะส่งแจ้งเตือนอัตโนมัติทุกวัน" : "ตั้งค่าใน Apps Script → Triggers"}
          </div>
          {!triggerActive ? (
            <button
              onClick={() => {
                localStorage.setItem("assetx_trigger_active", "true")
                onSetTriggerActive && onSetTriggerActive(true)
              }}
              style={{
                background: "#10B981", color: "#fff", border: "none",
                borderRadius: 8, padding: "7px 14px", fontSize: 12,
                fontWeight: 600, cursor: "pointer", width: "100%"
              }}
            >
              ✅ ฉันตั้ง Trigger แล้ว
            </button>
          ) : (
            <button
              onClick={() => {
                localStorage.setItem("assetx_trigger_active", "false")
                onSetTriggerActive && onSetTriggerActive(false)
              }}
              style={{
                background: "transparent", color: "#9CA3AF", border: "1px solid #E5E7EB",
                borderRadius: 8, padding: "6px 14px", fontSize: 11,
                cursor: "pointer", width: "100%"
              }}
            >
              รีเซ็ตสถานะ
            </button>
          )}
        </div>
      </div>

      {/* Manual Send Section */}
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            fontWeight: 700,
            color: BRAND.textPri,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>📤</span> ส่ง LINE แบบ Manual
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={sendTestMessage}
            disabled={sending}
            className="line-btn"
            style={{ flex: "0 0 auto" }}
          >
            {sending ? "⏳ กำลังส่ง..." : "🧪 ส่งข้อความทดสอบ"}
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 12,
              color: BRAND.textSec,
              marginBottom: 6,
              display: "block",
            }}
          >
            ข้อความที่ต้องการส่ง:
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="พิมพ์ข้อความที่ต้องการส่งผ่าน LINE..."
            style={{
              width: "100%",
              height: 100,
              background: "rgba(0,0,0,.3)",
              border: "1px solid " + BRAND.border,
              borderRadius: 10,
              padding: 12,
              color: BRAND.textPri,
              fontSize: 13,
              resize: "vertical",
              fontFamily: "'Sarabun',sans-serif",
            }}
          />
        </div>
        <button
          onClick={sendCustom}
          disabled={sending || !customMessage.trim()}
          className="line-btn"
        >
          {sending ? "⏳ กำลังส่ง..." : "📤 ส่งข้อความนี้"}
        </button>
      </div>

      {/* Activity Log */}
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            fontWeight: 700,
            color: BRAND.textPri,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            <span style={{ fontSize: 20 }}>📋</span> Log กิจกรรม
          </span>
          <span style={{ fontSize: 11, color: BRAND.textSec }}>
            {logs.length} รายการ
          </span>
        </div>

        <div style={{ maxHeight: 250, overflowY: "auto" }}>
          {logs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 20,
                color: BRAND.textMut,
                fontSize: 13,
              }}
            >
              ยังไม่มีกิจกรรม - ลองกดปุ่มทดสอบด้านบน
            </div>
          ) : (
            logs
              .slice()
              .reverse()
              .map((log, i) => (
                <div key={i} className={`log-entry log-${log.type}`}>
                  <span style={{ opacity: 0.7 }}>[{log.time}]</span>{" "}
                  {log.message}
                </div>
              ))
          )}
        </div>
      </div>

      {/* Quick Guide */}
      <div
        className="card"
        style={{ padding: 20, borderColor: "rgba(45,212,191,.3)" }}
      >
        <div style={{ fontWeight: 700, color: BRAND.teal, marginBottom: 12 }}>
          📖 วิธีตั้งค่าให้ครบ
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13,
            color: BRAND.textSec,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "#4ADE80" }}>✅</span>
            <span>LINE Channel Access Token - ตั้งค่าแล้ว</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: targetUserId ? "#4ADE80" : "#F59E0B" }}>{targetUserId ? "✅" : "⏳"}</span>
              <span>User ID ผู้รับแจ้งเตือน
                {targetUserId
                  ? <span style={{ color: BRAND.teal, fontFamily: "monospace", marginLeft: 6, fontSize: 11 }}>
                      ({targetUserId.substring(0, 10)}...)
                    </span>
                  : <span style={{ color: "#F59E0B", marginLeft: 6, fontSize: 11 }}> - ยังไม่ได้ตั้งค่า</span>
                }
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: apiConnected ? "#4ADE80" : "#F59E0B" }}>
              {apiConnected ? "✅" : "⏳"}
            </span>
            <span>Deploy Apps Script เป็น Web App</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "#F59E0B" }}>⏳</span>
            <span>ตั้ง Trigger แจ้งเตือนอัตโนมัติ (8:00-9:00 น.)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ข้อมูลผู้ส่ง (เจ้าของระบบ) ────────────────────────────────
const SENDER_INFO = {
  name: "จักรพันธ์ ศรีสว่าง",
  position: "ผู้จัดการ",
  company: "บริษัท แอสเสท เอ็กซ์ เอสเตท จำกัด",
  address: "345/34 หมู่บ้านแกรนดิโอ2 - พระราม2 หมู่ที่ 5 ตำบลพันท้ายนรสิงห์ อำเภอเมืองสมุทรสาคร จังหวัดสมุทรสาคร 74000",
};

// ── แปลงตัวเลขเป็นภาษาไทย ──────────────────────────────────────
function numberToThaiText(amount) {
  if (amount === 0) return "ศูนย์บาทถ้วน";
  const DIGITS = ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"];
  const POSITIONS = ["","สิบ","ร้อย","พัน","หมื่น","แสน","ล้าน"];
  const baht = Math.floor(amount);
  const satang = Math.round((amount - baht) * 100);
  let result = "";
  if (baht > 0) {
    const s = String(baht);
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(s[i]);
      const pos = len - i - 1;
      if (d === 0) continue;
      if (pos === 1 && d === 1) result += "สิบ";
      else if (pos === 1 && d === 2) result += "ยี่สิบ";
      else if (pos === 0 && d === 1 && len > 1) result += "เอ็ด";
      else result += DIGITS[d] + POSITIONS[pos % 6] + (pos === 6 ? "ล้าน" : "");
    }
    result += "บาท";
  }
  if (satang > 0) {
    const ss = String(satang).padStart(2, "0");
    for (let i = 0; i < 2; i++) {
      const d = parseInt(ss[i]);
      const pos = 1 - i;
      if (d === 0) continue;
      if (pos === 1 && d === 1) result += "สิบ";
      else if (pos === 1 && d === 2) result += "ยี่สิบ";
      else if (pos === 0 && d === 1 && satang >= 10) result += "เอ็ด";
      else result += DIGITS[d] + POSITIONS[pos];
    }
    result += "สตางค์";
  } else {
    result += "ถ้วน";
  }
  return result;
}

// ── แปลงวันที่เป็นรูปแบบไทย ────────────────────────────────────
function formatThaiDateFull(dateStr) {
  const MONTHS = ["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = MONTHS[d.getMonth() + 1];
  const year = d.getFullYear() + 543;
  return `${day} ${month} พ.ศ. ${year}`;
}

// ── จัดรูปแบบเนื้อที่ดิน ────────────────────────────────────────
function formatLandArea(areaStr) {
  // แปลง "0-1-75.4 ไร่" → "1 งาน 75.4 ตารางวา"
  if (!areaStr) return "-";
  const m = areaStr.match(/^(\d+)-(\d+)-([\d.]+)/);
  if (!m) return areaStr;
  const parts = [];
  if (parseInt(m[1]) > 0) parts.push(`${m[1]} ไร่`);
  if (parseInt(m[2]) > 0) parts.push(`${m[2]} งาน`);
  if (parseFloat(m[3]) > 0) parts.push(`${m[3]} ตารางวา`);
  return parts.join(" ") || "-";
}

// ── สร้างและพิมพ์ Notice ────────────────────────────────────────
function printNotice(customer, extraInfo, docNumber) {
  const deed = customer.deeds?.[0] || {};
  const allDeeds = customer.deeds || [];
  const today = new Date();
  const todayStr = formatThaiDateFull(today.toISOString().split("T")[0]);
  const contractEndStr = formatThaiDateFull(customer.contractEndDate);
  const contractDateStr = extraInfo.contractDate
    ? formatThaiDateFull(extraInfo.contractDate) : "-";

  // คำนวณสินไถ่รวม (เงินต้น + ดอกเบี้ยที่เหลือ)
  const remaining = customer.payments?.filter(p => p.diff >= 0).length || 0;
  const totalInterest = (customer.amount || 0) * remaining;
  const totalRedemption = (customer.principal || 0) + totalInterest;

  // รายการโฉนดทั้งหมด
  const deedList = allDeeds.map((d, i) =>
    `โฉนดเลขที่ ${d.no || "-"} เลขที่ดิน ${d.landNo || "-"} ต.${d.tambon || "-"} อ.${d.amphoe || "-"} จ.${d.province || "-"} เนื้อที่ ${formatLandArea(d.area)}`
  ).join("\n           ");

  // land office จาก deed แรก
  const landOffice = extraInfo.landOffice || `สำนักงานที่ดินจังหวัด${deed.province || "-"}`;

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>หนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก - ${customer.name}</title>
<style>
  @page { size: A4; margin: 2.5cm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'TH Sarabun New', 'Sarabun', serif;
    font-size: 16pt;
    line-height: 1.8;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .title { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 8px; }
  .doc-info { text-align: right; margin-bottom: 16px; }
  .section { margin-bottom: 12px; }
  .indent { padding-left: 60px; }
  .indent2 { padding-left: 80px; }
  .sign-area { text-align: center; margin-top: 40px; }
  .dotline { display: inline-block; width: 220px; border-bottom: 1px dotted #000; }
  .remark { margin-top: 20px; font-size: 13pt; border-top: 1px solid #000; padding-top: 8px; }
  .no-print { display: none; }
  @media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="no-print" style="display:block; text-align:center; margin-bottom:20px; font-family:sans-serif;">
  <button onclick="window.print()" style="padding:10px 30px;font-size:16px;background:#2DD4BF;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">
    🖨️ พิมพ์ / บันทึก PDF
  </button>
</div>

<div class="title">หนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก</div>

<div class="doc-info">
  ที่ ${docNumber}<br>
  วันที่ ${todayStr}
</div>

<div class="section">
  <span class="bold">เรื่อง</span>&nbsp;&nbsp;&nbsp;แจ้งกำหนดเวลาไถ่และจำนวนสินไถ่จากการขายฝาก
</div>

<div class="section">
  <span class="bold">เรียน</span>&nbsp;&nbsp;&nbsp;${extraInfo.fullName || customer.name} (ผู้ขายฝาก)<br>
  <span class="indent">${extraInfo.address || "-"}</span>
</div>

<div class="section">
  <span class="bold">อ้างถึง</span>&nbsp;&nbsp;สัญญาขายฝากที่ดิน เลขที่ ${extraInfo.contractNumber || "-"} ลงวันที่ ${contractDateStr}<br>
  <span class="indent2">จดทะเบียน ณ ${landOffice}</span>
</div>

<div class="section">
  <span class="bold">สิ่งที่ส่งมาด้วย</span>&nbsp;&nbsp;สำเนาสัญญาขายฝาก จำนวน 1 ชุด
</div>

<div class="section indent" style="margin-top:16px;">
  ตามที่ท่านได้ทำสัญญาขายฝากที่ดิน ${deedList}
  ไว้กับข้าพเจ้า ตามสัญญาขายฝากอ้างถึงนั้น
</div>

<div class="section indent">
  บัดนี้ ใกล้จะครบกำหนดเวลาไถ่ตามสัญญาแล้ว ข้าพเจ้าจึงขอแจ้งรายละเอียด ดังนี้
</div>

<div class="section indent2">
  1. กำหนดวันครบกำหนดไถ่&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${contractEndStr}<br>
  2. จำนวนสินไถ่&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${totalRedemption.toLocaleString("th-TH", {minimumFractionDigits:2})} บาท<br>
  &nbsp;&nbsp;&nbsp;&nbsp;(${numberToThaiText(totalRedemption)})<br>
  &nbsp;&nbsp;&nbsp;&nbsp;ประกอบด้วย<br>
  &nbsp;&nbsp;&nbsp;&nbsp;- เงินต้น (ราคาขายฝาก)&nbsp;&nbsp;:&nbsp;&nbsp;${(customer.principal||0).toLocaleString("th-TH", {minimumFractionDigits:2})} บาท<br>
  &nbsp;&nbsp;&nbsp;&nbsp;- ผลประโยชน์ตอบแทน&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${totalInterest.toLocaleString("th-TH", {minimumFractionDigits:2})} บาท<br>
  3. สถานที่ชำระสินไถ่&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;${SENDER_INFO.company} ${SENDER_INFO.address}
</div>

<div class="section indent" style="margin-top:16px;">
  จึงเรียนมาเพื่อทราบและดำเนินการไถ่ถอนภายในกำหนดเวลาข้างต้น
</div>

<div class="sign-area">
  ขอแสดงความนับถือ<br><br><br>
  <span class="dotline"></span><br>
  (${SENDER_INFO.name})<br>
  ${SENDER_INFO.position}<br>
  ${SENDER_INFO.company}
</div>

<div class="remark">
  <span class="bold">หมายเหตุ:</span> หนังสือฉบับนี้ส่งทางไปรษณีย์ลงทะเบียนตอบรับ
  ตามมาตรา 17 แห่ง พ.ร.บ. คุ้มครองประชาชนในการทำสัญญาขายฝากที่ดินเพื่อเกษตรกรรม
  หรือที่อยู่อาศัย พ.ศ. 2562
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  win.document.write(html);
  win.document.close();
}

// ── Modal บันทึกสลิปการชำระเงิน ────────────────────────────────
function SlipModal({ customer, payment, existing, onSave, onDelete, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = React.useState({
    paidDate: existing?.paidDate || today,
    amount: existing?.amount || customer.amount || "",
    note: existing?.note || "",
    slipUrl: existing?.slipUrl || existing?.slipImage || null,
    slipId: existing?.slipId || null,
    slipDeleteUrl: existing?.slipDeleteUrl || null,
  });
  const [imgPreview, setImgPreview] = React.useState(existing?.slipUrl || existing?.slipImage || null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // แปลงเป็น base64 ก่อนส่ง (รองรับ album parameter ได้ดีกว่า)
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result.split(",")[1]);
        reader.readAsDataURL(file);
      });
      const now = new Date();
      const albumKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      const albumId = IMGBB_ALBUMS[albumKey];
      const fd = new FormData();
      fd.append("image", base64);
      if (albumId) fd.append("album", albumId);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setImgPreview(data.data.url);
        setForm(prev => ({
          ...prev,
          slipUrl: data.data.url,
          slipId: data.data.id,
          slipDeleteUrl: data.data.delete_url,
        }));
      } else {
        alert("อัปโหลดรูปไม่สำเร็จ: " + (data.error?.message || "กรุณาลองใหม่"));
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!form.paidDate || !form.amount) return;
    setSaving(true);
    onSave({
      paidDate: form.paidDate,
      amount: parseFloat(form.amount),
      note: form.note,
      slipUrl: form.slipUrl,
      slipId: form.slipId,
      slipDeleteUrl: form.slipDeleteUrl,
      savedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,.75)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#080F1E", border: "1px solid rgba(45,212,191,.25)",
        borderRadius: 16, padding: 24, width: "100%", maxWidth: 420,
        maxHeight: "90vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, color: BRAND.textPri, fontSize: 16 }}>บันทึกการชำระเงิน</div>
            <div style={{ fontSize: 12, color: BRAND.textSec, marginTop: 2 }}>
              {customer.name} — งวดที่ {payment.installment} ({formatThai(payment.dateStr)})
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: BRAND.textSec, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* วันที่ชำระ */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>วันที่ชำระเงิน *</label>
            <input type="date" value={form.paidDate}
              onChange={e => setForm(p => ({ ...p, paidDate: e.target.value }))}
              style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(45,212,191,.25)", borderRadius: 8, color: BRAND.textPri, fontSize: 14, padding: "9px 12px", outline: "none" }}
            />
          </div>

          {/* จำนวนเงิน */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>จำนวนเงินที่ชำระ (บาท) *</label>
            <input type="number" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(45,212,191,.25)", borderRadius: 8, color: BRAND.textPri, fontSize: 14, padding: "9px 12px", outline: "none" }}
            />
            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 3 }}>
              ยอดที่ต้องชำระ: {(customer.amount || 0).toLocaleString("th-TH")} บาท
            </div>
          </div>

          {/* หมายเหตุ */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>หมายเหตุ / เลขอ้างอิง</label>
            <input type="text" value={form.note}
              onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="เช่น โอนผ่าน SCB เลขที่ 123456"
              style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(45,212,191,.25)", borderRadius: 8, color: BRAND.textPri, fontSize: 13, padding: "9px 12px", outline: "none" }}
            />
          </div>

          {/* อัปโหลดสลิป */}
          <div>
            <label style={{ fontSize: 12, color: BRAND.textSec, display: "block", marginBottom: 5 }}>แนบสลิปการโอนเงิน</label>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 0", borderRadius: 8, cursor: "pointer",
              border: "1px dashed rgba(45,212,191,.35)", background: "rgba(45,212,191,.04)",
              color: BRAND.teal, fontSize: 13, fontWeight: 600,
            }}>
              {uploading ? "⏳ กำลังอัปโหลด..." : imgPreview ? "เปลี่ยนรูปสลิป" : "📎 เลือกไฟล์รูปภาพ"}
              <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} disabled={uploading} />
            </label>
            {imgPreview && (
              <div style={{ marginTop: 10, position: "relative" }}>
                <img src={imgPreview} alt="slip" style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(45,212,191,.2)" }} />
                <button onClick={() => { setImgPreview(null); setForm(p => ({ ...p, slipUrl: null, slipId: null, slipDeleteUrl: null })); }}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.7)", border: "none", borderRadius: "50%", color: "#fff", width: 24, height: 24, cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {existing && (
            <button onClick={() => { onDelete(); onClose(); }} style={{
              flex: "0 0 auto", padding: "10px 16px", borderRadius: 8,
              background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
              color: "#FCA5A5", fontSize: 13, cursor: "pointer",
            }}>
              🗑️ ลบ
            </button>
          )}
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
            color: BRAND.textSec, fontSize: 13, cursor: "pointer",
          }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={!form.paidDate || !form.amount}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 8,
              background: form.paidDate && form.amount
                ? "linear-gradient(135deg,#22C55E,#16A34A)"
                : "rgba(34,197,94,.15)",
              border: "none", color: form.paidDate && form.amount ? "#000" : BRAND.textSec,
              fontWeight: 700, fontSize: 14, cursor: form.paidDate && form.amount ? "pointer" : "not-allowed",
            }}>
            ✓ บันทึกการชำระ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ข้อมูลเพิ่มเติมลูกค้า (ที่อยู่, เลขสัญญา ฯลฯ) ──────────────
function CustomerExtraInfoSection({ customer, extraInfoMap, onUpdate }) {
  const info = extraInfoMap[customer.id] || {};
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState(info);

  React.useEffect(() => {
    setForm(extraInfoMap[customer.id] || {});
  }, [extraInfoMap, customer.id]);

  const handleSave = () => {
    onUpdate(customer.id, form);
    setEditing(false);
  };

  const field = (key, label, placeholder = "") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, color: BRAND.textSec }}>{label}</label>
      <input
        value={form[key] || ""}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          background: "rgba(255,255,255,.05)", border: "1px solid rgba(45,212,191,.2)",
          borderRadius: 7, color: BRAND.textPri, fontSize: 12, padding: "6px 10px", outline: "none",
        }}
      />
    </div>
  );

  const isComplete = info.fullName && info.address && info.contractNumber;

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: isComplete ? "rgba(45,212,191,.04)" : "rgba(245,158,11,.04)",
      border: `1px solid ${isComplete ? "rgba(45,212,191,.2)" : "rgba(245,158,11,.2)"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>ข้อมูลสำหรับจดหมาย Notice</span>
          {!isComplete && <span style={{ fontSize: 10, color: "#F59E0B", background: "rgba(245,158,11,.15)", padding: "2px 8px", borderRadius: 20 }}>ยังไม่ครบ</span>}
        </div>
        <button onClick={() => setEditing(v => !v)} style={{
          background: "rgba(45,212,191,.1)", border: "1px solid rgba(45,212,191,.3)",
          borderRadius: 6, color: BRAND.teal, fontSize: 11, padding: "3px 10px", cursor: "pointer",
        }}>
          {editing ? "ยกเลิก" : isComplete ? "แก้ไข" : "+ กรอกข้อมูล"}
        </button>
      </div>

      {!editing && isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec, display: "flex", flexDirection: "column", gap: 3 }}>
          <div><span style={{ color: BRAND.textPri }}>ชื่อ:</span> {info.fullName}</div>
          <div><span style={{ color: BRAND.textPri }}>ที่อยู่:</span> {info.address}</div>
          <div><span style={{ color: BRAND.textPri }}>เลขที่สัญญา:</span> {info.contractNumber} | <span style={{ color: BRAND.textPri }}>วันที่:</span> {info.contractDate || "-"}</div>
          {info.landOffice && <div><span style={{ color: BRAND.textPri }}>สำนักงานที่ดิน:</span> {info.landOffice}</div>}
        </div>
      )}
      {!editing && !isComplete && (
        <div style={{ fontSize: 12, color: BRAND.textSec }}>กรอกข้อมูลเพื่อใช้สร้างจดหมาย Notice</div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {field("fullName", "ชื่อ-นามสกุลเต็ม (ผู้ขายฝาก)", "เช่น นายสมชาย ใจดี")}
          {field("address", "ที่อยู่สำหรับจ่าหน้าซอง", "เช่น 123 ถ.สุขุมวิท กรุงเทพฯ 10110")}
          {field("contractNumber", "เลขที่สัญญาขายฝาก", "เช่น ขฝ.2568/001")}
          {field("contractDate", "วันที่ทำสัญญา (YYYY-MM-DD)", "เช่น 2025-03-19")}
          {field("landOffice", "สำนักงานที่ดิน (ไม่บังคับ — ระบบใช้จากโฉนดอัตโนมัติ)", "เช่น สำนักงานที่ดินจังหวัดสมุทรสาคร")}
          <button onClick={handleSave} style={{
            padding: "8px 0", borderRadius: 8, marginTop: 4,
            background: "linear-gradient(135deg,#2DD4BF,#0E7490)",
            border: "none", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            บันทึก
          </button>
        </div>
      )}
    </div>
  );
}

// ── LINE User ID Section per Customer ──────────────────────────
function CustomerLineIdSection({ customer, customerLineIds, savedUserIds, onUpdate }) {
  const currentId = customerLineIds[customer.id] || "";
  const [input, setInput] = React.useState(currentId);
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    setInput(customerLineIds[customer.id] || "");
  }, [customerLineIds, customer.id]);

  const handleSave = () => {
    onUpdate(customer.id, input.trim());
    setEditing(false);
  };

  const handleSelect = (id) => {
    setInput(id);
    onUpdate(customer.id, id);
    setEditing(false);
  };

  return (
    <div style={{
      marginBottom: 16,
      padding: "12px 14px",
      background: currentId ? "rgba(45,212,191,.06)" : "rgba(239,68,68,.05)",
      border: `1px solid ${currentId ? "rgba(45,212,191,.2)" : "rgba(239,68,68,.2)"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>LINE User ID ลูกค้า</span>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          style={{
            background: "rgba(45,212,191,.1)", border: "1px solid rgba(45,212,191,.3)",
            borderRadius: 6, color: BRAND.teal, fontSize: 11, padding: "3px 10px", cursor: "pointer",
          }}
        >
          {editing ? "ยกเลิก" : currentId ? "แก้ไข" : "+ ตั้งค่า"}
        </button>
      </div>

      {!editing && (
        <div style={{ fontSize: 12, color: currentId ? BRAND.teal : BRAND.textSec, fontFamily: currentId ? "monospace" : "inherit" }}>
          {currentId
            ? <>
                <span style={{ fontSize: 10, color: BRAND.textSec, fontFamily: "inherit", marginRight: 6 }}>
                  {savedUserIds.find(u => u.id === currentId)?.label || ""}
                </span>
                {currentId}
              </>
            : "ยังไม่ได้ตั้งค่า — ปุ่ม LINE จะใช้ User ID หลักแทน"}
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* เลือกจากรายการที่บันทึกไว้ */}
          {savedUserIds.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, color: BRAND.textSec }}>เลือกจาก ID ที่บันทึกไว้</div>
              {savedUserIds.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  style={{
                    textAlign: "left", padding: "6px 10px",
                    background: input === u.id ? "rgba(45,212,191,.15)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${input === u.id ? "rgba(45,212,191,.4)" : BRAND.border}`,
                    borderRadius: 7, cursor: "pointer", color: BRAND.textPri, fontSize: 12,
                  }}
                >
                  <span style={{ color: BRAND.teal, fontWeight: 600 }}>{u.label || "ไม่มีชื่อ"}</span>
                  <span style={{ color: BRAND.textSec, marginLeft: 8, fontFamily: "monospace", fontSize: 11 }}>
                    {u.id.substring(0, 20)}...
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* กรอก ID เอง */}
          <div style={{ fontSize: 10, color: BRAND.textSec }}>หรือกรอก User ID เอง</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{
                flex: 1, background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(45,212,191,.2)", borderRadius: 8,
                color: BRAND.textPri, fontSize: 12, padding: "7px 10px",
                outline: "none", fontFamily: "monospace",
              }}
            />
            <button
              onClick={handleSave}
              disabled={!input.trim()}
              style={{
                padding: "7px 14px", borderRadius: 8,
                background: input.trim() ? "linear-gradient(135deg,#2DD4BF,#0E7490)" : "rgba(45,212,191,.1)",
                border: "none", color: input.trim() ? "#000" : BRAND.textSec,
                fontWeight: 600, fontSize: 12, cursor: input.trim() ? "pointer" : "not-allowed",
              }}
            >
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main App Component
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [filter, setFilter] = useState("all");
  const [mainTab, setMainTab] = useState("customers");
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDeeds, setExpandedDeeds] = useState({});
  const [slipModal, setSlipModal] = React.useState(null); // { customer, payment }
  const [toast, setToast] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [currentView, setCurrentView] = useState("main");
  const [triggerActive, setTriggerActive] = useState(
    () => localStorage.getItem("assetx_trigger_active") === "true"
  );

  // ── User ID Management + Real-time Sync ────────────────────
  const [targetUserId, setTargetUserId] = useState(
    () => localStorage.getItem("assetx_target_user_id") || ""
  );
  const [savedUserIds, setSavedUserIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_saved_user_ids") || "[]"); }
    catch { return []; }
  });
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error

  // ── ข้อมูลเพิ่มเติมลูกค้า (สำหรับจดหมาย Notice) ────────────────
  const [customerExtraInfo, setCustomerExtraInfo] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_customer_extra_info") || "{}"); }
    catch { return {}; }
  });
  const updateCustomerExtraInfo = React.useCallback((customerId, info) => {
    setCustomerExtraInfo(prev => {
      const updated = { ...prev, [customerId]: { ...prev[customerId], ...info } };
      localStorage.setItem("assetx_customer_extra_info", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── counter เลขที่หนังสือ ────────────────────────────────────────
  const [noticeCounter, setNoticeCounter] = React.useState(() => {
    return parseInt(localStorage.getItem("assetx_notice_counter") || "0");
  });
  const getDocNumber = React.useCallback(() => {
    const next = noticeCounter + 1;
    setNoticeCounter(next);
    localStorage.setItem("assetx_notice_counter", String(next));
    const year = new Date().getFullYear() + 543;
    return `ขฝ.${String(next).padStart(3,"0")}/${year}`;
  }, [noticeCounter]);

  // ── บันทึกการชำระเงิน (สลิป) ────────────────────────────────────
  const [paymentRecords, setPaymentRecords] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_payment_records") || "{}"); }
    catch { return {}; }
  });

  // โหลดข้อมูลจาก Apps Script เพื่อ sync ข้ามอุปกรณ์
  React.useEffect(() => {
    fetch(`${APPS_SCRIPT_URL}?action=getPaymentRecords`)
      .then(r => r.json())
      .then(r => {
        if (r.success && r.data && Object.keys(r.data).length > 0) {
          setPaymentRecords(r.data);
          localStorage.setItem("assetx_payment_records", JSON.stringify(r.data));
        }
      })
      .catch(() => {});
  }, []);

  const savePaymentRecord = React.useCallback((customerId, installment, record) => {
    setPaymentRecords(prev => {
      const updated = { ...prev, [customerId]: { ...prev[customerId], [installment]: record } };
      localStorage.setItem("assetx_payment_records", JSON.stringify(updated));
      return updated;
    });
    fetch(APPS_SCRIPT_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "savePaymentRecord", data: { customerId, installment, ...record } }),
    }).catch(() => {});
  }, []);

  const deletePaymentRecord = React.useCallback((customerId, installment) => {
    // ลบรูปจาก ImgBB ถ้ามี slipId
    setPaymentRecords(prev => {
      const record = prev[customerId]?.[installment];
      if (record?.slipId) {
        fetch(APPS_SCRIPT_URL, {
          method: "POST", mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "deleteImgbbImage", imageId: record.slipId }),
        }).catch(() => {});
      }
      const cust = { ...prev[customerId] };
      delete cust[installment];
      const updated = { ...prev, [customerId]: cust };
      localStorage.setItem("assetx_payment_records", JSON.stringify(updated));
      return updated;
    });
    fetch(APPS_SCRIPT_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "deletePaymentRecord", customerId, installment }),
    }).catch(() => {});
  }, []);

  // ── LINE User ID รายลูกค้า ──────────────────────────────────
  const [customerLineIds, setCustomerLineIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("assetx_customer_line_ids") || "{}"); }
    catch { return {}; }
  });
  const updateCustomerLineId = useCallback((customerId, lineUserId) => {
    setCustomerLineIds(prev => {
      const updated = { ...prev, [customerId]: lineUserId };
      localStorage.setItem("assetx_customer_line_ids", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // sync savedUserIds → Apps Script PropertiesService
  const syncToScript = useCallback(async (ids) => {
    setSyncStatus("syncing");
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateDestinations", destinations: ids }),
      });
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  }, []);

  // โหลด IDs จาก Apps Script ตอนเริ่ม (merge กับ localStorage)
  useEffect(() => {
    if (APPS_SCRIPT_URL.includes("YOUR_")) return;
    fetch(`${APPS_SCRIPT_URL}?action=getDestinations`)
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.destinations) && data.destinations.length > 0) {
          setSavedUserIds(prev => {
            // merge: เอา IDs จาก Script มา enrich ด้วย label จาก localStorage
            const merged = data.destinations.map(id => {
              const existing = prev.find(u => u.id === id);
              return existing || { id, label: id.substring(0, 12) + "...", savedAt: "จาก Apps Script" };
            });
            // เพิ่ม IDs ใน localStorage ที่ไม่มีใน Script
            const extra = prev.filter(u => !data.destinations.includes(u.id));
            const result = [...merged, ...extra];
            localStorage.setItem("assetx_saved_user_ids", JSON.stringify(result));
            return result;
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSetTargetUserId = useCallback((id) => {
    const trimmed = id.trim();
    setTargetUserId(trimmed);
    if (trimmed) localStorage.setItem("assetx_target_user_id", trimmed);
    else localStorage.removeItem("assetx_target_user_id");
  }, []);

  const handleSaveNewUserId = useCallback((id, label) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setSavedUserIds(prev => {
      const exists = prev.find(u => u.id === trimmed);
      let updated;
      if (exists) {
        updated = [{ ...exists, label: label || exists.label, savedAt: new Date().toLocaleString("th-TH") },
          ...prev.filter(u => u.id !== trimmed)];
      } else {
        updated = [{ id: trimmed, label: label || trimmed.substring(0, 12) + "...", savedAt: new Date().toLocaleString("th-TH") },
          ...prev];
      }
      localStorage.setItem("assetx_saved_user_ids", JSON.stringify(updated));
      syncToScript(updated); // ← sync ทันที
      return updated;
    });
    handleSetTargetUserId(trimmed);
  }, [handleSetTargetUserId, syncToScript]);

  const handleDeleteSavedUserId = useCallback((id) => {
    setSavedUserIds(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem("assetx_saved_user_ids", JSON.stringify(updated));
      syncToScript(updated); // ← sync ทันที
      return updated;
    });
    if (targetUserId === id) handleSetTargetUserId("");
  }, [targetUserId, handleSetTargetUserId, syncToScript]);
  // ───────────────────────────────────────────────────────────

  const lineHook = useLineNotification(targetUserId);
  const today = useMemo(() => new Date(), []);
  const thToday = formatThai(
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}`
  );

  // นาฬิกา real-time
  const [nowTime, setNowTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ใช้ข้อมูลจริงจาก Excel แทนการ fetch จาก Google Sheet
      setCustomers(MOCK_DATA);
      setLastFetch(new Date().toLocaleTimeString("th-TH"));
      setApiConnected(true);
      lineHook.addLog("success", "✅ โหลดข้อมูลลูกค้าสำเร็จ " + MOCK_DATA.length + " ราย");
    } catch (e) {
      setError(e.message);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }, [lineHook]);

  useEffect(() => {
    fetchData();
  }, []);

  const enriched = useMemo(
    () =>
      customers.map((c) => ({
        ...c,
        deeds: parseDeeds(c.deeds),
        payments: (c.payments || []).map((p) => {
          const diff = getDiff(p.dateStr, today);
          const record = paymentRecords[c.id]?.[p.installment];
          const status = record ? "paid" : payStatus(diff);
          return { ...p, diff, status, record: record || null };
        }),
        contractDiff: c.contractEndDate
          ? getDiff(c.contractEndDate, today)
          : null,
      })),
    [customers, today, paymentRecords]
  );

  const payAlerts = useMemo(() => {
    const r = [];
    enriched.forEach((c) =>
      c.payments.forEach((p) => {
        if (p.status === "today" || p.status === "soon") r.push({ c, p });
      })
    );
    return r.sort((a, b) => a.p.diff - b.p.diff);
  }, [enriched]);

  const contractAlerts = useMemo(
    () =>
      enriched
        .filter((c) => c.contractDiff !== null && c.contractDiff <= 180)
        .sort((a, b) => a.contractDiff - b.contractDiff),
    [enriched]
  );

  const filtered = useMemo(
    () =>
      enriched
        .map((c) => {
          if (filter === "mortgage" && c.type !== "จำนอง") return null;
          if (filter === "sell" && c.type !== "ขายฝาก") return null;
          let pays = c.payments;
          if (filter === "today")
            pays = pays.filter((p) => p.status === "today");
          else if (filter === "soon")
            pays = pays.filter(
              (p) => p.status === "today" || p.status === "soon"
            );
          if ((filter === "today" || filter === "soon") && pays.length === 0)
            return null;
          return { ...c, payments: pays };
        })
        .filter(Boolean),
    [enriched, filter]
  );

  const totalPrincipal = enriched.reduce((s, c) => s + (c.principal || 0), 0);

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setToast({ success: true, message: "📋 คัดลอกแล้ว!" });
      setTimeout(() => setToast(null), 2000);
    });
  };

  const handleLineSend = (success, name) => {
    if (success) {
      lineHook.addLog("success", `✅ ส่ง LINE ถึง ${name} สำเร็จ`);
    } else {
      lineHook.addLog("error", `❌ ส่ง LINE ถึง ${name} ล้มเหลว`);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(ellipse at 20% 0%, rgba(45,212,191,.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(124,58,237,.07) 0%, transparent 50%), ${BRAND.bg}`,
          paddingBottom: 72,
        }}
      >
        {/* Navbar */}
        <nav
          className="glass"
          style={{
            borderBottom: "1px solid rgba(45,212,191,.12)",
            padding: "0 20px",
            position: "sticky",
            top: 0,
            zIndex: 200,
          }}
        >
          <div
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 60,
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Logo size={40} />
              <div>
                <div
                  style={{
                    fontFamily: "'Kanit',sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    background: "linear-gradient(90deg,#2DD4BF,#A78BFA)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  AssetX Estate
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: BRAND.textSec,
                    letterSpacing: 0.5,
                    marginTop: -1,
                  }}
                >
                  LINE NOTIFICATION SYSTEM{" "}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

              {/* วันที่ + เวลา real-time */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "flex-end",
                padding: "4px 10px",
                background: "rgba(45,212,191,.06)",
                border: "1px solid rgba(45,212,191,.15)",
                borderRadius: 10,
                lineHeight: 1.4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.teal, letterSpacing: 0.3 }}>
                  {formatThaiLong(`${nowTime.getFullYear()}-${pad(nowTime.getMonth()+1)}-${pad(nowTime.getDate())}`)}
                </span>
                <span style={{
                  fontSize: 16, fontWeight: 700, color: BRAND.textPri,
                  fontFamily: "monospace", letterSpacing: 1,
                }}>
                  {pad(nowTime.getHours())}:{pad(nowTime.getMinutes())}:{pad(nowTime.getSeconds())}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                }}
              >
                <span
                  className={`status-dot ${
                    apiConnected ? "success" : "warning"
                  }`}
                ></span>
                <span style={{ color: apiConnected ? "#4ADE80" : "#F59E0B" }}>
                  {apiConnected ? "Online" : "Offline"}
                </span>
              </div>
              <button
                onClick={() => setCurrentView(v => v === "valuation" ? "main" : "valuation")}
                style={{
                  background: currentView === "valuation" ? "rgba(45,212,191,0.15)" : "rgba(245,158,11,0.12)",
                  border: `1px solid ${currentView === "valuation" ? BRAND.teal : BRAND.gold}`,
                  padding: "6px 14px",
                  borderRadius: 8,
                  color: currentView === "valuation" ? BRAND.teal : BRAND.gold,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🏠 ประเมิน
              </button>
              <button
                onClick={fetchData}
                className="btn"
                style={{
                  background: BRAND.border,
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                  color: BRAND.textSec,
                  fontSize: 11,
                }}
              >
                🔄
              </button>
            </div>
          </div>
        </nav>

        {/* Valuation Page */}
        {currentView === "valuation" && (
          <ValuationPage
            onBack={() => setCurrentView("main")}
            appsScriptUrl={APPS_SCRIPT_URL}
            customers={enriched}
          />
        )}

        {/* Content */}
        {currentView === "main" && <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 16px" }}>
          {/* Main Tabs */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <button
              className={`tab ${mainTab === "customers" ? "active" : ""}`}
              onClick={() => setMainTab("customers")}
            >
              👥 ลูกค้า ({enriched.length})
            </button>
            <button
              className={`tab ${mainTab === "payment" ? "active" : ""}`}
              onClick={() => setMainTab("payment")}
            >
              💳 การชำระ ({payAlerts.length > 0 ? `⚠️${payAlerts.length}` : "0"}
              )
            </button>
            <button
              className={`tab ${mainTab === "contract" ? "active" : ""}`}
              onClick={() => setMainTab("contract")}
            >
              📜 สัญญา ({contractAlerts.length})
            </button>
            <button
              className={`tab ${mainTab === "status" ? "active" : ""}`}
              onClick={() => setMainTab("status")}
            >
              ⚙️ สถานะระบบ
            </button>
            <button
              className={`tab ${mainTab === "map" ? "active" : ""}`}
              onClick={() => setMainTab("map")}
              style={mainTab === "map" ? { borderColor: '#2DD4BF', background: 'rgba(45,212,191,0.1)', color: '#2DD4BF' } : {}}
            >
              🗺️ แผนที่ทรัพย์
            </button>
          </div>

          {/* System Status Tab */}
          {mainTab === "status" && (
            <SystemStatusPage
              lineHook={lineHook}
              apiConnected={apiConnected}
              lastFetch={lastFetch}
              targetUserId={targetUserId}
              onSetTargetUserId={handleSetTargetUserId}
              savedUserIds={savedUserIds}
              onSaveNewUserId={handleSaveNewUserId}
              onDeleteSavedUserId={handleDeleteSavedUserId}
              syncStatus={syncStatus}
              triggerActive={triggerActive}
              onSetTriggerActive={setTriggerActive}
            />
          )}

          {/* Map Tab */}
          {mainTab === "map" && (
            <MapView appsScriptUrl={APPS_SCRIPT_URL} customers={enriched} />
          )}

          {/* Payment Tab */}
          {mainTab === "payment" && (
            <>
              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  className="card"
                  style={{ padding: "14px 16px", textAlign: "center" }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: BRAND.textSec,
                      marginBottom: 4,
                    }}
                  >
                    📋 ลูกค้าทั้งหมด
                  </div>
                  <div
                    style={{ fontSize: 24, fontWeight: 700, color: BRAND.teal }}
                  >
                    {enriched.length}
                  </div>
                </div>
                <div
                  className="card"
                  style={{ padding: "14px 16px", textAlign: "center" }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: BRAND.textSec,
                      marginBottom: 4,
                    }}
                  >
                    💰 เงินต้นรวม
                  </div>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: BRAND.gold }}
                  >
                    {formatMoney(totalPrincipal)} ฿
                  </div>
                </div>
                <div
                  className="card"
                  style={{
                    padding: "14px 16px",
                    textAlign: "center",
                    background:
                      payAlerts.length > 0 ? "rgba(239,68,68,.08)" : undefined,
                    borderColor: payAlerts.length > 0 ? "#EF4444" : undefined,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: BRAND.textSec,
                      marginBottom: 4,
                    }}
                  >
                    ⚠️ ต้องแจ้งเตือน
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: payAlerts.length > 0 ? "#FCA5A5" : "#4ADE80",
                    }}
                  >
                    {payAlerts.length}
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {payAlerts.length > 0 && (
                <div
                  className="card"
                  style={{
                    padding: 16,
                    marginBottom: 20,
                    borderColor: "#EF4444",
                    background: "rgba(239,68,68,.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#FCA5A5",
                        fontSize: 14,
                      }}
                    >
                      🚨 รายการต้องแจ้งเตือนด่วน
                    </div>
                    <span style={{ fontSize: 11, color: BRAND.textSec }}>
                      {thToday}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {payAlerts.slice(0, 5).map(({ c, p }, i) => {
                      const st = P_STATUS[p.status];
                      const msg =
                        p.diff <= 0
                          ? msgPayment(c, p, "due")
                          : msgPayment(c, p, "early");
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "rgba(0,0,0,.3)",
                            borderRadius: 10,
                            border: `1px solid ${st.border}40`,
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              flex: 1,
                              minWidth: 200,
                            }}
                          >
                            <span style={{ fontSize: 18 }}>
                              {c.icon || "🏠"}
                            </span>
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: BRAND.textPri,
                                  fontSize: 13,
                                }}
                              >
                                {c.name}
                              </div>
                              <div
                                style={{ fontSize: 11, color: BRAND.textSec }}
                              >
                                งวด {p.installment} • {formatThai(p.dateStr)}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: 20,
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.text,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {p.diff === 0 ? "วันนี้!" : `อีก ${p.diff} วัน`}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: BRAND.gold,
                                fontSize: 13,
                              }}
                            >
                              {formatMoney(c.amount)} ฿
                            </span>
                            <LineButton
                              message={msg}
                              type="payment"
                              label="ส่ง LINE"
                              compact
                              onSend={(ok) => handleLineSend(ok, c.name)}
                              destinationId={targetUserId}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {payAlerts.length === 0 && (
                <div
                  className="card"
                  style={{ padding: 40, textAlign: "center" }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div
                    style={{
                      color: "#4ADE80",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    ไม่มีรายการต้องแจ้งเตือน
                  </div>
                  <div style={{ color: BRAND.textSec, fontSize: 13 }}>
                    ทุกรายการยังไม่ถึงกำหนดชำระ
                  </div>
                </div>
              )}
            </>
          )}

          {/* Contract Tab */}
          {mainTab === "contract" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {contractAlerts.length === 0 ? (
                <div
                  className="card"
                  style={{ padding: 40, textAlign: "center" }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ color: "#4ADE80", fontWeight: 600 }}>
                    ไม่มีสัญญาที่ใกล้ครบกำหนดใน 6 เดือน
                  </div>
                </div>
              ) : (
                contractAlerts.map((c) => {
                  const cSt = contractStatus(c.contractDiff);
                  const st = C_STATUS[cSt];
                  const msg = msgContract(c, c.contractDiff);
                  return (
                    <div
                      key={c.id}
                      className="card"
                      style={{
                        padding: 16,
                        borderColor: st.border,
                        background: st.bg,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              background: c.color || BRAND.teal,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 20,
                            }}
                          >
                            {c.icon || "🏠"}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: BRAND.textPri,
                                fontSize: 15,
                              }}
                            >
                              {c.name}
                            </div>
                            <div style={{ fontSize: 12, color: BRAND.textSec }}>
                              {c.fullLabel}
                            </div>
                            <TypeBadge type={c.type} />
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              padding: "4px 12px",
                              borderRadius: 20,
                              background: st.bg,
                              border: `1px solid ${st.border}`,
                              color: st.text,
                              fontSize: 11,
                              fontWeight: 600,
                              marginBottom: 6,
                            }}
                          >
                            {st.label} •{" "}
                            {c.contractDiff >= 0
                              ? `อีก ${c.contractDiff} วัน`
                              : "หมดอายุแล้ว"}
                          </div>
                          <div style={{ fontSize: 12, color: BRAND.textSec }}>
                            📆 {formatThaiLong(c.contractEndDate)}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: BRAND.gold,
                              marginTop: 2,
                            }}
                          >
                            {formatMoney(c.principal)} ฿
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <LineButton
                              message={msg}
                              type="contract"
                              label="ส่ง LINE"
                              onSend={(ok) => handleLineSend(ok, c.name)}
                              destinationId={targetUserId}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Customers Tab */}
          {mainTab === "customers" && (
            <>
              {loading ? (
                <Skeleton />
              ) : error ? (
                <div
                  className="card"
                  style={{ padding: 32, textAlign: "center", color: "#FCA5A5" }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
                  <div>{error}</div>
                  <button
                    onClick={fetchData}
                    className="btn"
                    style={{
                      marginTop: 16,
                      padding: "8px 20px",
                      background: BRAND.teal,
                      border: "none",
                      borderRadius: 8,
                      color: "#000",
                      fontWeight: 600,
                    }}
                  >
                    ลองใหม่
                  </button>
                </div>
              ) : (
                <>
                  {/* Filters */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      ["all", "ทั้งหมด"],
                      ["today", "วันนี้"],
                      ["soon", "≤7 วัน"],
                      ["mortgage", "จำนอง"],
                      ["sell", "ขายฝาก"],
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        className={`tab ${filter === k ? "active" : ""}`}
                        onClick={() => setFilter(k)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* Customer List */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {filtered.map((c) => {
                      const isExp = expandedId === c.id;
                      const nextPay =
                        c.payments.find((p) => p.diff >= 0) || c.payments[0];
                      return (
                        <div
                          key={c.id}
                          className="card"
                          style={{ overflow: "hidden" }}
                        >
                          <div
                            style={{
                              padding: 16,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                            onClick={() => setExpandedId(isExp ? null : c.id)}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  background: c.color || BRAND.teal,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 20,
                                  flexShrink: 0,
                                }}
                              >
                                {c.icon || "🏠"}
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    color: BRAND.textPri,
                                    fontSize: 15,
                                  }}
                                >
                                  {c.name}
                                </div>
                                <div
                                  style={{ fontSize: 12, color: BRAND.textSec }}
                                >
                                  {c.fullLabel}
                                </div>
                                <TypeBadge type={c.type} />
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              {nextPay && (
                                <div
                                  style={{
                                    padding: "3px 10px",
                                    borderRadius: 20,
                                    background: P_STATUS[nextPay.status].bg,
                                    border: `1px solid ${
                                      P_STATUS[nextPay.status].border
                                    }`,
                                    color: P_STATUS[nextPay.status].text,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                  }}
                                >
                                  งวด {nextPay.installment} •{" "}
                                  {nextPay.diff === 0
                                    ? "วันนี้"
                                    : nextPay.diff > 0
                                    ? `อีก ${nextPay.diff} วัน`
                                    : "ชำระแล้ว"}
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: BRAND.gold,
                                }}
                              >
                                {formatMoney(c.amount)} ฿/{c.freq}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: BRAND.textMut,
                                  marginTop: 2,
                                }}
                              >
                                เงินต้น: {formatMoney(c.principal)} ฿
                              </div>
                            </div>
                          </div>

                          {isExp && (
                            <div
                              style={{
                                borderTop: `1px solid ${BRAND.border}`,
                                padding: 16,
                                background: "rgba(0,0,0,.2)",
                              }}
                            >
                              {/* ── โฉนดที่ดิน ── */}
                              {c.deeds && c.deeds.length > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                  {/* Header กดได้ */}
                                  <div
                                    onClick={() => setExpandedDeeds(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                    style={{
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "10px 14px",
                                      background: expandedDeeds[c.id] ? "rgba(45,212,191,.1)" : "rgba(45,212,191,.05)",
                                      border: "1px solid rgba(45,212,191,.2)",
                                      borderRadius: expandedDeeds[c.id] ? "10px 10px 0 0" : 10,
                                      cursor: "pointer",
                                      transition: "all .2s",
                                      userSelect: "none",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 15 }}>📜</span>
                                      <span style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>
                                        โฉนดที่ดิน
                                      </span>
                                      <span style={{
                                        background: "rgba(45,212,191,.2)", color: BRAND.teal,
                                        fontSize: 10, fontWeight: 700,
                                        padding: "2px 8px", borderRadius: 20,
                                      }}>
                                        {c.deeds.length} แปลง
                                      </span>
                                      {/* Preview โฉนดแปลงแรก เมื่อยังไม่ขยาย */}
                                      {!expandedDeeds[c.id] && (
                                        <span style={{ fontSize: 11, color: BRAND.textSec }}>
                                          น.ส.4 เลขที่ {c.deeds[0].no} · ต.{c.deeds[0].tambon} จ.{c.deeds[0].province}
                                          {c.deeds.length > 1 ? ` +${c.deeds.length - 1}` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <span style={{
                                      color: BRAND.teal, fontSize: 14, fontWeight: 700,
                                      transform: expandedDeeds[c.id] ? "rotate(180deg)" : "rotate(0deg)",
                                      transition: "transform .25s",
                                      display: "inline-block",
                                    }}>▼</span>
                                  </div>

                                  {/* เนื้อหาโฉนด แสดงเมื่อขยาย */}
                                  {expandedDeeds[c.id] && (
                                    <div style={{
                                      border: "1px solid rgba(45,212,191,.2)",
                                      borderTop: "none",
                                      borderRadius: "0 0 10px 10px",
                                      overflow: "hidden",
                                    }}>
                                      {c.deeds.map((d, idx) => (
                                        <div key={idx} style={{
                                          padding: "12px 14px",
                                          background: idx % 2 === 0 ? "rgba(45,212,191,.03)" : "rgba(0,0,0,.15)",
                                          borderTop: idx > 0 ? "1px solid rgba(45,212,191,.1)" : "none",
                                          display: "grid",
                                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                                          gap: "8px 16px",
                                        }}>
                                          {c.deeds.length > 1 && (
                                            <div style={{ gridColumn: "1 / -1", marginBottom: 4 }}>
                                              <span style={{
                                                fontSize: 10, fontWeight: 700, color: BRAND.teal,
                                                background: "rgba(45,212,191,.15)", padding: "2px 8px", borderRadius: 6,
                                              }}>
                                                แปลงที่ {idx + 1}
                                              </span>
                                            </div>
                                          )}
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>เลขโฉนด</div>
                                            <div style={{ fontWeight: 700, color: BRAND.teal, fontSize: 14 }}>น.ส.4 เลขที่ {d.no || "-"}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>เนื้อที่</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>{d.area || "-"}</div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>ที่ตั้ง</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 13 }}>
                                              ต.{d.tambon || "-"} อ.{d.amphoe || "-"}
                                              <br />
                                              <span style={{ color: BRAND.textSec, fontSize: 12 }}>จ.{d.province || "-"}</span>
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>หน้าสำรวจ / เลขที่ดิน</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 12 }}>
                                              {d.surveyPage || "-"} / {d.landNo || "-"}
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, color: BRAND.textSec, marginBottom: 2 }}>ระวาง</div>
                                            <div style={{ fontWeight: 600, color: BRAND.textPri, fontSize: 12, fontFamily: "monospace" }}>
                                              {d.mapRef || "-"}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── ข้อมูล Notice (เฉพาะขายฝาก) ── */}
                              {c.type === "ขายฝาก" && (() => {
                                const daysLeft = Math.ceil((new Date(c.contractEndDate) - new Date()) / 86400000);
                                const showNotice = daysLeft <= 180 && daysLeft >= 0;
                                const urgent = daysLeft <= 90;
                                return (
                                  <div style={{ marginBottom: 16 }}>
                                    <CustomerExtraInfoSection
                                      customer={c}
                                      extraInfoMap={customerExtraInfo}
                                      onUpdate={updateCustomerExtraInfo}
                                    />
                                    {showNotice && (
                                      <div style={{
                                        padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                                        background: urgent ? "rgba(239,68,68,.06)" : "rgba(245,158,11,.06)",
                                        border: `1px solid ${urgent ? "rgba(239,68,68,.3)" : "rgba(245,158,11,.3)"}`,
                                      }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                          <div>
                                            <div style={{ fontWeight: 700, color: urgent ? "#FCA5A5" : "#FDE68A", fontSize: 13 }}>
                                              {urgent ? "🚨" : "⚠️"} ครบกำหนดไถ่ใน {daysLeft} วัน
                                            </div>
                                            <div style={{ fontSize: 11, color: BRAND.textSec, marginTop: 2 }}>
                                              ต้องส่ง Notice ตาม พ.ร.บ. ขายฝาก มาตรา 17
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => {
                                              const extra = customerExtraInfo[c.id] || {};
                                              const docNo = getDocNumber();
                                              printNotice(c, extra, docNo);
                                            }}
                                            style={{
                                              padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                                              background: "linear-gradient(135deg,#2DD4BF,#0E7490)",
                                              border: "none", color: "#000", fontWeight: 700, fontSize: 12,
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            📄 สร้าง Notice PDF
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* ── LINE User ID รายลูกค้า ── */}
                              <CustomerLineIdSection
                                customer={c}
                                customerLineIds={customerLineIds}
                                savedUserIds={savedUserIds}
                                onUpdate={updateCustomerLineId}
                              />

                              <div
                                style={{
                                  marginBottom: 12,
                                  fontWeight: 600,
                                  color: BRAND.textPri,
                                  fontSize: 13,
                                }}
                              >
                                📅 ตารางชำระ
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                }}
                              >
                                {c.payments.map((p) => {
                                  const pSt = P_STATUS[p.status];
                                  const msg =
                                    p.status === "today"
                                      ? msgPayment(c, p, "due")
                                      : msgPayment(c, p, "early");
                                  return (
                                    <div
                                      key={p.installment}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "10px 14px",
                                        background: pSt.bg,
                                        borderRadius: 10,
                                        border: `1px solid ${pSt.border}40`,
                                        flexWrap: "wrap",
                                        gap: 8,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 10,
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            background: pSt.border + "30",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: 700,
                                            fontSize: 12,
                                            color: pSt.text,
                                          }}
                                        >
                                          {p.installment}
                                        </span>
                                        <div>
                                          <div
                                            style={{
                                              fontWeight: 600,
                                              color: BRAND.textPri,
                                              fontSize: 13,
                                            }}
                                          >
                                            งวดที่ {p.installment}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: 11,
                                              color: BRAND.textSec,
                                            }}
                                          >
                                            {formatThai(p.dateStr)}
                                          </div>
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <span
                                          style={{
                                            padding: "3px 10px",
                                            borderRadius: 20,
                                            border: `1px solid ${pSt.border}`,
                                            color: pSt.text,
                                            fontSize: 10,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {pSt.label}
                                        </span>
                                        {/* ปุ่มบันทึกสลิป */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSlipModal({ customer: c, payment: p });
                                          }}
                                          className="btn"
                                          style={{
                                            padding: "3px 8px", borderRadius: 7, fontSize: 10,
                                            border: p.status === "paid"
                                              ? "1px solid rgba(34,197,94,.4)"
                                              : "1px solid rgba(45,212,191,.3)",
                                            background: p.status === "paid"
                                              ? "rgba(34,197,94,.12)"
                                              : "rgba(45,212,191,.08)",
                                            color: p.status === "paid" ? "#86EFAC" : BRAND.teal,
                                          }}
                                        >
                                          {p.status === "paid" ? "🧾 ดูสลิป" : "💳 บันทึก"}
                                        </button>
                                        {(p.status === "today" ||
                                          p.status === "soon") && (
                                          <LineButton
                                            message={msg}
                                            type="payment"
                                            compact
                                            onSend={(ok) =>
                                              handleLineSend(ok, c.name)
                                            }
                                            destinationId={customerLineIds[c.id] || targetUserId}
                                          />
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copy(msg);
                                          }}
                                          className="btn"
                                          style={{
                                            padding: "3px 8px",
                                            borderRadius: 7,
                                            border: "1px solid rgba(245,158,11,.3)",
                                            background: "rgba(245,158,11,.08)",
                                            color: "#F59E0B",
                                            fontSize: 10,
                                          }}
                                        >
                                          📋
                                        </button>
                                        <a
                                          href={gcalPayment(c, p, false)}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            padding: "3px 8px",
                                            borderRadius: 7,
                                            border: "1px solid rgba(56,189,248,.3)",
                                            background: "rgba(56,189,248,.08)",
                                            color: "#38BDF8",
                                            fontSize: 10,
                                            textDecoration: "none",
                                          }}
                                          className="btn"
                                        >
                                          📅
                                        </a>
                                      </div>
                                      {/* แสดงข้อมูลสลิปถ้าชำระแล้ว */}
                                      {p.record && (
                                        <div style={{
                                          marginTop: 6, padding: "6px 10px",
                                          background: "rgba(34,197,94,.06)",
                                          border: "1px solid rgba(34,197,94,.2)",
                                          borderRadius: 7, fontSize: 11,
                                          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                                        }}>
                                          <span style={{ color: "#86EFAC" }}>✓ ชำระ {(p.record.amount||0).toLocaleString("th-TH")} บาท</span>
                                          <span style={{ color: BRAND.textSec }}>วันที่ {formatThai(p.record.paidDate)}</span>
                                          {p.record.note && <span style={{ color: BRAND.textSec }}>| {p.record.note}</span>}
                                          {(p.record.slipUrl || p.record.slipImage) && (
                                            <button onClick={() => {
                                              const src = p.record.slipUrl || p.record.slipImage;
                                              if (p.record.slipUrl) {
                                                window.open(src, "_blank");
                                              } else {
                                                const win = window.open('', '_blank', 'width=500,height=700');
                                                win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>สลิป</title><style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}img{max-width:100%;max-height:100vh;border-radius:8px;}</style></head><body><img src="${src}" alt="slip"/></body></html>`);
                                                win.document.close();
                                              }
                                            }}
                                              style={{ background: "none", border: "none", color: BRAND.teal, fontSize: 11, cursor: "pointer", padding: 0 }}>
                                              🖼️ ดูสลิป
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {filtered.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "50px 20px",
                        color: BRAND.textMut,
                        fontSize: 13,
                      }}
                    >
                      ไม่พบรายการที่ตรงกับเงื่อนไขที่เลือก
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.success ? "" : "error"}`}>
          {toast.success ? "✅" : "❌"} {toast.message}
        </div>
      )}

      {/* Claude AI Chat */}
      <ChatPanel customerData={customers} />

      {/* Slip Modal */}
      {slipModal && (
        <SlipModal
          customer={slipModal.customer}
          payment={slipModal.payment}
          existing={paymentRecords[slipModal.customer.id]?.[slipModal.payment.installment]}
          onSave={(record) => savePaymentRecord(slipModal.customer.id, slipModal.payment.installment, record)}
          onDelete={() => deletePaymentRecord(slipModal.customer.id, slipModal.payment.installment)}
          onClose={() => setSlipModal(null)}
        />
      )}
    </>
  );
}
