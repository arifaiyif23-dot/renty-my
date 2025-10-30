import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

interface FooterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'about' | 'help' | 'contact' | 'terms' | 'privacy' | 'safety';
}

export function FooterDialog({ open, onOpenChange, type }: FooterDialogProps) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Message sent! We\'ll get back to you soon.');
    setContactForm({ name: '', email: '', message: '' });
    onOpenChange(false);
  };

  const renderContent = () => {
    switch (type) {
      case 'about':
        return (
          <>
            <DialogHeader>
              <DialogTitle>About RENTY</DialogTitle>
              <DialogDescription>Malaysia's premier rental marketplace</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold mb-2">Our Mission</h3>
                <p className="text-sm text-muted-foreground">
                  RENTY is on a mission to make sharing the new owning. We believe in a sustainable future where
                  communities share resources instead of buying items they'll rarely use. By connecting people who
                  own with people who need, we're building a more sustainable and connected Malaysia.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Our Vision</h3>
                <p className="text-sm text-muted-foreground">
                  To become Southeast Asia's most trusted peer-to-peer rental platform, enabling millions to access
                  what they need while reducing waste and building stronger communities.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Our Values</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Trust and Safety First</li>
                  <li>Sustainability and Environmental Responsibility</li>
                  <li>Community Building</li>
                  <li>Innovation and Excellence</li>
                  <li>Fair and Transparent Practices</li>
                </ul>
              </div>
            </div>
          </>
        );

      case 'help':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Help Center</DialogTitle>
              <DialogDescription>Find answers to common questions</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I list an item?</AccordionTrigger>
                  <AccordionContent>
                    Click on "List Item" in the navigation menu. Fill in the item details, upload photos, set your
                    price, and publish your listing. Make sure your profile is verified before listing items.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>How does payment work?</AccordionTrigger>
                  <AccordionContent>
                    We use secure payment processing through ToyyibPay. Payment is held securely until the rental
                    is completed. Owners receive their payment after the renter confirms they've returned the item.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>What if an item gets damaged?</AccordionTrigger>
                  <AccordionContent>
                    All rentals include basic protection coverage. If an item is damaged, report it immediately
                    through the app. Our team will review the case and determine the resolution based on our
                    terms of service.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I get verified?</AccordionTrigger>
                  <AccordionContent>
                    Go to your Profile page and click "Get Verified". You'll need to submit a government-issued ID
                    and take a selfie. Verification typically takes 24-48 hours.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                  <AccordionTrigger>Can I cancel a booking?</AccordionTrigger>
                  <AccordionContent>
                    Yes, but cancellation policies vary by listing. Check the cancellation policy before booking.
                    Generally, you can get a full refund if you cancel at least 48 hours before the rental start date.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </>
        );

      case 'contact':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Contact Us</DialogTitle>
              <DialogDescription>We're here to help</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">support@renty.my</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">+60 3-1234 5678</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">
                      Suite 123, Menara Tech<br />
                      Jalan Technology, Cyberjaya<br />
                      63000 Selangor, Malaysia
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Support Hours</p>
                    <p className="text-sm text-muted-foreground">
                      Monday - Friday: 9 AM - 6 PM<br />
                      Saturday: 10 AM - 4 PM<br />
                      Sunday: Closed
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Send us a message</h3>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Send Message</Button>
              </form>
            </div>
          </>
        );

      case 'terms':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Terms of Service</DialogTitle>
              <DialogDescription>Last updated: December 2024</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <section>
                <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
                <p className="text-sm text-muted-foreground">
                  By accessing and using RENTY, you accept and agree to be bound by these Terms of Service.
                  If you do not agree to these terms, please do not use our service.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">2. User Responsibilities</h3>
                <p className="text-sm text-muted-foreground">
                  Users must be at least 18 years old to use RENTY. You are responsible for maintaining the
                  security of your account and for all activities under your account.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">3. Listing and Renting Items</h3>
                <p className="text-sm text-muted-foreground">
                  Owners must ensure their listings are accurate and items are in the described condition.
                  Renters must treat items with care and return them on time and in the same condition.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">4. Payment and Fees</h3>
                <p className="text-sm text-muted-foreground">
                  RENTY charges a service fee on each transaction. Owners receive payment after successful
                  rental completion. All payments are processed securely through our payment partner.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">5. Prohibited Activities</h3>
                <p className="text-sm text-muted-foreground">
                  Users may not list illegal items, engage in fraudulent activities, or violate any local laws.
                  RENTY reserves the right to suspend or terminate accounts that violate these terms.
                </p>
              </section>
            </div>
          </>
        );

      case 'privacy':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Privacy Policy</DialogTitle>
              <DialogDescription>How we protect your data</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <section>
                <h3 className="font-semibold mb-2">Data Collection</h3>
                <p className="text-sm text-muted-foreground">
                  We collect information you provide when creating an account, listing items, or communicating
                  through our platform. This includes your name, email, phone number, and payment information.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Data Usage</h3>
                <p className="text-sm text-muted-foreground">
                  Your data is used to facilitate rentals, process payments, verify identities, and improve
                  our services. We never sell your personal information to third parties.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Data Security</h3>
                <p className="text-sm text-muted-foreground">
                  We implement industry-standard security measures to protect your data. All sensitive information
                  is encrypted in transit and at rest.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Your Rights</h3>
                <p className="text-sm text-muted-foreground">
                  You have the right to access, correct, or delete your personal data. Contact us to exercise
                  these rights or if you have any privacy concerns.
                </p>
              </section>
            </div>
          </>
        );

      case 'safety':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Trust & Safety</DialogTitle>
              <DialogDescription>Stay safe on RENTY</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <section>
                <h3 className="font-semibold mb-2">Verification System</h3>
                <p className="text-sm text-muted-foreground">
                  All users can get verified by submitting government-issued ID. Look for the verified badge
                  when choosing who to rent from or to.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Secure Payments</h3>
                <p className="text-sm text-muted-foreground">
                  Never pay outside the platform. All payments are processed securely and held until rental
                  completion. This protects both owners and renters.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Meeting Safety</h3>
                <p className="text-sm text-muted-foreground">
                  When meeting for item exchange, choose public locations during daylight hours. Bring a friend
                  if possible and trust your instincts.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Reporting Issues</h3>
                <p className="text-sm text-muted-foreground">
                  Report any suspicious activity, inappropriate behavior, or safety concerns immediately.
                  We take all reports seriously and investigate promptly.
                </p>
              </section>
              <section>
                <h3 className="font-semibold mb-2">Item Protection</h3>
                <p className="text-sm text-muted-foreground">
                  Document item condition with photos before and after rental. Report damages immediately.
                  Basic protection coverage is included with all rentals.
                </p>
              </section>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}