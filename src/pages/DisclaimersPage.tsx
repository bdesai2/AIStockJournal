export function DisclaimersPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-display tracking-wider mb-2">DISCLAIMERS</h1>
        <p className="text-sm text-muted-foreground mb-8">Important Risk & Liability Notices</p>

        <div className="prose prose-invert max-w-none space-y-8 text-foreground/90">
          <section className="border-l-4 border-yellow-600 bg-yellow-950/30 p-4 rounded">
            <h2 className="text-2xl font-display tracking-wider mb-3">⚠️ TRADING DISCLAIMER</h2>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                Trade Reflection is a journaling and record-keeping tool for traders. IT IS NOT AND SHOULD NOT BE CONSTRUED AS INVESTMENT ADVICE.
              </p>
              <ul className="space-y-2">
                <li>🚫 We do not provide financial advice or recommendations</li>
                <li>🚫 We do not tell you which trades to take or avoid</li>
                <li>🚫 AI analysis is educational and experimental only</li>
                <li>🚫 Past performance does not indicate future results</li>
                <li>🚫 Historical statistics are for your personal analysis only</li>
              </ul>
              <p className="italic mt-3">
                Any trading or investment decisions you make are your own responsibility. Conduct your own due diligence and consult a licensed financial advisor if needed.
              </p>
            </div>
          </section>

          <section className="border-l-4 border-red-600 bg-red-950/30 p-4 rounded">
            <h2 className="text-2xl font-display tracking-wider mb-3">⚠️ RISK ACKNOWLEDGMENT</h2>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                Trading securities involves substantial risk of loss. You could lose all or more than your initial investment.
              </p>
              <div>
                <h3 className="font-semibold mb-2">Key Risks Include:</h3>
                <ul className="space-y-1 ml-4">
                  <li>✗ Market volatility and price swings</li>
                  <li>✗ Liquidity risk (inability to exit positions)</li>
                  <li>✗ Leverage risk (amplified losses with margin)</li>
                  <li>✗ Gap risk (prices jumping past stop losses)</li>
                  <li>✗ Company-specific risks (earnings misses, bankruptcies)</li>
                  <li>✗ Sector/market downturns</li>
                  <li>✗ Geopolitical events and black swan events</li>
                </ul>
              </div>
              <p className="italic">
                Never risk more than you can afford to lose. Always use proper position sizing and risk management.
              </p>
            </div>
          </section>

          <section className="border-l-4 border-blue-600 bg-blue-950/30 p-4 rounded">
            <h2 className="text-2xl font-display tracking-wider mb-3">🤖 AI ANALYSIS DISCLAIMER</h2>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                Claude AI trade analysis is experimental, educational, and NOT investment advice.
              </p>
              <div>
                <h3 className="font-semibold mb-2">Important Limitations:</h3>
                <ul className="space-y-1 ml-4">
                  <li>⚠️ AI can make mistakes, hallucinate, or misinterpret data</li>
                  <li>⚠️ AI analysis is based on historical data only</li>
                  <li>⚠️ AI cannot predict future market behavior</li>
                  <li>⚠️ AI may miss important context or edge cases</li>
                  <li>⚠️ AI scores are subjective and vary by model version</li>
                  <li>⚠️ No warranty that AI analysis is accurate or useful</li>
                </ul>
              </div>
              <p className="italic">
                Treat AI feedback as one input among many. Always apply your own judgment and critical thinking to AI suggestions.
              </p>
            </div>
          </section>

          <section className="border-l-4 border-orange-600 bg-orange-950/30 p-4 rounded">
            <h2 className="text-2xl font-display tracking-wider mb-3">📊 DATA ACCURACY DISCLAIMER</h2>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                Market data and API information may be delayed, incomplete, or inaccurate.
              </p>
              <ul className="space-y-2">
                <li>⚠️ Yahoo Finance & Finnhub prices may lag real-time by 15-20 minutes</li>
                <li>⚠️ We cannot guarantee data freshness or accuracy</li>
                <li>⚠️ Use your broker's data as the source of truth</li>
                <li>⚠️ API outages may cause data unavailability</li>
                <li>⚠️ Historical data may contain errors or adjustments</li>
              </ul>
              <p className="italic">
                Always verify prices, fills, and stats with your broker before relying on them.
              </p>
            </div>
          </section>

          <section className="border-l-4 border-green-600 bg-green-950/30 p-4 rounded">
            <h2 className="text-2xl font-display tracking-wider mb-3">💾 DATA RESPONSIBILITY</h2>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                You are responsible for the accuracy and security of your own data.
              </p>
              <ul className="space-y-2">
                <li>✓ We store your data securely, but cannot guarantee protection from all threats</li>
                <li>✓ You should maintain backups of critical trading records</li>
                <li>✓ You are responsible for keeping your password secure</li>
                <li>✓ Do not share account details with anyone</li>
                <li>✓ Report suspicious activity immediately</li>
              </ul>
            </div>
          </section>

          <section className="border-l-4 border-purple-600 bg-purple-950/30 p-4 rounded">
            <h2 className="text-2xl font-display tracking-wider mb-3">🏛️ REGULATORY DISCLAIMER</h2>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                Trade Reflection is not a registered investment advisor or broker.
              </p>
              <ul className="space-y-2">
                <li>📋 We do not provide advisory services</li>
                <li>📋 We do not custody funds or execute trades</li>
                <li>📋 We are a journaling and record-keeping tool only</li>
                <li>📋 You are responsible for complying with all applicable laws and regulations</li>
                <li>📋 Consult a licensed advisor for tax, legal, or investment guidance</li>
              </ul>
            </div>
          </section>

          <section className="border-l-4 border-indigo-600 bg-indigo-950/30 p-4 rounded">
            <h2 className="text-2xl font-display tracking-wider mb-3">📱 PLATFORM DISCLAIMER</h2>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">
                Trade Reflection is provided on an "as-is" basis without service guarantees.
              </p>
              <ul className="space-y-2">
                <li>⚠️ We do not guarantee uptime or availability</li>
                <li>⚠️ Service may be interrupted for maintenance or updates</li>
                <li>⚠️ Features may change or be discontinued</li>
                <li>⚠️ We are not liable for losses arising from service unavailability</li>
                <li>⚠️ You use the platform at your own risk</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display tracking-wider mb-3">Terms & Policies</h2>
            <p className="text-sm">
              For complete legal information, please review our:
            </p>
            <ul className="text-sm space-y-1 mt-2 ml-4">
              <li>📄 <a href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</a></li>
              <li>📄 <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a></li>
              <li>📄 <a href="/cookie-policy" className="text-blue-400 hover:underline">Cookie Policy</a></li>
            </ul>
          </section>

          <section className="border-t border-border/50 pt-8 mt-8">
            <p className="text-xs text-muted-foreground">
              ⚖️ These disclaimers are provided for informational purposes and should not be construed as legal advice. For legal matters, consult with a qualified attorney. By using Trade Reflection, you acknowledge and accept all disclaimers and risks outlined above.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
