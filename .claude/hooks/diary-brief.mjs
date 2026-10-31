#!/usr/bin/env node
// SessionStart hook — บอก Claude ตอนเริ่มทุก session ว่าไดอารี่งานอยู่ไหน ต้องตรวจอะไร
// และมีเรื่องค้าง (ยังไม่ติ๊ก) อะไรในไฟล์ daily ล่าสุด · พิมพ์เป็น JSON additionalContext
// ไม่พิมพ์ข้อมูลส่วนตัวของลูกค้า: ไฟล์ daily เขียนเชิงคุณภาพอยู่แล้ว
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
let cfg = {}
try { cfg = JSON.parse(readFileSync(join(root, ".claude", "daily-log.json"), "utf8")) } catch {}
const dir = cfg.dir || "docs/daily"
const url = cfg.diary_artifact || ""

const lines = []
lines.push(`[ไดอารี่งาน AssetX] ไฟล์: ${dir}/ · หน้าเว็บส่วนตัว (Artifact): ${url || "(ยังไม่ตั้ง diary_artifact ใน .claude/daily-log.json)"}`)
lines.push("ทำเองทุกต้น session ก่อนเริ่มงานที่ผู้ใช้ขอ (ไม่ต้องถาม):")
lines.push(`1) ArtifactData list collection "commands" (url ข้างบน) → รายการ status "new": update เป็น "doing" → ทำตามข้อความ → update status "done" + result (หรือ "dropped" + result ถ้าทำไม่ได้/ไม่ควรทำ) · pin ด้วย if_version ทุกครั้ง`)
lines.push(`2) ArtifactData list collection "days" → pending[] ที่ owner="decide" มี choice แต่ acted ไม่เป็น true → ทำตามทางที่เลือก (choice="other" ดู choice_note) แล้ว update acted:true · ข้อที่ done:true จากเว็บ → ติ๊ก [x] ในไฟล์ ${dir}/<วัน>.md ให้ตรง (ติ๊ก = จบแล้ว ไม่ใช่สั่งงาน)`)
lines.push("3) รายงานผู้ใช้สั้น ๆ ว่าทำอะไรจากไดอารี่ไปบ้าง (หรือบอกว่าไม่มีคำสั่งใหม่) แล้วค่อยเริ่มงานที่ขอ")
lines.push("4) จบงานชุดใหญ่ที่ commit แล้ว → อัปเดตไฟล์ daily ของวันนี้ + เอกสาร days/<วันนี้> ด้วย skill daily-log (คง done/choice ที่เจ้าของเปลี่ยนจากเว็บ)")

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

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") },
}))
