#!/usr/bin/env python3
"""
Simple HTTP server with proper cache control headers for development.
Usage: python3 serve.py [port]
Default port: 8000
"""

import http.server
import socketserver
import sys
from datetime import datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with cache control headers."""
    
    def end_headers(self):
        # Add cache control headers
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
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
