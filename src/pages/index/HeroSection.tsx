import { SearchBarV2 } from "@/components/SearchBarV2"
import { ShieldCheck, Users, MapPin } from "lucide-react"

interface HeroSectionProps {
  totalItemCount: number
  user: unknown
  onSearch: () => void
  onListOrAuth: () => void
}

export function HeroSection({ totalItemCount, user }: HeroSectionProps) {
  return (
    <section className="px-4 pt-16 md:pt-24 pb-10 md:pb-14">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-4 text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
          Sewa Barang.<br />
          <span className="text-brand-blue">Jimat Duit.</span>
        </h1>

        <p className="mb-6 text-base text-muted-foreground max-w-lg mx-auto">
          Ribuan barang untuk disewa. Dari kamera ke kereta.
          {totalItemCount > 0 && ` ${totalItemCount}+ barang tersedia.`}
        </p>

        <div className="max-w-xl mx-auto mb-6">
          <SearchBarV2 variant="hero" />
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Owner Verified
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-brand-blue" />
            10K+ Users
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-brand-blue" />
            Local Pickup
          </span>
        </div>
      </div>
    </section>
  )
}
