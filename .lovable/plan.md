
# Troubleshoot Report — Apa Kena Fix

Saya jalankan diagnostic terus pada database. Ada **2 punca sebenar** untuk masalah yang awak report, plus beberapa isu kecil yang berkaitan.

---

## 🔴 Issue 1: Mesej Tak Boleh Hantar (CRITICAL)

**Punca:** Trigger `encrypt_message_on_insert` panggil `pgp_sym_encrypt(content, current_setting('app.settings.encryption_key'))`. Setting `app.settings.encryption_key` **tidak wujud** dalam database (`key_missing = true`), jadi `pgp_sym_encrypt(text, NULL)` throw error → setiap INSERT pada `messages` gagal.

Ini akibat sambungan dari fix lama (PGP encryption messages) yang tak pernah disiapkan dengan encryption key sebenar.

**Fix:**
- Set `app.settings.encryption_key` di level role (`ALTER ROLE authenticator SET ...` + `ALTER ROLE postgres SET ...`) supaya trigger boleh baca masa runtime.
- Patch `encrypt_message_content()` trigger: kalau key tiada, **skip encryption** (biar `encrypted_content` NULL) instead of crash. Ini safety net supaya mesej tak block kalau key hilang masa depan.

---

## 🔴 Issue 2: Item Tak Boleh Delete (CRITICAL)

**Punca:** Foreign key cascade tak lengkap.
- `items` → `rentals` = ON DELETE CASCADE ✅
- Tapi `payments.rental_id` dan `payouts.rental_id` = **NO ACTION** ❌

Bila cuba delete item yang pernah ada rental + payment, PostgreSQL block dengan "violates foreign key constraint on table payments".

**Fix:** Tukar 2 FK ini kepada `ON DELETE CASCADE`:
- `payments_rental_id_fkey`
- `payouts_rental_id_fkey`

(Lebih selamat dari segi audit trail untuk soft-delete, tapi untuk MVP cascade OK sebab payment record tetap tinggal di `payment_flow_logs` dan `email_logs` untuk reconciliation.)

**Alternative (better long-term):** Tambah `deleted_at timestamp` pada `items` dan buat soft-delete. Tapi ini bigger refactor — saya cadangkan cascade fix dulu, soft-delete kemudian kalau perlu.

---

## 🟡 Issue 3 (Bonus): Mark-as-Read Policy Rosak

Policy `Recipients can mark messages as read` ada `WITH CHECK` yang reference subquery rosak:
```
content = (SELECT messages_1.content FROM messages messages_1 WHERE messages_1.id = messages_1.id)
```
`WHERE id = id` match SEMUA row → subquery return multiple rows → UPDATE gagal. Read receipts mungkin tak berfungsi.

**Fix:** Rewrite policy supaya hanya benarkan recipient toggle `is_read` dan `read_at`, tanpa subquery pelik.

---

## 🟡 Issue 4 (Bonus): Encryption Key Tak Set = Health Dashboard Sentiasa Merah

`check_encryption_configured()` akan return `false` selagi `app.settings.encryption_key` tak set. Fix Issue 1 akan auto-resolve ini.

---

## Pelaksanaan (1 migration + 0 code change frontend)

Satu migration database je yang perlu:

```text
1. ALTER ROLE postgres       SET app.settings.encryption_key = '<32-char key>';
   ALTER ROLE authenticator  SET app.settings.encryption_key = '<32-char key>';
   ALTER ROLE service_role   SET app.settings.encryption_key = '<32-char key>';

2. CREATE OR REPLACE FUNCTION encrypt_message_content()
   → tambah guard: kalau key NULL/empty, skip encryption, return NEW.

3. ALTER TABLE payments
     DROP CONSTRAINT payments_rental_id_fkey,
     ADD  CONSTRAINT payments_rental_id_fkey
       FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE;

   (sama untuk payouts_rental_id_fkey)

4. DROP POLICY "Recipients can mark messages as read" ON messages;
   CREATE POLICY ... FOR UPDATE
     USING (auth.uid() = recipient_id)
     WITH CHECK (auth.uid() = recipient_id);
```

Encryption key akan saya generate (32-byte random string) sebagai sebahagian migration.

---

## Selepas Fix, Apa Patut Improve Next

Bukan critical, tapi worth doing:
1. **Soft-delete untuk items** — preserve audit history of rentals/payments.
2. **Retry queue untuk Resend webhook** — kalau email fail, auto-retry.
3. **Admin "Resend message" tool** kalau encryption fail di masa depan.

---

**Approve plan ni dan saya akan apply migration tersebut sahaja.** Apps lain tak terjejas — semua perubahan di database level.
