#!/usr/bin/env python3
"""
Simple HTTP server with proper cache control headers and CORS proxy for development.
Usage: python3 serve.py [port]
Default port: 8000
"""

import http.server
import socketserver
import sys
import urllib.request
import urllib.parse
from datetime import datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with cache control headers and CORS proxy."""
    
    def end_headers(self):
        # Add cache control headers
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Add CORS headers for all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_GET(self):
        # Handle CORS proxy requests
        if self.path.startswith('/proxy?url='):
            self.handle_proxy()
        else:
            super().do_GET()
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.end_headers()
    
    def handle_proxy(self):
        """Proxy requests to external URLs to bypass CORS."""
        try:
            # Extract the target URL from query parameter
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            
            # Debug logging
            print(f"[DEBUG] Proxy request - path: {self.path}")
            print(f"[DEBUG] Query params: {params}")
            
            if 'url' not in params:
                self.send_error(400, "Missing 'url' parameter")
                return
            
            target_url = params['url'][0]
            print(f"[DEBUG] Fetching from: {target_url}")
            
            # Fetch the remote file
            req = urllib.request.Request(target_url)
            req.add_header('User-Agent', 'ESPa-Flasher/1.0')
            
            with urllib.request.urlopen(req) as response:
                content = response.read()
                content_length = len(content)
                print(f"[DEBUG] Fetched {content_length} bytes successfully")
                
                # Send successful response
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', content_length)
                self.end_headers()
                self.wfile.write(content)
                
        except urllib.error.HTTPError as e:
            print(f"[ERROR] HTTP Error: {e.code} - {e.reason}")
            self.send_error(e.code, f"Proxy error: {e.reason}")
        except Exception as e:
            print(f"[ERROR] Exception: {str(e)}")
            self.send_error(500, f"Proxy error: {str(e)}")
    
    def log_message(self, format, *args):
        """Log with timestamp."""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        sys.stderr.write(f"[{timestamp}] {format % args}\n")

with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    print("Press Ctrl+C to stop")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
