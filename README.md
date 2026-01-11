# ESP Device Flasher

A professional, static web application for flashing ESP devices directly from the browser using ESP Web Tools and GitHub releases. Configured for the ESPySpa project with support for multiple device targets.

## Features

- 🚀 **Browser-based flashing** - Flash ESP devices directly from your browser using WebSerial API
- 📦 **GitHub Integration** - Automatically fetch firmware releases from your GitHub repository
- 🎯 **Multi-Target Support** - Select from multiple device targets (esp32dev, espa-v1, espa-v2)
- 🎨 **Modern UI** - Clean, professional interface with responsive design
- ⚡ **Zero Backend** - Pure static site (HTML, CSS, JS) - deploy anywhere
- 🔧 **Easy Configuration** - Simple config file to point to your repo
- 📱 **Mobile Friendly** - Works on desktop and mobile devices

## Quick Start

### 1. Configure Your Repository

The site is pre-configured for ESPySpa. To customize, edit `config.js`:

```javascript
const ESP_FLASHER_CONFIG = {
    owner: 'wayne-love',
    repo: 'ESPySpa',
    chipFamily: 'ESP32',
    deviceTargets: [
        { id: 'esp32dev', name: 'ESP32 Dev Board', description: 'Generic ESP32 development board' },
        { id: 'espa-v1', name: 'ESPa v1', description: 'ESPa hardware version 1' },
        { id: 'espa-v2', name: 'ESPa v2', description: 'ESPa hardware version 2' },
    ],
    defaultTarget: 'esp32dev',
};
```

### 2. Deploy

Simply upload the files to any static hosting service:

- **GitHub Pages**: Push to `gh-pages` branch
- **Netlify**: Drag and drop the folder
- **Vercel**: Import from Git
- **AWS S3**: Upload as static website
- **Any web server**: Just copy the files

### 3. Use

1. Open the website in a compatible browser (Chrome, Edge, or Opera)
2. **Select your device target** from the dropdown (esp32dev, espa-v1, or espa-v2)
3. Connect your ESP device via USB
4. Select a firmware release (only releases with firmware for your selected target will show)
5. Click "Flash to Device"
6. Choose the serial port and wait for completion

## Device Targets

The flasher supports multiple hardware targets for ESPySpa:

- **esp32dev** - Generic ESP32 development board
- **espa-v1** - ESPa hardware version 1
- **espa-v2** - ESPa hardware version 2

Each release should contain firmware files matching this pattern:
- `firmware_{target}_factory.bin` - Main firmware (flashed at 0x0)
- `spiffs_{target}.bin` - Filesystem (flashed at 0x290000)

## Browser Requirements

This tool requires a browser with WebSerial API support:
- ✅ Google Chrome (89+)
- ✅ Microsoft Edge (89+)
- ✅ Opera (75+)
- ❌ Firefox (not supported yet)
- ❌ Safari (not supported yet)

## Firmware Format

The flasher works with GitHub releases containing firmware files. It supports the ESPySpa release format:

### ESPySpa Release Format

Each release should contain firmware files for each target device:

```
release-v1.0.15/
├── firmware_esp32dev_factory.bin
├── firmware_espa-v1_factory.bin
├── firmware_espa-v2_factory.bin
├── spiffs_esp32dev.bin
├── spiffs_espa-v1.bin
└── spiffs_espa-v2.bin
```

The flasher will:
1. Parse available targets from the firmware files
2. Filter releases based on selected target
3. Flash both firmware and filesystem in one operation

### File Naming Conventions

- **Firmware**: `firmware_{target}_factory.bin` or `firmware_{target}.bin`
- **Filesystem**: `spiffs_{target}.bin`

### Flash Offsets

- Factory firmware: `0x0` (includes bootloader, partitions, and app)
- Filesystem (SPIFFS): `0x290000`

## Building from Source

**Note:** Browser-based compilation is not possible due to the native C++ toolchain requirements.

### Options for Building

#### 1. GitHub Actions (Recommended)

Fork the repository and use GitHub Actions for automatic builds:

```bash
# Fork the repository on GitHub
# Enable Actions in your fork
# Every commit/tag will trigger a build
```

The ESPySpa repository already has GitHub Actions configured to build firmware on every release.

#### 2. Local Build with PlatformIO

```bash
# Clone the repository
git clone https://github.com/wayne-love/ESPySpa.git
cd ESPySpa

# Install PlatformIO
pip install platformio

# Build for all targets
pio run

# Build for specific target
pio run -e esp32dev
pio run -e espa-v1
pio run -e espa-v2

# Build and upload
pio run -e esp32dev -t upload
```

#### 3. Build and Create Release

After building locally, you can create releases with the artifacts:

```bash
# Build all targets
pio run

# Artifacts will be in:
# .pio/build/esp32dev/firmware.bin
# .pio/build/espa-v1/firmware.bin
# .pio/build/espa-v2/firmware.bin

# Create a GitHub release and upload these files
```

### Why Not Browser-Based Building?

Building ESP firmware requires:
- C++ compiler toolchain (gcc, g++)
- ESP-IDF or Arduino framework
- Native build tools (make, cmake)
- Several GB of dependencies

These cannot run in a web browser due to:
- No native code execution in browsers
- Large toolchain size (not suitable for download)
- Security restrictions in browser environments

The current approach (using pre-built releases) is more efficient and secure.

## File Structure

```
flash/
├── index.html       # Main HTML structure
├── styles.css       # Professional styling
├── app.js          # Application logic
├── config.js       # Configuration file
└── README.md       # Documentation
```

## Configuration Options

### config.js

```javascript
const ESP_FLASHER_CONFIG = {
    // GitHub repository owner
    owner: 'wayne-love',
    
    // GitHub repository name
    repo: 'ESPySpa',
    
    // ESP chip family
    chipFamily: 'ESP32',
    
    // Device targets - each should have corresponding firmware files
    deviceTargets: [
        { 
            id: 'esp32dev',           // Matches firmware_esp32dev_factory.bin
            name: 'ESP32 Dev Board',  // Display name
            description: 'Generic ESP32 development board' 
        },
        { 
            id: 'espa-v1', 
            name: 'ESPa v1', 
            description: 'ESPa hardware version 1' 
        },
        { 
            id: 'espa-v2', 
            name: 'ESPa v2', 
            description: 'ESPa hardware version 2' 
        },
    ],
    
    // Default target to select on page load
    defaultTarget: 'esp32dev',
    
    // Optional: GitHub token for private repos (leave empty for public)
    githubToken: '',
};
```

### Adding New Targets

To add a new device target:

1. Add it to `deviceTargets` in `config.js`
2. Ensure your releases include matching firmware files:
   - `firmware_{newtarget}_factory.bin`
   - `spiffs_{newtarget}.bin`

## Example Release Structure

Your GitHub releases should include firmware files:

```
release-v1.0.15/
├── firmware_esp32dev_factory.bin   # Required for esp32dev target
├── firmware_espa-v1_factory.bin    # Required for espa-v1 target
├── firmware_espa-v2_factory.bin    # Required for espa-v2 target
├── spiffs_esp32dev.bin             # Optional filesystem for esp32dev
├── spiffs_espa-v1.bin              # Optional filesystem for espa-v1
└── spiffs_espa-v2.bin              # Optional filesystem for espa-v2
```

Supported firmware file extensions:
- `.bin` - Binary firmware files (recommended for ESPySpa)

## Deployment Examples

### GitHub Pages

```bash
# Create gh-pages branch
git checkout -b gh-pages

# Add your files
git add .
git commit -m "Deploy flasher"
git push origin gh-pages

# Enable GitHub Pages in repository settings
```

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=.
```

### Local Testing

```bash
# Use Python's built-in server
python3 -m http.server 8000

# Or use Node.js
npx serve .

# Open http://localhost:8000
```

## Customization

### Styling

Edit `styles.css` to customize:
- Colors (CSS variables in `:root`)
- Layout and spacing
- Typography
- Responsive breakpoints

### Functionality

Edit `app.js` to:
- Change offset calculations
- Modify manifest generation
- Add custom validation
- Enhance error handling

## Troubleshooting

### "No releases found"
- Check that your GitHub repo has published releases
- Verify the owner/repo names in `config.js`
- Ensure releases are public (or add a GitHub token)

### "No compatible browser"
- Use Chrome, Edge, or Opera (89+)
- WebSerial API is not available in Firefox or Safari yet

### "Failed to flash"
- Ensure the ESP device is properly connected
- Try a different USB cable
- Put the device in bootloader mode manually
- Check that firmware files are compatible with your chip

### CORS Errors
- GitHub API allows CORS by default for releases
- If hosting firmware elsewhere, ensure CORS headers are set

## Security Notes

- Never commit GitHub tokens to public repositories
- Use GitHub tokens only for private repositories
- The app runs entirely in the browser - no server-side code
- Firmware files are fetched directly from GitHub's CDN

## Credits

Built with:
- [ESP Web Tools](https://esphome.github.io/esp-web-tools/) - Browser-based ESP flashing
- [GitHub API](https://docs.github.com/en/rest) - Releases integration
- [WebSerial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) - Serial communication

## License

This project is provided as-is for use with ESP device firmware flashing.

## Support

For issues with:
- **This flasher tool**: Check configuration and browser compatibility
- **ESP Web Tools**: Visit [ESP Web Tools documentation](https://esphome.github.io/esp-web-tools/)
- **Firmware issues**: Contact your firmware provider

---

Made with ❤️ for the ESP community
