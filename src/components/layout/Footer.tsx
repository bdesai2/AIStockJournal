import { Link } from 'react-router-dom'
import { Github, Shield } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card/50 px-6 py-4 text-sm text-muted-foreground mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-8 mb-6 pb-6 border-b border-border/50">
          {/* Legal Links */}
          <div>
            <p className="font-semibold text-foreground mb-2">Legal</p>
            <ul className="space-y-1 text-xs">
              <li>
                <Link to="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/disclaimers" className="hover:text-foreground transition-colors">
                  Disclaimers
                </Link>
              </li>
              <li>
                <Link to="/cookie-policy" className="hover:text-foreground transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* About & Support */}
          <div>
            <p className="font-semibold text-foreground mb-2">Support</p>
            <ul className="space-y-1 text-xs">
              <li>
                <a href="https://github.com" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <Github className="w-3 h-3" />
                  GitHub
                </a>
              </li>
              <li>
                <a href="mailto:support@tradereflection.app" className="hover:text-foreground transition-colors">
                  support@tradereflection.app
                </a>
              </li>
              <li>
                <a href="mailto:privacy@tradereflection.app" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Security Report
                </a>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <p className="font-semibold text-foreground mb-2">About</p>
            <ul className="space-y-1 text-xs">
              <li className="text-muted-foreground">
                Trading journal for self-directed traders
              </li>
              <li>
                <span className="text-muted-foreground">Built with React & Supabase</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright & Legal Notice */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            © {currentYear} Trade Reflection. All rights reserved.
          </p>
          <p>
            ⚠️ <strong>Disclaimer:</strong> Trade Reflection is a journaling tool, not investment advice. Trading involves risk. See <Link to="/disclaimers" className="text-blue-400 hover:underline">Disclaimers</Link> before using.
          </p>
        </div>
      </div>
    </footer>
  )
}
