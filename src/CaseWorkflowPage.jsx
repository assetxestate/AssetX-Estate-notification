import React, { useEffect, useMemo, useState } from "react";
import {
  addWorkflowEvent,
  createWorkflowCase,
  getValuations,
  getWorkflowCases,
  getWorkflowEvents,
  updateWorkflowCase,
} from "./lib/api.js";
import { BRAND } from "./lib/config.js";

const PHASES = [
  {
    id: 1,
    short: "รับเรื่อง",
    title: "รับเรื่องและตรวจเอกสาร",
    items: [
      ["deed_front", "ภาพโฉนดด้านหน้าชัดเจน"],
      ["deed_back", "ภาพโฉนดด้านหลังและสารบัญจดทะเบียน"],
      ["owner_ids", "บัตรประชาชนผู้ถือกรรมสิทธิ์ครบทุกคน"],
      ["ownership_match", "ชื่อผู้ถือกรรมสิทธิ์ตรงกับเอกสารยืนยันตัวตน"],
      ["location_pin", "พิกัดทรัพย์และตำแหน่งแปลง"],
    ],
  },
  {
    id: 2,
    short: "ประเมิน",
    title: "ประเมินราคาและความเสี่ยง",
    items: [
      ["official_value", "ตรวจราคาประเมินราชการ"],
      ["market_comps", "มีราคาตลาดเปรียบเทียบอย่างน้อย 2 แหล่ง"],
      ["access_verified", "ตรวจทางเข้าและสิทธิการใช้ทาง"],
      ["site_photos", "มีภาพทรัพย์ ถนนหน้าแปลง และสภาพแวดล้อม"],
      ["ltv_review", "ตรวจ Risk Score, FSV และวงเงินแนะนำ"],
    ],
  },
  {
    id: 3,
    short: "จัดเงื่อนไข",
    title: "จัดเงื่อนไขและจับคู่นักลงทุน",
    items: [
      ["borrower_terms", "ยืนยันวงเงินและเงื่อนไขกับเจ้าของทรัพย์"],
      ["net_cash_flow", "จัดทำตารางเงินเหลือสุทธิและค่าใช้จ่าย"],
      ["investor_match", "ยืนยันนักลงทุนและแหล่งเงิน"],
      ["approval_decision", "บันทึกผลอนุมัติและเงื่อนไขก่อนจ่ายเงิน"],
    ],
  },
  {
    id: 4,
    short: "ปิดดีล",
    title: "ทำนิติกรรมและปิดดีล",
    items: [
      ["land_office_booking", "ยืนยันนัดสำนักงานที่ดิน"],
      ["funds_verified", "ตรวจยอดเงินและวิธีสั่งจ่าย"],
      ["owner_signatures", "ตรวจผู้ลงนามและเอกสารยินยอมครบ"],
      ["closing_docs", "จัดเก็บสัญญา ใบเสร็จ และเอกสารหลังจดทะเบียน"],
    ],
  },
];

const STATUS_LABELS = {
  active: "กำลังดำเนินการ",
  hold: "พัก / รอตรวจสอบ",
  completed: "ปิดงานแล้ว",
  cancelled: "ยกเลิก",
};

const PRIORITY_LABELS = {
  low: "ต่ำ",
  normal: "ปกติ",
  high: "สูง",
  urgent: "เร่งด่วน",
};

const emptyForm = {
  valuationId: "",
  caseName: "",
  contactName: "",
  transactionType: "ขายฝาก",
  ownerName: "",
  priority: "normal",
  dueDate: "",
};

function makeCaseCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `AX-${y}${m}${d}-${String(now.getTime()).slice(-5)}`;
}

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", withTime
    ? { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "2-digit" });
}

function isTableMissing(error) {
  return error?.code === "42P01" || /workflow_cases|schema cache|does not exist/i.test(error?.message || "");
}

function phaseProgress(item, phaseId) {
  const phase = PHASES.find((entry) => entry.id === phaseId);
  const checklist = item?.checklist || {};
  const done = phase.items.filter(([key]) => checklist[`p${phaseId}_${key}`]).length;
  return { done, total: phase.items.length, complete: done === phase.items.length };
}

export default function CaseWorkflowPage({ onBack }) {
  const [cases, setCases] = useState([]);
  const [valuations, setValuations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [phaseNote, setPhaseNote] = useState("");

  const selected = cases.find((item) => item.id === selectedId) || null;

  const loadCases = async () => {
    setLoading(true);
    setError("");
    try {
      const [caseRows, valuationRows] = await Promise.all([
        getWorkflowCases(),
        getValuations().catch(() => []),
      ]);
      setCases(caseRows);
      setValuations(valuationRows);
      setSelectedId((current) => current || caseRows[0]?.id || null);
      setSetupRequired(false);
    } catch (err) {
      if (isTableMissing(err)) setSetupRequired(true);
      else setError(err.message || "โหลดเคสงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCases(); }, []);

  useEffect(() => {
    if (!selectedId || setupRequired) {
      setEvents([]);
      return;
    }
    getWorkflowEvents(selectedId).then(setEvents).catch(() => setEvents([]));
  }, [selectedId, setupRequired]);

  useEffect(() => {
    if (!selected) return;
    setPhaseNote(selected.phase_notes?.[`p${selected.phase}`] || "");
  }, [selectedId, selected?.phase]);

  const filteredCases = useMemo(() => cases.filter((item) => {
    if (filter === "all") return true;
    if (filter.startsWith("phase-")) return item.phase === Number(filter.split("-")[1]);
    if (filter === "urgent") return item.priority === "urgent" && item.status !== "completed";
    return item.status === filter;
  }), [cases, filter]);

  const summary = useMemo(() => ({
    active: cases.filter((item) => item.status === "active").length,
    hold: cases.filter((item) => item.status === "hold").length,
    urgent: cases.filter((item) => item.priority === "urgent" && item.status !== "completed").length,
    completed: cases.filter((item) => item.status === "completed").length,
  }), [cases]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const replaceCase = (next) => {
    setCases((current) => current.map((item) => item.id === next.id ? next : item));
  };

  const handleValuationPick = (id) => {
    const valuation = valuations.find((row) => String(row._rowIndex) === id);
    setForm((current) => ({
      ...current,
      valuationId: id,
      caseName: valuation?.["รหัส/ชื่อทรัพย์"] || current.caseName,
      contactName: valuation?.contactName || valuation?.["ชื่อลูกค้า"] || current.contactName,
      transactionType: valuation?.["ประเภทการประเมิน"] || current.transactionType,
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.caseName.trim()) return setError("กรุณาระบุชื่อเคสหรือชื่อทรัพย์");
    setSaving(true);
    setError("");
    try {
      const created = await createWorkflowCase({ ...form, caseCode: makeCaseCode() });
      setCases((current) => [created, ...current]);
      setSelectedId(created.id);
      setForm(emptyForm);
      setShowCreate(false);
      flash("สร้างเคสงานแล้ว");
    } catch (err) {
      setError(err.message || "สร้างเคสไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const toggleChecklist = async (phaseId, key, checked) => {
    if (!selected) return;
    const checklistKey = `p${phaseId}_${key}`;
    const nextChecklist = { ...(selected.checklist || {}), [checklistKey]: checked };
    replaceCase({ ...selected, checklist: nextChecklist });
    try {
      const updated = await updateWorkflowCase(selected.id, { checklist: nextChecklist });
      replaceCase(updated);
      const createdEvent = await addWorkflowEvent({
        caseId: selected.id,
        eventType: "checklist_updated",
        fromPhase: selected.phase,
        toPhase: selected.phase,
        note: `${checked ? "ยืนยัน" : "ยกเลิกการยืนยัน"}: ${PHASES[phaseId - 1].items.find(([itemKey]) => itemKey === key)?.[1]}`,
        actor: selected.owner_name,
      });
      setEvents((current) => [createdEvent, ...current]);
    } catch (err) {
      replaceCase(selected);
      setError(err.message || "บันทึก checklist ไม่สำเร็จ");
    }
  };

  const saveField = async (field, value) => {
    if (!selected) return;
    const previous = selected;
    replaceCase({ ...selected, [field]: value });
    try {
      const updated = await updateWorkflowCase(selected.id, { [field]: value });
      replaceCase(updated);
      flash("บันทึกแล้ว");
    } catch (err) {
      replaceCase(previous);
      setError(err.message || "บันทึกไม่สำเร็จ");
    }
  };

  const changeStatus = async (status) => {
    if (!selected || status === selected.status) return;
    if (status === "completed") return setError("การปิดงานต้องใช้ปุ่มตรวจครบและปิดเคสเท่านั้น");
    const previous = selected;
    replaceCase({ ...selected, status });
    try {
      const updated = await updateWorkflowCase(selected.id, { status });
      replaceCase(updated);
      const createdEvent = await addWorkflowEvent({
        caseId: selected.id,
        eventType: "status_changed",
        fromPhase: selected.phase,
        toPhase: selected.phase,
        note: `เปลี่ยนสถานะเป็น ${STATUS_LABELS[status]}`,
        actor: selected.owner_name,
      });
      setEvents((current) => [createdEvent, ...current]);
      flash("เปลี่ยนสถานะแล้ว");
    } catch (err) {
      replaceCase(previous);
      setError(err.message || "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const phaseNotes = { ...(selected.phase_notes || {}), [`p${selected.phase}`]: phaseNote.trim() };
      const updated = await updateWorkflowCase(selected.id, { phase_notes: phaseNotes });
      replaceCase(updated);
      await addWorkflowEvent({
        caseId: selected.id,
        eventType: "note_updated",
        fromPhase: selected.phase,
        toPhase: selected.phase,
        note: `บันทึกหมายเหตุ Phase ${selected.phase}`,
        actor: selected.owner_name,
      });
      flash("บันทึกหมายเหตุแล้ว");
    } catch (err) {
      setError(err.message || "บันทึกหมายเหตุไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const movePhase = async (direction) => {
    if (!selected) return;
    const progress = phaseProgress(selected, selected.phase);
    if (direction > 0 && !progress.complete) {
      return setError(`ยังผ่านขั้นไม่ได้: ต้องยืนยัน checklist Phase ${selected.phase} ให้ครบก่อน`);
    }
    const nextPhase = selected.phase + direction;
    if (nextPhase < 1 || nextPhase > 4) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateWorkflowCase(selected.id, {
        phase: nextPhase,
        status: "active",
        next_action: `ดำเนินการ ${PHASES[nextPhase - 1].title}`,
      });
      replaceCase(updated);
      const createdEvent = await addWorkflowEvent({
        caseId: selected.id,
        eventType: direction > 0 ? "phase_advanced" : "phase_returned",
        fromPhase: selected.phase,
        toPhase: nextPhase,
        note: direction > 0 ? `ผ่านเข้าสู่ ${PHASES[nextPhase - 1].title}` : `ส่งกลับไป ${PHASES[nextPhase - 1].title}`,
        actor: selected.owner_name,
      });
      setEvents((current) => [createdEvent, ...current]);
      flash(`ย้ายไป Phase ${nextPhase} แล้ว`);
    } catch (err) {
      setError(err.message || "เปลี่ยนขั้นตอนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const completeCase = async () => {
    if (!selected) return;
    const progress = phaseProgress(selected, 4);
    if (selected.phase !== 4 || !progress.complete) return setError("ต้องอยู่ Phase 4 และยืนยัน checklist ให้ครบก่อนปิดงาน");
    setSaving(true);
    try {
      const updated = await updateWorkflowCase(selected.id, { status: "completed", next_action: "ปิดงานแล้ว" });
      replaceCase(updated);
      const createdEvent = await addWorkflowEvent({
        caseId: selected.id,
        eventType: "case_completed",
        fromPhase: 4,
        toPhase: 4,
        note: "ปิดเคสงานเรียบร้อย",
        actor: selected.owner_name,
      });
      setEvents((current) => [createdEvent, ...current]);
      flash("ปิดเคสเรียบร้อย");
    } catch (err) {
      setError(err.message || "ปิดเคสไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="cw-shell">
      <style>{caseWorkflowStyles}</style>
      <header className="cw-header">
        <div>
          <button className="cw-link" onClick={onBack}>กลับหน้าหลัก</button>
          <h1>ศูนย์จัดการเคส</h1>
          <p>ติดตามงานตั้งแต่รับเอกสารจนถึงปิดดีล พร้อมหลักฐานตรวจสอบย้อนหลัง</p>
        </div>
        <button className="cw-primary" onClick={() => setShowCreate((value) => !value)} disabled={setupRequired}>
          {showCreate ? "ปิดแบบฟอร์ม" : "+ สร้างเคส"}
        </button>
      </header>

      {notice && <div className="cw-notice">{notice}</div>}
      {error && <div className="cw-error"><span>{error}</span><button onClick={() => setError("")}>ปิด</button></div>}
      {setupRequired && (
        <div className="cw-setup">
          <strong>ต้องสร้างตาราง Case Workflow ก่อนใช้งานครั้งแรก</strong>
          <span>เปิด Supabase SQL Editor แล้วรันไฟล์ supabase_case_workflow.sql จากโปรเจกต์นี้ จากนั้นกดตรวจสอบอีกครั้ง</span>
          <button onClick={loadCases}>ตรวจสอบอีกครั้ง</button>
        </div>
      )}

      {!setupRequired && (
        <>
          <section className="cw-metrics" aria-label="สรุปเคสงาน">
            <button onClick={() => setFilter("active")}><span>กำลังดำเนินการ</span><b>{summary.active}</b></button>
            <button onClick={() => setFilter("hold")}><span>พัก / รอตรวจ</span><b>{summary.hold}</b></button>
            <button onClick={() => setFilter("urgent")}><span>เร่งด่วน</span><b>{summary.urgent}</b></button>
            <button onClick={() => setFilter("completed")}><span>ปิดงานแล้ว</span><b>{summary.completed}</b></button>
          </section>

          {showCreate && (
            <form className="cw-create" onSubmit={handleCreate}>
              <h2>สร้างเคสงานใหม่</h2>
              <label>เชื่อมจากรายการประเมิน
                <select value={form.valuationId} onChange={(e) => handleValuationPick(e.target.value)}>
                  <option value="">ไม่เชื่อม / กรอกเอง</option>
                  {valuations.map((row) => <option key={row._rowIndex} value={row._rowIndex}>{row["รหัส/ชื่อทรัพย์"] || `รายการ #${row._rowIndex}`}</option>)}
                </select>
              </label>
              <label>ชื่อเคสหรือชื่อทรัพย์<input value={form.caseName} onChange={(e) => setForm({ ...form, caseName: e.target.value })} required /></label>
              <label>ชื่อผู้ติดต่อ<input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
              <label>ประเภทธุรกรรม<select value={form.transactionType} onChange={(e) => setForm({ ...form, transactionType: e.target.value })}><option>ขายฝาก</option><option>จำนอง</option><option>ซื้อขาย</option><option>อื่น ๆ</option></select></label>
              <label>ผู้รับผิดชอบ<input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></label>
              <label>ความสำคัญ<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>กำหนดติดตาม<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
              <button className="cw-primary" disabled={saving}>{saving ? "กำลังสร้าง..." : "สร้างเคสและเริ่มตรวจเอกสาร"}</button>
            </form>
          )}

          <div className="cw-toolbar">
            <div className="cw-filters">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>ทั้งหมด {cases.length}</button>
              {PHASES.map((phase) => <button key={phase.id} className={filter === `phase-${phase.id}` ? "active" : ""} onClick={() => setFilter(`phase-${phase.id}`)}>P{phase.id} {phase.short}</button>)}
            </div>
            <button className="cw-secondary" onClick={loadCases}>รีเฟรช</button>
          </div>

          <div className="cw-workspace">
            <aside className="cw-list">
              {loading && <div className="cw-empty">กำลังโหลดเคส...</div>}
              {!loading && filteredCases.length === 0 && <div className="cw-empty">ยังไม่มีเคสในรายการนี้</div>}
              {filteredCases.map((item) => {
                const progress = phaseProgress(item, item.phase);
                return (
                  <button key={item.id} className={`cw-case-row ${selectedId === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
                    <div className="cw-case-row-top"><span>{item.case_code}</span><em data-priority={item.priority}>{PRIORITY_LABELS[item.priority]}</em></div>
                    <strong>{item.case_name}</strong>
                    <small>{item.transaction_type || "ไม่ระบุประเภท"} · {item.contact_name || "ไม่ระบุผู้ติดต่อ"}</small>
                    <div className="cw-progress"><i style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
                    <div className="cw-case-row-bottom"><span>Phase {item.phase}: {PHASES[item.phase - 1].short}</span><span>{progress.done}/{progress.total}</span></div>
                  </button>
                );
              })}
            </aside>

            <section className="cw-detail">
              {!selected && <div className="cw-empty">เลือกเคสจากรายการด้านซ้ายเพื่อเริ่มทำงาน</div>}
              {selected && (
                <>
                  <div className="cw-detail-head">
                    <div><span className="cw-code">{selected.case_code}</span><h2>{selected.case_name}</h2><p>{selected.transaction_type} · {selected.contact_name || "ยังไม่ระบุผู้ติดต่อ"}</p></div>
                    <select className="cw-status" value={selected.status} onChange={(e) => changeStatus(e.target.value)}>
                      {Object.entries(STATUS_LABELS)
                        .filter(([key]) => key !== "completed" || selected.status === "completed")
                        .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </div>

                  <div className="cw-phasebar">
                    {PHASES.map((phase) => <div key={phase.id} className={`${selected.phase === phase.id ? "current" : ""} ${selected.phase > phase.id || selected.status === "completed" ? "done" : ""}`}><b>{phase.id}</b><span>{phase.short}</span></div>)}
                  </div>

                  <div className="cw-meta" key={selected.id}>
                    <label>ผู้รับผิดชอบ<input defaultValue={selected.owner_name} onBlur={(e) => e.target.value !== selected.owner_name && saveField("owner_name", e.target.value)} /></label>
                    <label>งานถัดไป<input defaultValue={selected.next_action} onBlur={(e) => e.target.value !== selected.next_action && saveField("next_action", e.target.value)} /></label>
                    <label>กำหนดติดตาม<input type="date" defaultValue={selected.due_date || ""} onBlur={(e) => e.target.value !== (selected.due_date || "") && saveField("due_date", e.target.value || null)} /></label>
                  </div>

                  <div className="cw-phase-title"><div><span>Phase {selected.phase}</span><h3>{PHASES[selected.phase - 1].title}</h3></div><b>{phaseProgress(selected, selected.phase).done}/{phaseProgress(selected, selected.phase).total} รายการ</b></div>
                  <div className="cw-checklist">
                    {PHASES[selected.phase - 1].items.map(([key, label]) => {
                      const checked = Boolean(selected.checklist?.[`p${selected.phase}_${key}`]);
                      return <label key={key} className={checked ? "checked" : ""}><input type="checkbox" checked={checked} onChange={(e) => toggleChecklist(selected.phase, key, e.target.checked)} /><span>{label}</span><small>{checked ? "ยืนยันแล้ว" : "รอตรวจ"}</small></label>;
                    })}
                  </div>

                  <div className="cw-note"><label>หมายเหตุของขั้นตอนนี้<textarea value={phaseNote} onChange={(e) => setPhaseNote(e.target.value)} placeholder="บันทึกข้อขาดหาย ผลการตรวจ หรือเงื่อนไขที่ต้องติดตาม" /></label><button className="cw-secondary" onClick={saveNote} disabled={saving}>บันทึกหมายเหตุ</button></div>

                  <div className="cw-actions">
                    <button className="cw-secondary" onClick={() => movePhase(-1)} disabled={saving || selected.phase === 1}>ย้อนกลับ Phase</button>
                    {selected.phase < 4 && <button className="cw-primary" onClick={() => movePhase(1)} disabled={saving}>ผ่านขั้นและไป Phase {selected.phase + 1}</button>}
                    {selected.phase === 4 && selected.status !== "completed" && <button className="cw-complete" onClick={completeCase} disabled={saving}>ตรวจครบและปิดเคส</button>}
                  </div>

                  <section className="cw-audit"><h3>ประวัติการดำเนินงาน</h3>{events.length === 0 && <p>ยังไม่มีประวัติเพิ่มเติม</p>}{events.slice(0, 12).map((event) => <div key={event.id}><i /><span><b>{event.note || event.event_type}</b><small>{formatDate(event.created_at, true)} · {event.actor || "ทีม AssetX"}</small></span></div>)}</section>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

const caseWorkflowStyles = `
  .cw-shell{max-width:1280px;margin:0 auto;padding:24px 18px 64px;color:${BRAND.textPri};font-family:'Sarabun',sans-serif}.cw-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}.cw-header h1{font:800 28px 'Kanit',sans-serif;margin:8px 0 2px}.cw-header p{margin:0;color:${BRAND.textSec};font-size:13px}.cw-link{border:0;background:none;color:${BRAND.teal};padding:0;cursor:pointer}.cw-primary,.cw-secondary,.cw-complete{border:0;border-radius:7px;padding:10px 16px;font-weight:700;cursor:pointer}.cw-primary{background:${BRAND.teal};color:#062723}.cw-secondary{background:#1E293B;color:#CBD5E1;border:1px solid #334155}.cw-complete{background:#16A34A;color:#fff}.cw-primary:disabled,.cw-secondary:disabled,.cw-complete:disabled{opacity:.45;cursor:not-allowed}.cw-notice,.cw-error,.cw-setup{padding:12px 14px;border-radius:7px;margin-bottom:14px;font-size:13px}.cw-notice{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);color:#6EE7B7}.cw-error{display:flex;justify-content:space-between;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#FCA5A5}.cw-error button{border:0;background:none;color:inherit;cursor:pointer}.cw-setup{display:grid;gap:8px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);color:#FDE68A}.cw-setup button{justify-self:start;background:#F59E0B;color:#241400;border:0;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer}.cw-metrics{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;margin-bottom:16px}.cw-metrics button{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(15,23,42,.7);border:0;border-right:1px solid ${BRAND.border};color:${BRAND.textSec};cursor:pointer}.cw-metrics button:last-child{border-right:0}.cw-metrics b{font-size:22px;color:${BRAND.textPri}}.cw-create{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px;background:#0F172A;border:1px solid ${BRAND.border};border-radius:8px;margin-bottom:16px}.cw-create h2{grid-column:1/-1;margin:0;font-size:17px}.cw-create label,.cw-meta label,.cw-note label{display:grid;gap:5px;font-size:11px;color:${BRAND.textSec};font-weight:700}.cw-create input,.cw-create select,.cw-meta input,.cw-status,.cw-note textarea{width:100%;box-sizing:border-box;background:#07101F;border:1px solid #334155;border-radius:6px;padding:9px 10px;color:${BRAND.textPri};font:inherit}.cw-create .cw-primary{align-self:end}.cw-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px}.cw-filters{display:flex;gap:6px;overflow-x:auto}.cw-filters button{white-space:nowrap;border:1px solid #334155;background:#111827;color:#94A3B8;border-radius:6px;padding:8px 11px;cursor:pointer}.cw-filters button.active{border-color:${BRAND.teal};color:${BRAND.teal};background:rgba(45,212,191,.08)}.cw-workspace{display:grid;grid-template-columns:340px minmax(0,1fr);min-height:650px;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;background:#0B1220}.cw-list{border-right:1px solid ${BRAND.border};background:#09111F;overflow:auto;max-height:calc(100vh - 230px)}.cw-case-row{display:block;width:100%;text-align:left;padding:14px;border:0;border-bottom:1px solid #1E293B;background:transparent;color:${BRAND.textPri};cursor:pointer}.cw-case-row:hover,.cw-case-row.selected{background:rgba(45,212,191,.07)}.cw-case-row.selected{box-shadow:inset 3px 0 ${BRAND.teal}}.cw-case-row-top,.cw-case-row-bottom{display:flex;justify-content:space-between;gap:10px;color:#64748B;font-size:10px}.cw-case-row strong{display:block;margin:7px 0 3px;font-size:14px}.cw-case-row small{display:block;color:#94A3B8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cw-case-row em{font-style:normal;border-radius:4px;padding:2px 6px;background:#1E293B}.cw-case-row em[data-priority='urgent']{background:rgba(239,68,68,.18);color:#FCA5A5}.cw-case-row em[data-priority='high']{background:rgba(245,158,11,.16);color:#FCD34D}.cw-progress{height:3px;background:#1E293B;margin:11px 0 6px}.cw-progress i{display:block;height:100%;background:${BRAND.teal}}.cw-detail{padding:22px;min-width:0}.cw-empty{padding:38px 20px;text-align:center;color:#64748B}.cw-detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:18px;border-bottom:1px solid ${BRAND.border}}.cw-code{font-size:10px;color:${BRAND.teal};font-weight:800}.cw-detail-head h2{margin:4px 0;font:800 22px 'Kanit',sans-serif}.cw-detail-head p{margin:0;color:${BRAND.textSec};font-size:12px}.cw-status{width:auto;min-width:150px}.cw-phasebar{display:grid;grid-template-columns:repeat(4,1fr);margin:20px 0}.cw-phasebar div{position:relative;display:grid;justify-items:center;gap:5px;color:#64748B;font-size:10px}.cw-phasebar div:before{content:'';position:absolute;top:13px;right:50%;width:100%;height:2px;background:#293548;z-index:0}.cw-phasebar div:first-child:before{display:none}.cw-phasebar b{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#1E293B;border:1px solid #334155;z-index:1}.cw-phasebar .current,.cw-phasebar .done{color:${BRAND.teal}}.cw-phasebar .current b,.cw-phasebar .done b{background:${BRAND.teal};border-color:${BRAND.teal};color:#062723}.cw-phasebar .done:before,.cw-phasebar .current:before{background:${BRAND.teal}}.cw-meta{display:grid;grid-template-columns:1fr 2fr 1fr;gap:10px;margin-bottom:22px}.cw-phase-title{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:10px}.cw-phase-title span{color:${BRAND.gold};font-size:10px;font-weight:800}.cw-phase-title h3{margin:2px 0 0;font-size:17px}.cw-phase-title>b{font-size:12px;color:${BRAND.teal}}.cw-checklist{border-top:1px solid ${BRAND.border}}.cw-checklist label{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;padding:12px 8px;border-bottom:1px solid ${BRAND.border};cursor:pointer}.cw-checklist label.checked{background:rgba(16,185,129,.06)}.cw-checklist input{width:16px;height:16px;accent-color:${BRAND.teal}}.cw-checklist span{font-size:13px}.cw-checklist small{color:#64748B}.cw-checklist .checked small{color:#6EE7B7}.cw-note{display:grid;grid-template-columns:1fr auto;align-items:end;gap:10px;margin-top:18px}.cw-note textarea{min-height:76px;resize:vertical}.cw-actions{display:flex;justify-content:flex-end;gap:8px;padding:18px 0;border-bottom:1px solid ${BRAND.border}}.cw-audit{padding-top:18px}.cw-audit h3{font-size:14px;margin:0 0 12px}.cw-audit>p{color:#64748B;font-size:12px}.cw-audit>div{display:flex;gap:10px;padding:8px 0}.cw-audit i{width:7px;height:7px;border-radius:50%;background:#475569;margin-top:5px}.cw-audit span{display:grid;gap:2px}.cw-audit b{font-size:12px}.cw-audit small{font-size:10px;color:#64748B}
  @media(max-width:850px){.cw-metrics{grid-template-columns:1fr 1fr}.cw-metrics button:nth-child(2){border-right:0}.cw-metrics button:nth-child(-n+2){border-bottom:1px solid ${BRAND.border}}.cw-create{grid-template-columns:1fr 1fr}.cw-workspace{grid-template-columns:1fr}.cw-list{max-height:310px;border-right:0;border-bottom:1px solid ${BRAND.border}}.cw-meta{grid-template-columns:1fr}.cw-detail{padding:16px}}
  @media(max-width:560px){.cw-shell{padding:16px 10px 50px}.cw-header{align-items:flex-start}.cw-header h1{font-size:23px}.cw-create{grid-template-columns:1fr}.cw-toolbar{align-items:flex-start;flex-direction:column}.cw-detail-head{flex-direction:column}.cw-status{width:100%}.cw-phasebar span{font-size:9px}.cw-note{grid-template-columns:1fr}.cw-actions{flex-direction:column-reverse}.cw-actions button{width:100%}}
`;
