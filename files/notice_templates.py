# -*- coding: utf-8 -*-
"""
Notice Document Templates for Thai Real Estate Transactions
หนังสือแจ้งเตือนสำหรับธุรกรรมอสังหาริมทรัพย์ไทย

Templates:
1. หนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก (Sale with Right of Redemption Notice)
2. หนังสือแจ้งเตือนครบกำหนดชำระหนี้จำนอง (Mortgage Payment Reminder)
3. หนังสือบอกกล่าวบังคับจำนอง (Mortgage Enforcement Notice)
"""

# Template 1: หนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก
SALEFAK_REDEMPTION_NOTICE = """
                                        หนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก

                                                        ที่ {document_number}
                                                        วันที่ {document_date}

เรื่อง   แจ้งกำหนดเวลาไถ่และจำนวนสินไถ่จากการขายฝาก

เรียน   {seller_name} (ผู้ขายฝาก)
        {seller_address}

อ้างถึง สัญญาขายฝากที่ดิน เลขที่ {contract_number} ลงวันที่ {contract_date}
        จดทะเบียน ณ {land_office}

สิ่งที่ส่งมาด้วย   สำเนาสัญญาขายฝาก จำนวน 1 ชุด

        ตามที่ท่านได้ทำสัญญาขายฝากที่ดินโฉนดเลขที่ {title_deed_number} เลขที่ดิน {land_number}
ตำบล {subdistrict} อำเภอ {district} จังหวัด {province} เนื้อที่ {land_area_text}
ไว้กับข้าพเจ้า ตามสัญญาขายฝากอ้างถึงนั้น

        บัดนี้ ใกล้จะครบกำหนดเวลาไถ่ตามสัญญาแล้ว ข้าพเจ้าจึงขอแจ้งรายละเอียด ดังนี้

        1. กำหนดวันครบกำหนดไถ่    :  {redemption_due_date}
        2. จำนวนสินไถ่                :  {total_redemption_amount:,.2f} บาท ({total_redemption_amount_text})
           ประกอบด้วย
           - เงินต้น (ราคาขายฝาก)   :  {principal_amount:,.2f} บาท
           - ผลประโยชน์ตอบแทน    :  {interest_amount:,.2f} บาท
        3. สถานที่ชำระสินไถ่         :  {payment_location}
{payee_section}
        จึงเรียนมาเพื่อทราบและดำเนินการไถ่ถอนภายในกำหนดเวลาข้างต้น

                                                ขอแสดงความนับถือ

                                        ............................................
                                        ({buyer_name})
                                                   ผู้ซื้อฝาก

หมายเหตุ: หนังสือฉบับนี้ส่งทางไปรษณีย์ลงทะเบียนตอบรับ ตามมาตรา 17 แห่ง พ.ร.บ. คุ้มครอง
ประชาชนในการทำสัญญาขายฝากที่ดินเพื่อเกษตรกรรมหรือที่อยู่อาศัย พ.ศ. 2562
"""

# Template 2: หนังสือแจ้งเตือนครบกำหนดชำระหนี้จำนอง
MORTGAGE_REMINDER_NOTICE = """
                                        หนังสือแจ้งเตือนครบกำหนดชำระหนี้

                                                        ที่ {document_number}
                                                        วันที่ {document_date}

เรื่อง   แจ้งเตือนกำหนดชำระหนี้ตามสัญญาจำนอง

เรียน   {debtor_name} (ผู้จำนอง/ลูกหนี้)
        {debtor_address}

อ้างถึง สัญญาจำนอง เลขที่ {contract_number} ลงวันที่ {contract_date}
        จดทะเบียน ณ {land_office}

        ตามที่ท่านได้ทำสัญญาจำนองที่ดินโฉนดเลขที่ {title_deed_number} เลขที่ดิน {land_number}
ตำบล {subdistrict} อำเภอ {district} จังหวัด {province} เพื่อเป็นประกันการชำระหนี้
ไว้กับข้าพเจ้า ตามสัญญาจำนองอ้างถึงนั้น

        บัดนี้ ใกล้จะครบกำหนดชำระหนี้ ข้าพเจ้าจึงขอแจ้งเตือนให้ท่านทราบล่วงหน้า ดังนี้

        1. กำหนดวันครบกำหนดชำระ  :  {payment_due_date}
        2. จำนวนเงินที่ต้องชำระ       :  {total_amount:,.2f} บาท ({total_amount_text})
           ประกอบด้วย
           - เงินต้นคงค้าง             :  {principal_amount:,.2f} บาท
           - ดอกเบี้ยค้างชำระ         :  {interest_amount:,.2f} บาท
        3. สถานที่ชำระ               :  {payment_location}
        4. ช่องทางการชำระ           :  {payment_channels}

        จึงเรียนมาเพื่อทราบและเตรียมการชำระหนี้ตามกำหนด

                                                ขอแสดงความนับถือ

                                        ............................................
                                        ({creditor_name})
                                                  ผู้รับจำนอง
"""

# Template 3: หนังสือบอกกล่าวบังคับจำนอง
MORTGAGE_ENFORCEMENT_NOTICE = """
                                        หนังสือบอกกล่าวบังคับจำนอง

                                                        ที่ {document_number}
                                                        วันที่ {document_date}

เรื่อง   ขอให้ชำระหนี้และบอกกล่าวบังคับจำนอง

เรียน   {debtor_name} (ลูกหนี้/ผู้จำนอง)
        {debtor_address}

อ้างถึง 1. สัญญากู้ยืมเงิน เลขที่ {loan_contract_number} ลงวันที่ {loan_contract_date}
        2. สัญญาจำนอง เลขที่ {mortgage_contract_number} ลงวันที่ {mortgage_contract_date}

        ตามที่ท่านได้กู้ยืมเงินจากข้าพเจ้า จำนวน {original_loan_amount:,.2f} บาท และได้จดทะเบียน
จำนองที่ดินโฉนดเลขที่ {title_deed_number} เลขที่ดิน {land_number} ตำบล {subdistrict}
อำเภอ {district} จังหวัด {province} เป็นประกันการชำระหนี้เงินกู้ดังกล่าว
ตามสัญญาอ้างถึงนั้น

        บัดนี้ ปรากฏว่าท่านได้ผิดนัดชำระหนี้ตามสัญญา โดยค้างชำระหนี้ ดังนี้

        1. เงินต้นค้างชำระ            :  {principal_outstanding:,.2f} บาท
        2. ดอกเบี้ยค้างชำระ          :  {interest_outstanding:,.2f} บาท
        3. รวมหนี้ค้างชำระทั้งสิ้น     :  {total_debt:,.2f} บาท ({total_debt_text})

        ข้าพเจ้าจึงขอบอกกล่าวให้ท่านชำระหนี้ดังกล่าวข้างต้นทั้งหมดภายใน {payment_deadline_days} วัน
({payment_deadline_days_text}) นับแต่วันที่ท่านได้รับหนังสือฉบับนี้ หากท่านเพิกเฉยไม่ชำระหนี้ภายใน
กำหนดเวลาดังกล่าว ข้าพเจ้ามีความจำเป็นต้องดำเนินการฟ้องร้องบังคับจำนอง
ต่อศาลที่มีเขตอำนาจเพื่อให้ยึดทรัพย์สินซึ่งจำนองและขายทอดตลาดนำเงินมาชำระหนี้
ต่อไป ซึ่งท่านจะต้องรับผิดชอบค่าฤชาธรรมเนียมและค่าทนายความที่เกิดขึ้นทั้งหมดด้วย

        จึงเรียนมาเพื่อทราบและดำเนินการชำระหนี้โดยด่วน

                                                ขอแสดงความนับถือ

                                        ............................................
                                        ({creditor_name})
                                                  ผู้รับจำนอง

หมายเหตุ: หนังสือฉบับนี้ถือเป็นการบอกกล่าวบังคับจำนองตามประมวลกฎหมายแพ่งและพาณิชย์ 
มาตรา 728
"""

# Thai number conversion
THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']

def number_to_thai_text(amount):
    """แปลงตัวเลขเป็นคำอ่านภาษาไทย"""
    if amount == 0:
        return 'ศูนย์บาทถ้วน'
    
    # แยกจำนวนเต็มและทศนิยม
    baht = int(amount)
    satang = int(round((amount - baht) * 100))
    
    result = ''
    
    if baht > 0:
        # แปลงจำนวนเต็ม
        baht_str = str(baht)
        length = len(baht_str)
        
        for i, digit in enumerate(baht_str):
            d = int(digit)
            pos = length - i - 1
            
            if d == 0:
                continue
            
            # กรณีพิเศษ
            if pos == 1 and d == 1:
                result += 'สิบ'
            elif pos == 1 and d == 2:
                result += 'ยี่สิบ'
            elif pos == 0 and d == 1 and length > 1:
                result += 'เอ็ด'
            else:
                result += THAI_DIGITS[d] + THAI_POSITIONS[pos % 6]
                if pos == 6:
                    result += 'ล้าน'
        
        result += 'บาท'
    
    if satang > 0:
        # แปลงสตางค์
        satang_str = str(satang).zfill(2)
        for i, digit in enumerate(satang_str):
            d = int(digit)
            if d == 0:
                continue
            pos = 1 - i
            if pos == 1 and d == 1:
                result += 'สิบ'
            elif pos == 1 and d == 2:
                result += 'ยี่สิบ'
            elif pos == 0 and d == 1 and satang >= 10:
                result += 'เอ็ด'
            else:
                result += THAI_DIGITS[d] + THAI_POSITIONS[pos]
        result += 'สตางค์'
    else:
        result += 'ถ้วน'
    
    return result

def format_land_area(rai, ngan, sqwa):
    """จัดรูปแบบเนื้อที่ดิน"""
    parts = []
    if rai > 0:
        parts.append(f'{rai} ไร่')
    if ngan > 0:
        parts.append(f'{ngan} งาน')
    if sqwa > 0:
        parts.append(f'{sqwa} ตารางวา')
    return ' '.join(parts) if parts else '-'

def format_thai_date(date_str):
    """แปลงวันที่เป็นรูปแบบไทย"""
    from datetime import datetime
    
    thai_months = [
        '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ]
    
    if isinstance(date_str, str):
        date = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        date = date_str
    
    thai_year = date.year + 543 if date.year < 2500 else date.year
    return f'{date.day} {thai_months[date.month]} พ.ศ. {thai_year}'


def generate_salefak_notice(data):
    """สร้างหนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก"""
    
    # เพิ่มข้อมูลที่คำนวณ
    data['land_area_text'] = format_land_area(
        data.get('land_area_rai', 0),
        data.get('land_area_ngan', 0),
        data.get('land_area_sqwa', 0)
    )
    data['total_redemption_amount_text'] = number_to_thai_text(data['total_redemption_amount'])
    
    # ส่วนผู้รับชำระ (ถ้าไม่ใช่ผู้ซื้อฝากเดิม)
    if data.get('payee_name'):
        data['payee_section'] = f"        4. ผู้รับชำระสินไถ่            :  {data['payee_name']}\n           (กรณีผู้ซื้อฝากไม่ใช่ผู้ซื้อฝากเดิม)"
    else:
        data['payee_section'] = ''
    
    # แปลงวันที่
    data['document_date'] = format_thai_date(data['document_date'])
    data['contract_date'] = format_thai_date(data['contract_date'])
    data['redemption_due_date'] = format_thai_date(data['redemption_due_date'])
    
    return SALEFAK_REDEMPTION_NOTICE.format(**data)


def generate_mortgage_reminder(data):
    """สร้างหนังสือแจ้งเตือนครบกำหนดชำระหนี้จำนอง"""
    
    data['total_amount_text'] = number_to_thai_text(data['total_amount'])
    
    # แปลงวันที่
    data['document_date'] = format_thai_date(data['document_date'])
    data['contract_date'] = format_thai_date(data['contract_date'])
    data['payment_due_date'] = format_thai_date(data['payment_due_date'])
    
    return MORTGAGE_REMINDER_NOTICE.format(**data)


def generate_mortgage_enforcement(data):
    """สร้างหนังสือบอกกล่าวบังคับจำนอง"""
    
    data['total_debt_text'] = number_to_thai_text(data['total_debt'])
    data['payment_deadline_days_text'] = number_to_thai_text(data['payment_deadline_days']).replace('บาทถ้วน', 'วัน')
    
    # แปลงวันที่
    data['document_date'] = format_thai_date(data['document_date'])
    data['loan_contract_date'] = format_thai_date(data['loan_contract_date'])
    data['mortgage_contract_date'] = format_thai_date(data['mortgage_contract_date'])
    
    return MORTGAGE_ENFORCEMENT_NOTICE.format(**data)


# ตัวอย่างการใช้งาน
if __name__ == '__main__':
    # ตัวอย่างข้อมูลขายฝาก
    salefak_data = {
        "document_number": "ขฝ.001/2569",
        "document_date": "2026-03-19",
        "seller_name": "นายสมชาย ใจดี",
        "seller_address": "123 หมู่ 4 ตำบลบางพลี อำเภอบางพลี จังหวัดสมุทรปราการ 10540",
        "contract_number": "ขฝ.2568/00123",
        "contract_date": "2025-03-19",
        "land_office": "สำนักงานที่ดินจังหวัดสมุทรปราการ สาขาบางพลี",
        "title_deed_number": "12345",
        "land_number": "678",
        "subdistrict": "บางพลี",
        "district": "บางพลี",
        "province": "สมุทรปราการ",
        "land_area_rai": 1,
        "land_area_ngan": 2,
        "land_area_sqwa": 50,
        "redemption_due_date": "2026-09-19",
        "principal_amount": 2000000,
        "interest_amount": 300000,
        "total_redemption_amount": 2300000,
        "payment_location": "บริษัท แอสเซท เอ็กซ์ เอสเตท จำกัด",
        "payee_name": None,
        "buyer_name": "บริษัท แอสเซท เอ็กซ์ เอสเตท จำกัด"
    }
    
    print("=" * 80)
    print("ตัวอย่างหนังสือแจ้งกำหนดเวลาไถ่จากขายฝาก")
    print("=" * 80)
    print(generate_salefak_notice(salefak_data))
