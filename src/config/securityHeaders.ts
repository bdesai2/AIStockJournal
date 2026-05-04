/**
 * Security Headers Configuration
 *
 * These headers should be configured on the server (Vercel, Netlify, etc.)
 * to enhance security. Configure via your hosting provider's headers settings.
 *
 * Since this is a Vite SPA, headers should be configured:
 * 1. Vercel: vercel.json
 * 2. Netlify: netlify.toml
 * 3. Traditional servers: nginx.conf or apache config
 */

// Example for Vercel (vercel.json)
export const vercelHeaders = [
  {
    source: '/(.*)',
    headers: [
      // Content Security Policy - Prevent XSS attacks
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'wasm-unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://www.google-analytics.com https://api.anthropic.com https://*.supabase.co wss://*.supabase.co",
          "frame-src 'self' https://accounts.google.com",
          "base-uri 'self'",
          "form-action 'self'",
          "upgrade-insecure-requests",
        ].join('; '),
      },

      // Prevent MIME type sniffing
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },

      // Prevent clickjacking attacks
      {
        key: 'X-Frame-Options',
        value: 'DENY', // Or SAMEORIGIN if embedding in iframe
      },

      // Prevent XSS attacks (older browsers)
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },

      // Referrer Policy
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },

      // Permissions Policy (formerly Feature Policy)
      {
        key: 'Permissions-Policy',
        value: 'geolocation=(), microphone=(), camera=()',
      },

      // HSTS (HTTPS Strict Transport Security)
      // Uncomment in production after testing
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },

      // Disable server information exposure
      {
        key: 'X-Powered-By',
        value: '',
      },

      // Cache control for security
      {
        key: 'Cache-Control',
        value: 'public, max-age=3600, must-revalidate',
      },
    ],
  },
]

/*
 * Example for Netlify (netlify.toml)
 *
 * [[headers]]
 *   for = "/*"
 *   [headers.values]
 *     Content-Security-Policy = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com https://api.anthropic.com https://supabase.co; frame-src 'self' https://accounts.google.com; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
 *     X-Content-Type-Options = "nosniff"
 *     X-Frame-Options = "DENY"
 *     X-XSS-Protection = "1; mode=block"
 *     Referrer-Policy = "strict-origin-when-cross-origin"
 *     Permissions-Policy = "geolocation=(), microphone=(), camera=()"
 *     Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
 *     Cache-Control = "public, max-age=3600, must-revalidate"
 */

/*
 * Example for Nginx
 *
 * server {
 *     listen 443 ssl http2;
 *     server_name yourdomain.com;
 *
 *     # SSL Configuration
 *     ssl_certificate /path/to/cert.pem;
 *     ssl_certificate_key /path/to/key.pem;
 *     ssl_protocols TLSv1.3 TLSv1.2;
 *     ssl_ciphers HIGH:!aNULL:!MD5;
 *
 *     # Security Headers
 *     add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com https://api.anthropic.com https://supabase.co; frame-src 'self' https://accounts.google.com; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";
 *     add_header X-Content-Type-Options "nosniff";
 *     add_header X-Frame-Options "DENY";
 *     add_header X-XSS-Protection "1; mode=block";
 *     add_header Referrer-Policy "strict-origin-when-cross-origin";
 *     add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
 *     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
 *
 *     # Redirect HTTP to HTTPS
 *     error_page 497 https://$server_name$request_uri;
 *
 *     location / {
 *         root /path/to/build;
 *         index index.html;
 *         try_files $uri $uri/ /index.html;
 *     }
 * }
 */

export const headerExplanations = {
  'Content-Security-Policy': 'Prevents XSS attacks by restricting where scripts can be loaded from',
  'X-Content-Type-Options': 'Prevents MIME type sniffing attacks',
  'X-Frame-Options': 'Prevents clickjacking by disallowing frame embedding',
  'X-XSS-Protection': 'Legacy XSS protection for older browsers',
  'Referrer-Policy': 'Controls referrer information sent with requests',
  'Permissions-Policy': 'Restricts access to browser features (geolocation, microphone, camera)',
  'Strict-Transport-Security': 'Forces HTTPS connections and prevents downgrade attacks',
}

export const setupInstructions = {
  vercel: 'Create/update vercel.json at root with headers configuration',
  netlify: 'Add headers section to netlify.toml',
  nginx: 'Add add_header directives to nginx.conf',
  apache: 'Use mod_headers to add headers in .htaccess or vhost config',
  custom: 'Configure via your hosting provider\'s dashboard or infrastructure-as-code',
}
