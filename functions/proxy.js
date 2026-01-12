/**
 * Cloudflare Pages Function to proxy firmware downloads
 * This bypasses CORS restrictions when fetching from GitHub releases
 * 
 * URL: /proxy?url=<encoded_url>
 */

export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // Validate target URL exists
    if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    // Security: Only allow GitHub URLs
    try {
        const parsedTarget = new URL(targetUrl);
        if (!parsedTarget.hostname.includes('github.com') && !parsedTarget.hostname.includes('githubusercontent.com')) {
            return new Response('Only GitHub URLs are allowed', { status: 403 });
        }
    } catch (e) {
        return new Response('Invalid URL', { status: 400 });
    }

    try {
        // Fetch the remote file (follow redirects automatically)
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'ESPa-Flasher/1.0'
            },
            redirect: 'follow' // Follow GitHub's 302 redirects
        });

        if (!response.ok) {
            console.error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
            return new Response(`Failed to fetch: ${response.status} ${response.statusText}`, { 
                status: response.status 
            });
        }

        // Get the content type, default to binary
        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        
        // Create new response with CORS headers
        const newResponse = new Response(response.body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': response.headers.get('Content-Length'),
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=3600'
            }
        });

        return newResponse;
    } catch (error) {
        console.error('Proxy error:', error);
        return new Response(`Proxy error: ${error.message}`, { 
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain'
            }
        });
    }
}

// Handle CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
