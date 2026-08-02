import { useTranslation } from 'react-i18next'
import { GlassCard } from "@/components/ui/GlassCard"
import { StarRating } from "@/components/StarRating"
import { ScrollReveal } from "@/components/ScrollReveal"

const TESTIMONIALS = [
  {
    name: "Aina Rahman",
    location: "Kuala Lumpur",
    rating: 5,
    quote: "Rented a camera lens for the weekend. The process was so smooth — found it, paid, and picked up within an hour. Will definitely use again!",
  },
  {
    name: "Rajesh Kumar",
    location: "Petaling Jaya",
    rating: 5,
    quote: "I was hesitant to rent out my drill at first, but the verification system gave me confidence. Earned RM150 in my first month!",
  },
  {
    name: "Sarah Tan",
    location: "Penang",
    rating: 5,
    quote: "Much cheaper than buying a pressure washer for one-time use. The owner was helpful and the equipment was in great condition.",
  },
]

export function TestimonialsSection() {
  const { t } = useTranslation()
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              {t('home.testimonials.title')}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t('home.testimonials.subtitle')}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {TESTIMONIALS.map((testimonial, i) => (
            <ScrollReveal key={i} delay={i * 0.08}>
              <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden hover-glow h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-1 mb-3">
                    <StarRating rating={testimonial.rating} showValue={false} />
                  </div>
                  <blockquote className="text-sm text-foreground leading-relaxed mb-4">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
