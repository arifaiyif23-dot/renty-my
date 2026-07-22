import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Search, Mail, ExternalLink, HelpCircle } from "lucide-react";
import Header from "@/components/Header";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: "How do I rent an item?",
    a: "Browse listings, select an item, choose your rental dates, and send a booking request. The owner will review and approve your request. Once approved, you can proceed with payment.",
  },
  {
    q: "How do I list an item for rent?",
    a: "Go to your Profile and click 'List an Item'. Fill in the details including photos, description, pricing, and availability. Submit for review and once approved, your item will be visible in search results.",
  },
  {
    q: "How does payment work?",
    a: "Rentals are paid through our secure payment gateway (ToyyibPay). Payment is collected upfront before the rental period begins. Owners receive payouts after the rental is completed and confirmed.",
  },
  {
    q: "What is the verification process?",
    a: "We verify your identity through document upload (MyKad/Passport) combined with a selfie or video liveness check. Higher verification levels unlock premium features and build trust with the community.",
  },
  {
    q: "How do I cancel a booking?",
    a: "Go to your Dashboard, find the rental, and use the cancel option. Cancellation policies vary — please check the specific listing's terms. Contact support if you have issues.",
  },
  {
    q: "What if an item is damaged?",
    a: "Inspect the item at handover and report any issues immediately. Our dispute resolution team can help if there's a disagreement. Always take photos during handover and return.",
  },
  {
    q: "How do I contact support?",
    a: "You can reach us via the contact form below or email support@renty.my. We aim to respond within 24 hours during business days.",
  },
  {
    q: "Is my personal information safe?",
    a: "Yes. We use industry-standard encryption, secure authentication, and never share your data with third parties. See our Privacy Policy for details.",
  },
  {
    q: "How do I become a vendor?",
    a: "Complete the vendor onboarding process from your profile. You'll need to provide business details and verify your identity. Approved vendors can list multiple items and access analytics.",
  },
  {
    q: "What are the platform fees?",
    a: "A small platform fee is deducted from each rental to cover payment processing, insurance, and platform operations. The exact percentage is shown before you confirm a booking.",
  },
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = FAQS.filter(
    (faq) =>
      faq.q.toLowerCase().includes(search.toLowerCase()) ||
      faq.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-3xl pb-mobile-nav">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Help Center</h1>
            <p className="text-sm text-muted-foreground">Find answers to common questions</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        <div className="space-y-2 mb-8">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No results found</p>
          ) : (
            filtered.map((faq, i) => (
              <GlassCard
                key={i}
                variant="subtle"
                padding="md"
                className="cursor-pointer hover:border-primary/50 transition-colors select-none"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-sm">{faq.q}</h3>
                  {openIndex === i ? (
                    <ChevronDown className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
                  )}
                </div>
                {openIndex === i && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{faq.a}</p>
                )}
              </GlassCard>
            ))
          )}
        </div>

        <GlassCard padding="lg">
          <h2 className="font-semibold text-lg mb-4">Still Need Help?</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Email Us</p>
                <a href="mailto:support@renty.my" className="text-sm text-primary hover:underline">
                  support@renty.my
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ExternalLink className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm">
                <Button variant="link" className="p-0 h-auto text-sm" asChild>
                  <Link to="/terms">Terms of Service</Link>
                </Button>
                <span className="text-muted-foreground mx-2">|</span>
                <Button variant="link" className="p-0 h-auto text-sm" asChild>
                  <Link to="/privacy">Privacy Policy</Link>
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
