import { promises as fs } from 'node:fs'
import path from 'node:path'
import { verifySession } from './_auth.js'

function cleanFilename(value = '') {
  const base = String(value || 'assetx-marketing-knowledge.md')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return base.toLowerCase().endsWith('.md') ? base : `${base || 'assetx-marketing-knowledge'}.md`
}

function resolveKnowledgeDir() {
  const configured = process.env.OBSIDIAN_MARKETING_KB_DIR || process.env.ASSETX_OBSIDIAN_KB_DIR
  if (!configured) return null
  return path.resolve(configured)
}

async function uniqueTargetPath(dir, filename) {
  const parsed = path.parse(filename)
  let target = path.resolve(dir, filename)
  let count = 1
  while (true) {
    try {
      await fs.access(target)
      target = path.resolve(dir, `${parsed.name}-${count}${parsed.ext || '.md'}`)
      count += 1
    } catch {
      return target
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  if (!verifySession(req)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' })

  try {
    const dir = resolveKnowledgeDir()
    if (!dir) {
      return res.status(400).json({
        success: false,
        error: 'ยังไม่ได้ตั้งค่า OBSIDIAN_MARKETING_KB_DIR ใน .env.local',
      })
    }

    const filename = cleanFilename(req.body?.filename)
    const content = String(req.body?.content || '').trim()
    if (!content) throw new Error('ไม่มีเนื้อหา Markdown สำหรับบันทึก')
    if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) {
      throw new Error('ไฟล์ Markdown ใหญ่เกิน 2MB')
    }

    await fs.mkdir(dir, { recursive: true })
    const target = await uniqueTargetPath(dir, filename)
    const relativeCheck = path.relative(dir, target)
    if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
      throw new Error('ตำแหน่งไฟล์ไม่ปลอดภัย')
    }

    await fs.writeFile(target, `${content}\n`, 'utf8')
    return res.status(200).json({
      success: true,
      filename: path.basename(target),
      path: target,
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'บันทึกเข้า Obsidian ไม่สำเร็จ',
    })
  }
}
