import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { StatusStamp } from "@/components/StatusStamp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Terma & Syarat — Renty" description="Terma dan syarat penggunaan platform sewa peer-to-peer Renty di Malaysia." />
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10 pb-mobile-nav">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="font-heading">Terma & Syarat</h1>
          <StatusStamp variant="draft" label="Draft" />
        </div>

        <Alert className="mb-8 border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            <strong>Draft — pending semakan peguam.</strong> Dokumen ini adalah rangka
            kerja awal berdasarkan model marketplace facilitator generic. Bukan nasihat
            undang-undang. Section 3 (motor licensing) dan Section 9 (liability/insurans)
            khususnya masih menunggu one-off legal consultation sebelum jadi tetap.
          </AlertDescription>
        </Alert>

        <article className="prose prose-sm max-w-none space-y-6 text-foreground">
          <Section n="1" title="Definisi">
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li><b>“Renty”</b> — platform (kami), bertindak sebagai <i>facilitator</i> transaksi sewa antara Vendor dan Renter, bukan pemilik, penjual, atau insurer barang.</li>
              <li><b>“Vendor”</b> — pengguna yang listing barang untuk disewa.</li>
              <li><b>“Renter”</b> — pengguna yang membuat booking untuk menyewa barang.</li>
              <li><b>“Barang”</b> — item yang di-listing (motorsikal, kamera, gadget, pakaian event, DIY tools).</li>
              <li><b>“Booking”</b> — transaksi sewa yang confirmed antara Vendor dan Renter melalui platform.</li>
            </ul>
          </Section>

          <Section n="2" title="Peranan Renty">
            <p className="text-sm">
              Renty <b>bukan</b> pemilik, penjual, insurer, atau pihak dalam kontrak sewa
              antara Vendor dan Renter. Kontrak sewa sebenar adalah antara Vendor dan
              Renter. Renty menyediakan platform untuk discovery, booking, verification
              identiti (e-KYC), RentyScore, dan dispute process.
            </p>
          </Section>

          <Section n="3" title="Kelayakan Pengguna">
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Semua pengguna mesti lengkapkan e-KYC sebelum booking/listing pertama.</li>
              <li>[Pending legal confirm] Untuk sewa motorsikal — Renter mesti upload lesen memandu (kelas B2/D) yang sah.</li>
              <li>Pengguna mesti berumur 18 tahun ke atas.</li>
            </ul>
          </Section>

          <Section n="4" title="Listing & Booking">
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Vendor bertanggungjawab memastikan maklumat Barang (kondisi, spec, gambar) adalah tepat.</li>
              <li>Booking disahkan tertakluk kepada date-conflict check automatik dalam sistem.</li>
              <li>Vendor berhak approve/reject permintaan booking dalam tempoh yang ditetapkan.</li>
            </ul>
          </Section>

          <Section n="5" title="Pembayaran & Komisen">
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li><b>Escrow (default):</b> pembayaran diproses melalui ToyyibPay dan dipegang sehingga rental disahkan complete.</li>
              <li><b>Manual (opsyenal):</b> bank transfer/DuitNow QR terus antara Renter dan Vendor. Renty tidak memegang duit dalam mod ini.</li>
              <li>Komisen 10% flat dikenakan kepada Vendor bagi setiap booking completed.</li>
              <li>Zero commission untuk 20-30 Vendor pertama (Founding Vendor programme).</li>
            </ul>
          </Section>

          <Section n="6" title="Deposit">
            <p className="text-sm">
              Deposit keselamatan (jumlah ikut kategori) dibayar terus oleh Renter
              kepada Vendor semasa/sebelum handover. Vendor bertanggungjawab memulangkan
              deposit selepas Barang dipulangkan dalam kondisi baik. Renty tidak
              memegang deposit dan bukan pihak dalam pertikaian deposit — Renty
              menyediakan bukti (gambar handover) untuk membantu resolusi.
            </p>
          </Section>

          <Section n="7" title="Handover & Verifikasi Kondisi">
            <p className="text-sm">
              Vendor dan Renter <b>wajib</b> upload gambar kondisi Barang semasa
              handover dan pemulangan melalui platform. Gambar ini menjadi bukti utama
              sekiranya berlaku pertikaian.
            </p>
          </Section>

          <Section n="8" title="Pembatalan & No-Show">
            <p className="text-sm">
              Pembatalan tertakluk kepada dasar yang dinyatakan semasa booking. Kes
              no-show diselesaikan secara manual oleh admin Renty.
            </p>
          </Section>

          <Section n="9" title="Liabiliti & Insurans">
            <Alert className="border-warning bg-warning/5">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                Section ini paling memerlukan semakan peguam.
              </AlertDescription>
            </Alert>
            <p className="text-sm mt-3">
              Renty tidak menyediakan insurans atau perlindungan kerosakan/kehilangan
              Barang dalam Phase 1. Liabiliti terletak sepenuhnya pada Vendor dan
              Renter. Vendor dinasihatkan mengesahkan sama ada polisi insurans peribadi
              melindungi penggunaan Barang untuk tujuan sewaan komersial.
            </p>
          </Section>

          <Section n="10" title="Penyelesaian Pertikaian">
            <p className="text-sm">
              Pertikaian dilaporkan melalui dashboard dispute, disemak dalam tempoh 24
              jam. Keputusan Renty adalah muktamad untuk tujuan platform (tidak
              menghalang hak undang-undang pihak berkenaan).
            </p>
          </Section>

          <Section n="11" title="PDPA / Privasi Data">
            <p className="text-sm">
              Lihat <Link to="/privacy" className="text-primary underline">Dasar Privasi</Link>{" "}
              untuk butiran penuh pengumpulan, penyimpanan, dan hak akses data.
            </p>
          </Section>

          <Section n="12" title="Kelakuan Dilarang">
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Listing Barang palsu/tidak wujud.</li>
              <li>Booking tanpa niat sebenar untuk menyewa.</li>
              <li>Penyalahgunaan sistem review/rating.</li>
              <li>Sebarang aktiviti menyalahi undang-undang menggunakan Barang yang disewa.</li>
              <li>Mengiklankan perkhidmatan (bukan sewaan) di platform.</li>
            </ul>
          </Section>

          <Section n="13" title="Penggantungan & Penamatan Akaun">
            <p className="text-sm">
              Renty berhak menggantung/menamatkan akaun pengguna yang melanggar terma
              ini, termasuk fraud, penyalahgunaan sistem, atau pelanggaran berulang.
            </p>
          </Section>

          <Section n="14" title="Undang-undang Terpakai">
            <p className="text-sm">
              Terma ini tertakluk kepada undang-undang Malaysia.
            </p>
          </Section>

          <Section n="15" title="Hubungi Kami">
            <p className="text-sm">
              Email: <a href="mailto:support@renty.my" className="text-primary underline">support@renty.my</a>
            </p>
          </Section>
        </article>

        <p className="text-xs text-muted-foreground mt-10 font-mono">
          Renty T&C — versi draft 2026-07 · terakhir dikemas kini {new Date().toLocaleDateString("ms-MY")}
        </p>
      </main>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-heading font-semibold">
        <span className="font-mono text-primary mr-2">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
