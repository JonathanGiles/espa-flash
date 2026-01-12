# ESPa Flasher - Cloudflare Pages Deployment

## Overview
This ESP32 flasher is deployed as a static site on Cloudflare Pages with a serverless function for proxying firmware downloads.

## Deployment Setup

### Cloudflare Pages Configuration

1. **Connect your GitHub repository** to Cloudflare Pages
2. **Build settings:**
   - Build command: (none - static site)
   - Build output directory: `/`
   - Root directory: `/`

### Functions Directory

The `functions/` directory contains Cloudflare Workers that run serverless:

- `functions/proxy.js` - Proxies firmware downloads from GitHub to bypass CORS restrictions

Cloudflare automatically deploys any files in the `functions/` directory as Workers.

### Environment Variables

No environment variables are required for basic operation.

For private GitHub repositories, you can add:
- `GITHUB_TOKEN` - Personal access token (set in Cloudflare Pages settings)

## Local Development

### Using Python Server (Development)

```bash
./serve.sh
# or
python3 serve.py
```

The Python server includes:
- CORS headers for local development
- Local proxy endpoint at `/proxy?url=`
- No-cache headers for easy testing

### Using Cloudflare Wrangler (Production-like)

To test the Cloudflare Functions locally:

```bash
npm install -g wrangler
wrangler pages dev .
```

This runs a local server that mimics the Cloudflare Pages environment.

## How it Works

### CORS Proxy Flow

1. User selects firmware and clicks "Flash"
2. App detects environment (localhost vs production)
3. Firmware URLs are wrapped with `/proxy?url=`
4. ESP Web Tools fetches from the proxy endpoint
5. Proxy fetches from GitHub and adds CORS headers
6. Firmware is flashed to the ESP32 device

### Security

The proxy function only allows URLs from:
- `github.com`
- `githubusercontent.com`

This prevents abuse of the proxy for arbitrary URLs.

## Troubleshooting

### CORS Errors in Production

If you see CORS errors on Cloudflare Pages:
1. Check that `functions/proxy.js` is deployed
2. View the Functions logs in Cloudflare dashboard
3. Verify the function is being called (check Network tab)

### Local Development CORS

For local development, use the Python server which includes CORS headers.

### Testing Cloudflare Functions Locally

```bash
# Install Wrangler CLI
npm install -g wrangler

# Run local dev server with Functions support
wrangler pages dev . --port 8000

# Test the proxy endpoint
curl "http://localhost:8000/proxy?url=https://github.com/..."
```

## Performance

- Cloudflare caches proxied firmware files for 1 hour
- Reduces load on GitHub's servers
- Faster downloads for repeat users

## Updates

When deploying updates:
1. Push changes to GitHub
2. Cloudflare automatically rebuilds and deploys
3. Functions are updated automatically
4. No manual intervention needed

## Custom Domain

Configure your custom domain (flash.espa.diy) in:
- Cloudflare Pages dashboard
- Custom domains section
- Add CNAME record pointing to your-site.pages.dev

## Monitoring

Monitor your deployment:
- Cloudflare Pages dashboard for deployment status
- Functions tab for Worker invocations and errors
- Analytics for usage metrics
