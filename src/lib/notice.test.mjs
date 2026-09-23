import assert from "node:assert/strict";
import {
  buildSaleRedemptionNoticeData,
  buildSaleRedemptionNoticeHtml,
  formatThaiLegalDate,
  getSaleRedemptionNoticeMissingFields,
  numberToThaiText,
} from "./notice.js";

const customer = {
  name: "ผู้ขายตัวอย่าง",
  contractEndDate: "2027-02-06",
  deeds: [{
    no: "43603",
    landNo: "835",
    surveyPage: "41013",
    tambon: "หนองแขม",
    amphoe: "หนองแขม",
    province: "กรุงเทพมหานคร",
    area: "0-0-60.2",
  }],
};

const extraInfo = {
  fullName: "นางสาวผู้ขาย ตัวอย่าง",
  sellerNationalId: "0-0000-00000-00-0",
  address: "บ้านเลขที่ 1 กรุงเทพมหานคร",
  sellerPhone: "080-000-0000",
  contractNumber: "68-0000001",
  contractDate: "2026-02-06",
  landOffice: "สำนักงานที่ดินกรุงเทพมหานคร สาขาหนองแขม",
  redemptionAmount: "6750000",
  buyerName: "นายผู้ซื้อ ตัวอย่าง",
  buyerNationalId: "0-0000-00000-00-1",
  buyerAddress: "บ้านเลขที่ 2 จังหวัดสมุทรสาคร",
  buyerPhone: "090-000-0000",
};

assert.equal(numberToThaiText(6_750_000), "หกล้านเจ็ดแสนห้าหมื่นบาทถ้วน");
assert.equal(numberToThaiText(10_000_000), "สิบล้านบาทถ้วน");
assert.equal(numberToThaiText(1_000_001), "หนึ่งล้านเอ็ดบาทถ้วน");
assert.equal(numberToThaiText(21.25), "ยี่สิบเอ็ดบาทยี่สิบห้าสตางค์");
assert.equal(formatThaiLegalDate("2026-09-15"), "15 กันยายน 2569");

assert.deepEqual(getSaleRedemptionNoticeMissingFields(customer, extraInfo), []);
assert.ok(getSaleRedemptionNoticeMissingFields(customer, {}).includes("จำนวนสินไถ่"));

const incompleteDeedCustomer = { ...customer, deeds: [{ ...customer.deeds[0], landNo: "", amphoe: "" }] };
assert.deepEqual(
  getSaleRedemptionNoticeMissingFields(incompleteDeedCustomer, { ...extraInfo, landNumber: "999", district: "เขตตัวอย่าง" }),
  [],
);

const data = buildSaleRedemptionNoticeData(customer, extraInfo, new Date(2026, 8, 15));
assert.equal(data.noticeDate, "15 กันยายน 2569");
assert.equal(data.contractTerm, "1 ปี");
assert.equal(data.contractEndDate, "6 กุมภาพันธ์ 2570");
assert.equal(data.redemptionAmountText, "หกล้านเจ็ดแสนห้าหมื่นบาทถ้วน");

const dataFromJsonDeeds = buildSaleRedemptionNoticeData(
  { ...customer, deeds: JSON.stringify(customer.deeds) },
  extraInfo,
  new Date(2026, 8, 15),
);
assert.ok(dataFromJsonDeeds.propertyDescription.includes("เลขที่ดิน 835"));

const html = buildSaleRedemptionNoticeHtml(customer, { ...extraInfo, fullName: "<script>alert(1)</script>" });
assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
assert.ok(!html.includes("<script>alert(1)</script>"));
assert.ok(html.includes("หนังสือแจ้งกำหนดเวลาไถ่และจำนวนสินไถ่จากขายฝาก"));
assert.ok(!html.includes("กรุณานำส่ง"));

console.log("notice tests passed");
