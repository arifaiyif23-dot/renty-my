import { SearchBarV2 } from "@/components/SearchBarV2"
import { AuroraBackground } from "@/components/AuroraBackground"
import { ShieldCheck, Users, MapPin, Camera, Car, Wrench, Shirt } from "lucide-react"
import { motion } from "motion/react"

interface HeroSectionProps {
  totalItemCount: number
  onSearch: () => void
  onListOrAuth: () => void
}

export function HeroSection({ totalItemCount }: HeroSectionProps) {
  return (
    <AuroraBackground variant="hero" className="min-h-0">
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pt-16 md:pt-24 pb-0">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="mb-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05] max-w-xl">
              Sewa Barang.
              <br />
              <span className="text-secondary">Jimat Duit.</span>
            </h1>

            <p className="mb-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              Ribuan barang untuk disewa. Dari kamera ke kereta.
              {totalItemCount > 0 && ` ${totalItemCount}+ barang tersedia.`}
            </p>

            <div className="max-w-xl mb-4">
              <SearchBarV2 variant="hero" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:flex items-center justify-center"
          >
            <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/5 via-secondary/5 to-background border border-border overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--secondary)/0.08),transparent_60%)]" />
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="grid grid-cols-2 gap-3 w-full">
                  {[
                    { label: "Kamera", Icon: Camera },
                    { label: "Kereta", Icon: Car },
                    { label: "Alatan", Icon: Wrench },
                    { label: "Pakaian", Icon: Shirt },
                  ].map(({ label, Icon }) => (
                    <div
                      key={label}
                      className="rounded-xl glass p-4 text-center"
                    >
                      <Icon className="h-6 w-6 mx-auto mb-1 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="border-t border-border mt-12 md:mt-16"
      >
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Owner Verified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-secondary" />
              10K+ Users
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-secondary" />
              Local Pickup
            </span>
          </div>
        </div>
      </motion.div>
    </section>
    </AuroraBackground>
  )
}