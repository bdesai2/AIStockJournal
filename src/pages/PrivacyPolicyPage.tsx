export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-display tracking-wider mb-2">PRIVACY POLICY</h1>
        <p className="text-sm text-muted-foreground mb-8">Last Updated: April 17, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">1. Introduction</h2>
            <p>
              Trade Reflection ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our trading journal application and related services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">2.1 Account Information</h3>
                <p className="text-sm">
                  When you create an account, we collect: email address, display name, broker name, and timezone. This information is necessary to provide and personalize the service.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2.2 Trading Data</h3>
                <p className="text-sm">
                  You voluntarily provide trading data including: ticker symbols, entry/exit prices, quantity, position type (long/short), execution details, risk metrics, and trade notes. This data is stored securely in our database.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2.3 Journal Entries</h3>
                <p className="text-sm">
                  Any text entries, charts, or media you upload to your trading journal are collected and stored. This information is private to your account.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2.4 Technical Data</h3>
                <p className="text-sm">
                  We may collect: IP address, browser type, device type, operating system, and usage patterns (pages visited, features used, time spent). This helps us improve performance and user experience.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2.5 Financial Data from Third Parties</h3>
                <p className="text-sm">
                  We may fetch stock prices and market data from Yahoo Finance and Finnhub APIs. This data is cached temporarily and not stored permanently.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">3. How We Use Your Information</h2>
            <ul className="text-sm space-y-2">
              <li>✓ Provide and improve the trading journal service</li>
              <li>✓ Store and sync your trades and journal entries</li>
              <li>✓ Calculate trading statistics and performance metrics</li>
              <li>✓ Analyze trades using Claude AI for educational purposes</li>
              <li>✓ Maintain service security and prevent fraud</li>
              <li>✓ Respond to support requests</li>
              <li>✓ Send service announcements (if enabled)</li>
              <li>✓ Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">4. Third-Party Services</h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">4.1 Supabase</h3>
                <p>
                  We use Supabase for database hosting and authentication. Your data is stored on Supabase servers. See their <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">privacy policy</a>.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4.2 Google OAuth</h3>
                <p>
                  Authentication via Google. We only receive your email and do not access other Google data. See Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">privacy policy</a>.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4.3 Claude AI (Anthropic)</h3>
                <p>
                  For AI-powered trade analysis, we send trade data to Claude API. Trade data is processed but not retained by Anthropic. See their <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">privacy policy</a>.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4.4 Yahoo Finance & Finnhub</h3>
                <p>
                  We fetch market data from these APIs. No personal information is sent. See their terms for data usage.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">5. Data Security</h2>
            <ul className="text-sm space-y-2">
              <li>✓ All data transmitted over HTTPS (encrypted in transit)</li>
              <li>✓ Passwords hashed and never stored in plain text</li>
              <li>✓ Row-level security (RLS) ensures users see only their data</li>
              <li>✓ Regular security audits and dependency updates</li>
              <li>✓ No credit card storage (trades are tracked by you, not automated billing)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">6. Your Privacy Rights (GDPR & CCPA)</h2>
            <div className="space-y-4 text-sm">
              <p className="font-semibold">You have the following rights:</p>
              <div>
                <h3 className="font-semibold mb-2">6.1 Right to Access</h3>
                <p>You can download all your personal data in JSON format from Settings → Data & Privacy.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">6.2 Right to Erasure ("Right to Be Forgotten")</h3>
                <p>You can request deletion of your account and all associated data. Go to Settings → Dangerous Zone → Delete My Account.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">6.3 Right to Data Portability</h3>
                <p>You can export your data in standard formats (JSON, CSV) and port it to another service.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">6.4 Right to Object</h3>
                <p>You can opt out of non-essential cookies and analytics at any time in your cookie preferences.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">7. Cookies</h2>
            <p className="text-sm mb-3">
              We use cookies for authentication and preferences. See our <a href="/cookie-policy" className="text-blue-400 hover:underline">Cookie Policy</a> for details.
            </p>
            <p className="text-sm">
              You can manage cookie preferences in Settings → Privacy Preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">8. Data Retention</h2>
            <div className="text-sm space-y-2">
              <p>
                <strong>Active Account:</strong> Your data is retained as long as your account is active.
              </p>
              <p>
                <strong>Deleted Account:</strong> Upon deletion, all personal data is permanently removed within 30 days. Backups may retain data for up to 90 days.
              </p>
              <p>
                <strong>Audit Logs:</strong> Sensitive action logs (deletions, exports) retained for 1 year for security purposes.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">9. Children's Privacy</h2>
            <p className="text-sm">
              Trade Reflection is not intended for users under 18. We do not knowingly collect data from minors. If we discover such data, we will delete it immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">10. Changes to This Policy</h2>
            <p className="text-sm">
              We may update this Privacy Policy. Changes take effect when posted. Continued use of the service constitutes acceptance of changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">11. Contact Us</h2>
            <p className="text-sm">
              For privacy inquiries or data requests, contact us at: <strong>privacy@stockjournal.app</strong>
            </p>
          </section>

          <section className="border-t border-border/50 pt-8 mt-8">
            <p className="text-xs text-muted-foreground">
              This privacy policy is provided for informational purposes. For legal matters, consult with a privacy attorney. By using Trade Reflection, you accept this Privacy Policy.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
