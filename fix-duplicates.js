// ============================================================
// AssetX — Fix Duplicate Customers
// วิธีใช้: node fix-duplicates.js
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import readline from "readline";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => l.split("=").map(s => s.trim()))
    .map(([k, ...v]) => [k, v.join("=")])
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
  console.log("\n🔍 กำลังดึงข้อมูลลูกค้าทั้งหมด...\n");

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, principal, type, created_at, updated_at")
    .order("name")
    .order("created_at");

  if (error) { console.error("❌ Error:", error.message); process.exit(1); }

  // จับกลุ่มตาม name + principal (ลูกค้าคนเดียวกัน)
  const groups = {};
  for (const c of customers) {
    const key = `${c.name}__${c.principal}__${c.type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const dupeGroups = Object.values(groups).filter(g => g.length > 1);

  if (dupeGroups.length === 0) {
    console.log("✅ ไม่พบข้อมูลซ้ำในระบบ");
    rl.close();
    return;
  }

  console.log(`⚠️  พบกลุ่มซ้ำ ${dupeGroups.length} กลุ่ม:\n`);

  const toDelete = [];

  for (const group of dupeGroups) {
    console.log("─".repeat(60));
    console.log(`👤 ${group[0].name}  |  วงเงิน: ${Number(group[0].principal).toLocaleString('th-TH')} บาท  |  ประเภท: ${group[0].type}`);
    console.log();

    group.forEach((c, i) => {
      const date = new Date(c.created_at).toLocaleString('th-TH');
      console.log(`  [${i + 1}] ID: ${c.id}  |  สร้างเมื่อ: ${date}`);
    });

    console.log();
    console.log("  เลือกรายการที่ต้องการ ** เก็บไว้ ** (กรอกหมายเลข เช่น 1)");
    const ans = await ask("  เลือก (หรือ s เพื่อข้ามกลุ่มนี้): ");

    if (ans.toLowerCase() === 's') {
      console.log("  ⏭️  ข้าม\n");
      continue;
    }

    const keepIdx = parseInt(ans) - 1;
    if (isNaN(keepIdx) || keepIdx < 0 || keepIdx >= group.length) {
      console.log("  ❌ ตัวเลขไม่ถูกต้อง ข้ามกลุ่มนี้\n");
      continue;
    }

    const keepId = group[keepIdx].id;
    const deleteIds = group.filter((_, i) => i !== keepIdx).map(c => c.id);
    console.log(`  ✅ เก็บ: ${keepId}`);
    console.log(`  🗑️  ลบ: ${deleteIds.join(", ")}\n`);
    toDelete.push(...deleteIds);
  }

  if (toDelete.length === 0) {
    console.log("\n✅ ไม่มีรายการที่ต้องลบ");
    rl.close();
    return;
  }

  console.log("─".repeat(60));
  console.log(`\n⚠️  จะลบ ${toDelete.length} รายการ:`);
  toDelete.forEach(id => console.log(`   - ${id}`));

  const confirm = await ask("\nยืนยันลบ? (พิมพ์ YES เพื่อยืนยัน): ");
  if (confirm !== "YES") {
    console.log("❌ ยกเลิก ไม่มีการลบ");
    rl.close();
    return;
  }

  console.log("\n🗑️  กำลังลบ...");
  for (const id of toDelete) {
    // ลบ payments และ payment_records ก่อน (ON DELETE CASCADE จัดการได้ แต่ explicit ดีกว่า)
    const { error: delErr } = await supabase.from("customers").delete().eq("id", id);
    if (delErr) {
      console.log(`  ❌ ลบ ${id} ไม่สำเร็จ: ${delErr.message}`);
    } else {
      console.log(`  ✅ ลบ ${id} สำเร็จ`);
    }
  }

  console.log("\n🎉 เสร็จเรียบร้อย!");
  rl.close();
}

main().catch(e => { console.error(e); rl.close(); });
