## Cadangan Fix & Improve Seterusnya

Berdasarkan audit terkini (lepas fix mesej & delete item), ini keutamaan tertinggi untuk minggu ini:

### Priority 1 — Stability & Trust (kena fix dulu)
1. **Verify decryption mesej end-to-end**
   - Pastikan UI Messages guna `decrypt_message()` RPC, bukan baca `encrypted_content` mentah.
   - Tambah fallback display kalau decrypt return NULL (mesej lama pre-encryption).
2. **Cascade audit untuk delete flows**
   - Audit semua FK yang reference `items`, `rentals`, `profiles` — pastikan tiada lagi `NO ACTION` yang block.
   - Tambah confirm dialog "Delete listing" yang explain impact (rental history dikekalkan archived, bukan hilang).
3. **Payment expiry edge cases**
   - Cron untuk `cleanup_expired_payments()` — pastikan jadual jalan setiap 5 min (pg_cron).
   - Tunjuk countdown timer pada PayNowButton supaya user tahu bila bill expired.

### Priority 2 — Owner Experience
4. **Payout transparency**
   - Notifikasi bila status payout berubah (held → pending → paid).
   - Tunjuk anggaran tarikh payout (cth: "Released 3 days after rental ends").
5. **Listing health score** di Dashboard
   - Tunjuk views, conversion rate, dan cadangan (cth: "Add more photos", "Lower price by 10%").

### Priority 3 — Renter Experience
6. **Booking timeline visual** — satu progress bar (Requested → Approved → Paid → Active → Returned) di rental detail.
7. **Better empty states** untuk Wishlist, Messages, Bookings dengan CTA jelas.
8. **Search filters persistence** — simpan filter terakhir dalam localStorage.

### Priority 4 — Admin & Ops
9. **Email deliverability dashboard** — tunjuk bounce rate, complaint rate, dan listing emel yang gagal hantar (retry button).
10. **Dispute SLA tracking** — tunjuk berapa lama dispute open, highlight yang >48 jam.

### Technical Hygiene
- Buang `your-encryption-key-change-this` default dari `encrypt_sensitive_data` / `decrypt_sensitive_data` (sama macam apa yang dah dibuat untuk messages).
- Tambah retry logic untuk `notify_rental_changes` webhook kalau pg_net gagal.

---

**Pilih satu untuk aku implement:**
- **A) Priority 1 sahaja** (stability — paling kritikal untuk production)
- **B) Priority 1 + 2** (stability + owner UX)
- **C) Quick wins** — #2 (delete confirm), #6 (timeline), #7 (empty states), #8 (filter persist)
- **D) Cadang sendiri** — bagitau yang mana paling pressing

Recommend: **A** dulu, sebab apps baru recover dari 2 critical bugs — kena pastikan tiada loose ends.