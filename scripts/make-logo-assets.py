# scripts/make-logo-assets.py — ทำไฟล์โลโก้พื้นโปร่งใสจาก public/logo-full.jpg (โลโก้ทางการบนพื้นขาว)
#
# เจ้าของ 8 พ.ย. 2569: "รูปโลโก้ อาจจะลบพื้นขาวออกให้เหลือแต่โลโก้กับตัวหนังสือ"
# ผลลัพธ์ (รันซ้ำได้ ผลเหมือนเดิม):
#   public/logo-full-transparent.png  — โลโก้แนวตั้งเดิม (X + ตัวหนังสือน้ำเงิน) พื้นโปร่งใส สำหรับพื้นสว่าง
#   public/logo-lockup-white.png      — แนวนอน: X ซ้าย + ตัวหนังสือสีขาวขวา พื้นโปร่งใส สำหรับแถบท้ายโปสเตอร์ (พื้นน้ำเงินเข้ม)
#   public/logo-lockup-navy.png       — แนวนอนเดียวกัน ตัวหนังสือสีน้ำเงินเดิม สำหรับแถบท้ายพื้นสว่าง (11 พ.ย. 2569)
# วิธีลบพื้นขาว: ระยะห่างจากสีขาว (d = 255 - ช่องสีที่เข้มสุด) ≥ SOLID = ทึบเต็ม (สีอ่อนอย่างฟ้าไซยานไม่โปร่งตาม แบบ color-to-alpha ที่ทำให้ X หม่นบนพื้นเข้ม)
# ต่ำกว่านั้น = ขอบรอยหยัก โปร่งตามสัดส่วนและถอดสีขาวที่ผสมอยู่ออก · ส่วนขาวด้านในอาคารโปร่งตามไปด้วยแบบโลโก้กลับสี
# ใช้: python scripts/make-logo-assets.py   (ต้องมี Pillow)
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'logo-full.jpg'
OUT_FULL = ROOT / 'public' / 'logo-full-transparent.png'
OUT_LOCKUP = ROOT / 'public' / 'logo-lockup-white.png'
OUT_LOCKUP_NAVY = ROOT / 'public' / 'logo-lockup-navy.png'
NOISE = 12  # d ต่ำกว่านี้ถือเป็นพื้น (สัญญาณรบกวน JPEG)
SOLID = 64  # d ตั้งแต่นี้ขึ้นไปทึบเต็ม


def white_to_alpha(img):
    rgb = img.convert('RGB')
    w, h = rgb.size
    src = rgb.load()
    out = Image.new('RGBA', (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            d = max(255 - r, 255 - g, 255 - b)
            if d < NOISE:
                dst[x, y] = (0, 0, 0, 0)
                continue
            if d >= SOLID:
                dst[x, y] = (r, g, b, 255)
                continue
            a = (d - NOISE) / (SOLID - NOISE)
            # ขอบ: สีที่เห็น = a·สีจริง + (1−a)·ขาว → สีจริง = 255 − (255 − สีที่เห็น) / a
            dst[x, y] = tuple(max(0, min(255, round(255 - (255 - c) / max(a, 0.2)))) for c in (r, g, b)) + (round(a * 255),)
    return out


def bbox_rows(img, top, bottom):
    part = img.crop((0, top, img.width, bottom))
    box = part.getchannel('A').getbbox()
    return (box[0], box[1] + top, box[2], box[3] + top)


def main():
    full = white_to_alpha(Image.open(SRC))
    alpha = full.getchannel('A')
    # แยกเครื่องหมาย X กับตัวหนังสือด้วยแถวว่างที่คั่นกลาง
    rows = [any(alpha.getpixel((x, y)) for x in range(0, full.width, 2)) for y in range(full.height)]
    filled = [y for y, r in enumerate(rows) if r]
    gaps = [(a, b) for a, b in zip(filled, filled[1:]) if b - a > 40]
    if not gaps:
        raise SystemExit('หาช่องว่างระหว่างเครื่องหมายกับตัวหนังสือไม่เจอ')
    split = (gaps[-1][0] + gaps[-1][1]) // 2
    mark_box = bbox_rows(full, 0, split)
    word_box = bbox_rows(full, split, full.height)

    # แนวตั้งเดิม ครอปชิดพร้อมขอบ 4%
    whole = full.getbbox()
    pad = round(max(whole[2] - whole[0], whole[3] - whole[1]) * 0.04)
    full.crop((whole[0] - pad, whole[1] - pad, whole[2] + pad, whole[3] + pad)).save(OUT_FULL, optimize=True)

    # แนวนอน: X สูง H · ตัวหนังสือสูง 30% ของ H · ห่าง 16% ของ H · ตัวหนังสือสีขาว
    mark = full.crop(mark_box)
    word = full.crop(word_box)
    word_white = Image.new('RGBA', word.size, (255, 255, 255, 0))
    word_white.putalpha(word.getchannel('A'))
    H = 360
    mark = mark.resize((round(mark.width * H / mark.height), H), Image.LANCZOS)
    wh = round(H * 0.30)
    word_white = word_white.resize((round(word_white.width * wh / word_white.height), wh), Image.LANCZOS)
    gap = round(H * 0.16)
    m = round(H * 0.04)
    lockup = Image.new('RGBA', (m + mark.width + gap + word_white.width + m, H + 2 * m), (0, 0, 0, 0))
    lockup.alpha_composite(mark, (m, m))
    lockup.alpha_composite(word_white, (m + mark.width + gap, m + (H - wh) // 2))
    lockup.save(OUT_LOCKUP, optimize=True)

    # แนวนอนเดียวกัน ตัวหนังสือสีน้ำเงินเดิมของโลโก้ — แถบท้ายพื้นสว่างที่กลืนกับภาพ (เจ้าของ 11 พ.ย. 2569: แถบน้ำเงินทึบดูแยกจากภาพ)
    word_navy = word.resize((round(word.width * wh / word.height), wh), Image.LANCZOS)
    navy = Image.new('RGBA', lockup.size, (0, 0, 0, 0))
    navy.alpha_composite(mark, (m, m))
    navy.alpha_composite(word_navy, (m + mark.width + gap, m + (H - wh) // 2))
    navy.save(OUT_LOCKUP_NAVY, optimize=True)
    print(f'mark {mark_box} word {word_box} -> {OUT_FULL.name} {OUT_LOCKUP.name} {OUT_LOCKUP_NAVY.name} {lockup.size}')


if __name__ == '__main__':
    main()
