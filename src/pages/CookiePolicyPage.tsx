export function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-display tracking-wider mb-2">COOKIE POLICY</h1>
        <p className="text-sm text-muted-foreground mb-8">Last Updated: April 17, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">1. What Are Cookies?</h2>
            <p className="text-sm">
              Cookies are small text files stored on your device when you visit a website. They help websites remember information about your visit and improve your experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">2. What Cookies Do We Use?</h2>

            <div className="space-y-6">
              <div className="border-l-4 border-green-600 pl-4">
                <h3 className="text-lg font-semibold mb-2">✅ Essential Cookies (Always On)</h3>
                <p className="text-sm mb-3">
                  These cookies are required for the app to function. You cannot disable them without breaking core features.
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Supabase Session Cookie</strong>
                    <p className="text-muted-foreground">Authentication and session management. Keeps you logged in.</p>
                  </div>
                  <div>
                    <strong>CSRF Token</strong>
                    <p className="text-muted-foreground">Security cookie to prevent cross-site request forgery attacks.</p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-blue-600 pl-4">
                <h3 className="text-lg font-semibold mb-2">📊 Analytics Cookies (Opt-In)</h3>
                <p className="text-sm mb-3">
                  Used to understand how you use the app. Help us improve features and performance.
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Google Analytics</strong>
                    <p className="text-muted-foreground">
                      Pages visited, features used, time spent. Helps identify slow features or bugs. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">See Google's policy</a>
                    </p>
                  </div>
                  <div>
                    <strong>Event Tracking</strong>
                    <p className="text-muted-foreground">
                      Anonymized event data (trades logged, accounts created). No personal info shared.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-purple-600 pl-4">
                <h3 className="text-lg font-semibold mb-2">🎯 Marketing Cookies (Opt-In)</h3>
                <p className="text-sm mb-3">
                  Used for targeted advertising and retargeting (future feature).
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      Currently disabled. May be enabled in the future for non-intrusive ads.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">3. localStorage Items (Not Cookies)</h2>
            <p className="text-sm mb-3">
              We store some data in your browser's localStorage (not cookies) for convenience:
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <strong>theme</strong>
                <p className="text-muted-foreground">Light/dark mode preference. Stored locally, never sent to server.</p>
              </div>
              <div>
                <strong>selected_account_id</strong>
                <p className="text-muted-foreground">Your last selected trading account for quick switching.</p>
              </div>
              <div>
                <strong>cookie_consent</strong>
                <p className="text-muted-foreground">Your cookie preferences (essential, analytics, marketing).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">4. How We Use Cookies</h2>
            <ul className="text-sm space-y-2">
              <li>✓ Keep you logged in securely</li>
              <li>✓ Prevent fraudulent activity</li>
              <li>✓ Remember your preferences (theme, account selection)</li>
              <li>✓ Understand feature usage (analytics)</li>
              <li>✓ Improve performance and user experience</li>
              <li>✓ Comply with security standards</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">5. Your Cookie Choices</h2>
            <div className="bg-card border border-border rounded p-4 space-y-3 text-sm">
              <p className="font-semibold">You can manage your cookie preferences:</p>
              <p>
                ⚙️ Go to <strong>Settings → Privacy Preferences → Cookie Preferences</strong>
              </p>
              <p>
                There you can:
              </p>
              <ul className="space-y-1 ml-4">
                <li>✓ Accept or reject analytics cookies</li>
                <li>✓ Accept or reject marketing cookies</li>
                <li>✓ View your consent history</li>
                <li>✓ Change preferences anytime</li>
              </ul>
              <p className="text-muted-foreground text-xs italic">
                Note: Essential cookies cannot be disabled as they are required for the app to function.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">6. Disabling Cookies in Your Browser</h2>
            <p className="text-sm mb-3">
              You can also disable cookies via your browser settings, but this may break the app:
            </p>
            <ul className="text-sm space-y-1 ml-4">
              <li>Chrome: Settings → Privacy → Cookies</li>
              <li>Firefox: Preferences → Privacy → Cookies</li>
              <li>Safari: Preferences → Privacy → Cookies</li>
              <li>Edge: Settings → Privacy → Cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">7. Third-Party Cookies</h2>
            <p className="text-sm">
              We only use cookies from trusted third parties:
            </p>
            <ul className="text-sm space-y-2 mt-3 ml-4">
              <li>
                <strong>Supabase:</strong> Authentication. See their <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">privacy policy</a>.
              </li>
              <li>
                <strong>Google Analytics:</strong> Usage analytics. See their <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">privacy policy</a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">8. Do Not Track (DNT)</h2>
            <p className="text-sm">
              If your browser sends a "Do Not Track" signal, we will respect it by disabling analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">9. Cookie Duration</h2>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Session Cookies:</strong> Deleted when you close the browser
              </div>
              <div>
                <strong>Persistent Cookies:</strong> May last days, months, or years depending on the cookie
              </div>
              <div>
                <strong>localStorage Items:</strong> Remain indefinitely until you clear browser data
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">10. International Users (GDPR)</h2>
            <p className="text-sm">
              If you are in the EU, GDPR applies:
            </p>
            <ul className="text-sm space-y-1 mt-2 ml-4">
              <li>✓ Cookie consent is required before non-essential cookies</li>
              <li>✓ You can withdraw consent anytime</li>
              <li>✓ We will not use cookies without your explicit permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">11. Updates to This Policy</h2>
            <p className="text-sm">
              We may update this policy as we add new features or services. You will be notified of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">12. Contact</h2>
            <p className="text-sm">
              Questions about our use of cookies? Contact us at: <strong>privacy@stockjournal.app</strong>
            </p>
          </section>

          <section className="border-t border-border/50 pt-8 mt-8">
            <p className="text-xs text-muted-foreground">
              By continuing to use Trade Reflection, you accept our use of cookies as described in this policy. You can change your cookie preferences anytime in Settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
