import { Link } from "react-router-dom"
import { Shield, Heart, Award } from "lucide-react"

const Footer = () => {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-block mb-3">
              <img src="/logo.png" alt="Renty" className="h-7 md:h-8 w-auto" loading="lazy" />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Rent anything you need, from people you can trust. Malaysia's peer-to-peer rental marketplace.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-success" />
                Verified
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3.5 w-3.5 text-primary" />
                Secure
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Award className="h-3.5 w-3.5 text-primary" />
                Trusted
              </div>
            </div>
          </div>

          {/* Column 2 — Quick Links */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Quick Links</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Browse items</Link>
              </li>
              <li>
                <a href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
              </li>
              <li>
                <a href="/#trust-safety" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Trust & safety</a>
              </li>
              <li>
                <Link to="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Categories</Link>
              </li>
            </ul>
          </div>

          {/* Column 3 — Support */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Support</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Help Center</Link>
              </li>
              <li>
                <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact us</Link>
              </li>
              <li>
                <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Report an issue</Link>
              </li>
              <li>
                <Link to="/disputes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dispute resolution</Link>
              </li>
            </ul>
          </div>

          {/* Column 4 — Legal */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Legal</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of service</Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy policy</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
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
