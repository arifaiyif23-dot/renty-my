## Plan: Jadikan delete listing, mesej, dan mobile UI berfungsi stabil

### 1) Fix item listed tak boleh delete
- Tambah/repair database grants untuk table penting (`items`, `item_images`, `rentals`, `payments`, `payouts`, `messages`) supaya authenticated user boleh guna operasi yang memang dibenarkan oleh RLS.
- Tukar delete flow di `MyListings` daripada hard delete terus kepada flow yang lebih production-safe:
  - Jika listing ada rental/payment history: archive/soft-hide listing supaya sejarah transaksi tidak rosak.
  - Jika listing tiada history: delete sebenar masih dibenarkan.
- Update dialog delete supaya wording jelas: “Remove from marketplace” bukan nampak macam semua history hilang.
- Pastikan bulk delete ikut flow sama dan refresh senarai selepas berjaya.

### 2) Make messages work on time and sampai
- Repair realtime subscription untuk `Messages`:
  - Gunakan channel unik per conversation, bukan channel global yang boleh clash.
  - Subscribe kepada `INSERT` dan `UPDATE` supaya status read/delivered sync.
  - Elak duplicate message bila realtime dan refetch berlaku serentak.
- Tambah optimistic message UI: mesej terus muncul dengan status “sending”, kemudian confirm selepas insert berjaya.
- Refresh conversation list bila mesej baru masuk supaya preview/unread count update tanpa reload.
- Repair message encryption trigger/function supaya message insert tidak senyap gagal dan content masih boleh dipaparkan.
- Tambah loading/empty/error state yang jelas dalam Messages.

### 3) Mobile-friendly UI pass
- `MyListings` mobile:
  - Header, tabs, filters, sort, dan action buttons dibuat responsive supaya tidak overflow pada skrin kecil.
  - Card listing lebih touch-friendly, menu delete/edit mudah ditekan.
- `Messages` mobile:
  - Layout full-height yang stabil, input bar tidak bertindih bottom nav/keyboard.
  - Conversation list dan chat thread lebih kemas, bubble width selamat, auto-scroll ke mesej terbaru.
- `ImageUpload` polish:
  - Buang emoji pada Camera/Gallery, guna ikon sebenar.
  - Kurangkan shadow/glow supaya nampak clean B2C, bukan “AI UI”.

### 4) Verification selepas implement
- Semak database selepas migration: grants, RLS policy, FK delete rules, realtime publication.
- Test manual via preview:
  - Delete/Archive listing dari `/my-listings`.
  - Hantar mesej dan pastikan ia muncul segera.
  - Semak mobile viewport untuk `/my-listings` dan `/messages`.

### Technical notes
- Database schema changes akan dibuat melalui migration sahaja.
- Tiada perubahan pada payment logic atau booking logic kecuali yang perlu untuk memastikan delete/archive tidak memecahkan history.
- UI akan ikut arah clean/mobile-first dan buang visual yang terlalu over-designed.