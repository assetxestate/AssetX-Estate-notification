# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

ระบบเว็บประเมินอสังหาริมทรัพย์และบันทึกข้อมูลลูกค้าจำนองและขายฝาก พร้อมระบบแจ้งเตือนการชำระดอกเบี้ย

ฟีเจอร์หลัก:
- ประเมินมูลค่าอสังหาริมทรัพย์
- บันทึกข้อมูลลูกค้าจำนองและขายฝาก
- แจ้งเตือนกำหนดชำระดอกเบี้ย

## Tech Stack

- Language: JavaScript
- Build Tool: Vite
- Frontend: HTML, CSS, JavaScript (src/)
- Entry Point: index.html

## Common Commands

npm install       # ติดตั้ง dependencies ครั้งแรก
npm run dev       # รัน development server
npm run build     # build สำหรับ production
npm run preview   # preview หลัง build

## Project Structure

AssetX-Estate-notification/
├── index.html        # หน้าหลักของเว็บ
├── package.json      # dependencies และ scripts
├── vite.config.js    # การตั้งค่า Vite
├── CLAUDE.md         # คู่มือสำหรับ Claude Code
└── src/              # โค้ดหลักทั้งหมด

## Domain Terminology

- จำนอง — สัญญาที่ลูกค้านำอสังหาฯ เป็นหลักประกันเงินกู้ ยังครอบครองทรัพย์สินได้
- ขายฝาก — สัญญาโอนกรรมสิทธิ์พร้อมสิทธิ์ไถ่คืนภายในกำหนด
- ดอกเบี้ย — ค่าตอบแทนที่ลูกค้าต้องชำระตามรอบที่กำหนด
- วันครบกำหนด — วันที่ต้องชำระดอกเบี้ยหรือไถ่คืนทรัพย์สิน
- มูลค่าประเมิน — ราคาอสังหาฯ ที่ประเมินได้จากระบบ

## Key Business Rules

- ลูกค้า 1 คนอาจมีสัญญาจำนอง/ขายฝากได้หลายรายการ
- การแจ้งเตือนควรส่งล่วงหน้าก่อนวันครบกำหนดอย่างน้อย 7 วัน
- บันทึกประวัติการชำระเงินทุกครั้งเสมอ — ห้ามลบข้อมูลเก่า
- มูลค่าประเมินอสังหาฯ ต้องบันทึกวันที่ประเมินทุกครั้ง

## Coding Conventions

- ใช้ภาษาไทยสำหรับ comments และ variable names ที่เกี่ยวกับ domain
- ใช้ภาษาอังกฤษสำหรับ function names และ technical code
- ใช้ const และ let แทน var เสมอ
- ใช้ async/await แทน .then() สำหรับ async operations

## Important Notes

- ห้ามลบข้อมูลลูกค้าออกจากฐานข้อมูลโดยตรง — ใช้ soft delete แทน
- ข้อมูลส่วนตัวลูกค้า (เลขบัตรประชาชน, เบอร์โทร) ต้องไม่แสดงใน logs
- ทุกครั้งที่แก้ไข logic การคำนวณดอกเบี้ย ต้องทดสอบก่อน commit เสมอ