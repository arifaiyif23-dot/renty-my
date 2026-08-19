import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Shield, Heart, Award } from "lucide-react"

const Footer = () => {
  const { t } = useTranslation()
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-block mb-3">
              <img src="/logo-light.png" alt="Renty" className="h-7 md:h-8 w-auto" loading="lazy" />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-success" />
                {t('footer.verified')}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3.5 w-3.5 text-primary" />
                {t('footer.secure')}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Award className="h-3.5 w-3.5 text-primary" />
                {t('footer.trusted')}
              </div>
            </div>
          </div>

          {/* Column 2 — Quick Links */}
          <div>
            <h4 className="text-sm font-bold mb-3 text-foreground">{t('footer.quickLinks')}</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.browseItems')}</Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.howItWorks')}</Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.trustSafety')}</Link>
              </li>
              <li>
                <Link to="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.categories')}</Link>
              </li>
            </ul>
          </div>

          {/* Column 3 — Support */}
          <div>
            <h4 className="text-sm font-bold mb-3 text-foreground">{t('footer.support')}</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.helpCenter')}</Link>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">WhatsApp (coming soon)</span>
              </li>
              <li>
                <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.contactUs')}</Link>
              </li>
              <li>
                <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.reportIssue')}</Link>
              </li>
              <li>
                <Link to="/disputes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.disputeResolution')}</Link>
              </li>
            </ul>
          </div>

          {/* Column 4 — Legal */}
          <div>
            <h4 className="text-sm font-bold mb-3 text-foreground">{t('footer.legal')}</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.termsOfService')}</Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.privacyPolicy')}</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center mb-3">{t('footer.acceptedPayments')}</p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium text-muted-foreground" role="img" aria-label="FPX online banking">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 12h8"/></svg>
              FPX
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium text-muted-foreground" role="img" aria-label="DuitNow QR">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12"/></svg>
              DuitNow
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium text-muted-foreground" role="img" aria-label="ToyyibPay">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              ToyyibPay
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium text-muted-foreground" role="img" aria-label="Visa and Mastercard">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
              Visa/MC
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Renty. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Made with <span className="text-primary">&hearts;</span> in Malaysia</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
