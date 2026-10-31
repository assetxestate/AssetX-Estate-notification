#!/usr/bin/env node
// SessionStart hook — บอก Claude ตอนเริ่มทุก session ว่าไดอารี่งานอยู่ไหน ต้องตรวจอะไร
// แล้วเรียก scripts/diary-sync.mjs brief อ่านคำสั่งใหม่ / ทางที่เจ้าของเลือก / ติ๊กใหม่ จากฐานข้อมูลจริงของแอป
// ถ้าอ่านฐานข้อมูลไม่ได้ (ไม่มี .env.local, ตารางยังไม่สร้าง) ถอยไปลิสต์ข้อค้างจากไฟล์ daily แทน
// ไม่พิมพ์ข้อมูลส่วนตัวของลูกค้า: ไดอารี่เขียนเชิงคุณภาพอยู่แล้ว
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { execFileSync } from "node:child_process"

const root = process.cwd()
let cfg = {}
try { cfg = JSON.parse(readFileSync(join(root, ".claude", "daily-log.json"), "utf8")) } catch {}
const dir = cfg.dir || "docs/daily"
const url = cfg.diary_url || "(ยังไม่ตั้ง diary_url ใน .claude/daily-log.json)"
const sync = cfg.diary_sync || "scripts/diary-sync.mjs"

const lines = []
lines.push(`[ไดอารี่งาน AssetX] ไฟล์: ${dir}/ · หน้าเว็บในแอป (หลังล็อกอิน AssetX ไม่ต้องมีบัญชี claude.ai): ${url} · สคริปต์: node ${sync} <คำสั่ง>`)
lines.push("ทำเองทุกต้น session ก่อนเริ่มงานที่ผู้ใช้ขอ (ไม่ต้องถาม):")
lines.push(`1) คำสั่งที่ยังไม่ปิดด้านล่าง → node ${sync} command <id> doing → ทำตามข้อความ → command <id> done "ผล" (ทำไม่ได้/ไม่ควรทำ/ขัดกติกา CLAUDE.md → dropped "เหตุผล")`)
lines.push(`2) ทางที่เจ้าของเลือกแล้ว → ทำตาม (choice=other ดู choice_note) → node ${sync} acted <วัน> <pid>`)
lines.push(`3) ติ๊กจบจากเว็บ → node ${sync} pull-days แล้วติ๊ก [x] ใน ${dir}/<วัน>.md ให้ตรง (ติ๊ก = จบแล้ว ไม่ใช่สั่งงาน)`)
lines.push("4) รายงานผู้ใช้สั้น ๆ ว่าทำอะไรจากไดอารี่ไปบ้าง (หรือบอกว่าไม่มีคำสั่งใหม่) แล้วค่อยเริ่มงานที่ขอ")
lines.push(`5) จบงานชุดใหญ่ที่ commit แล้ว → อัปเดต daily ของวันนี้ + JSON ใน .claude/diary/days แล้ว node ${sync} push-day <ไฟล์> (สคริปต์คง done/choice ของเจ้าของให้เอง)`)

let dbOk = false
try {
  const out = execFileSync(process.execPath, [join(root, sync), "brief"], {
    cwd: root, timeout: 15000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim()
  if (out) {
    lines.push(out)
    dbOk = !/อ่านฐานข้อมูลไม่ได้|ยังไม่ถูกสร้าง|ไม่สำเร็จ/.test(out.split("\n")[0])
  }
} catch (e) {
  lines.push(`อ่านฐานข้อมูลไดอารี่ไม่สำเร็จ: ${String(e.stderr || e.message || "").trim().split("\n")[0]}`)
}

if (!dbOk) {
  try {
    const files = readdirSync(join(root, dir)).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort()
    const open = []
    for (const f of files.slice(-7)) {
      const md = readFileSync(join(root, dir, f), "utf8")
      const sec = md.split(/^## /m).find(s => s.startsWith("ค้าง"))
      if (!sec) continue
      for (const m of sec.matchAll(/^- \[ \] (.+)$/gm)) open.push(`${f.slice(0, 10)}: ${m[1].trim()}`)
    }
    lines.push(open.length ? `ค้างในไฟล์ (ยังไม่ติ๊ก, 7 วันล่าสุด):\n- ${open.join("\n- ")}` : "ค้างในไฟล์: ไม่มี")
  } catch {
    lines.push(`ค้างในไฟล์: ยังไม่มีโฟลเดอร์ ${dir}`)
  }
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") },
}))
