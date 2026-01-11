// Main application logic
class ESPFlasher {
    constructor(config) {
        this.config = config;
        this.releases = [];
        this.selectedTarget = config.defaultTarget || (config.deviceTargets && config.deviceTargets[0]?.id) || 'esp32dev';
        this.customChipFamily = null; // null means use target's chip family
        this.releasesPerPage = 10;
        this.displayedCount = 0;
        this.init();
    }

    async init() {
        this.setupDeviceSelector();
        this.setupChipFamilySelector();
        await this.loadReleases();
        this.setupEventListeners();
    }

    setupDeviceSelector() {
        const selectEl = document.getElementById('deviceTarget');
        const descriptionEl = document.getElementById('deviceDescription');
        
        if (!selectEl || !this.config.deviceTargets) return;
        
        // Populate device options
        this.config.deviceTargets.forEach(target => {
            const option = document.createElement('option');
            option.value = target.id;
            option.textContent = target.name;
            if (target.id === this.selectedTarget) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });
        
        // Update description and chip family
        this.updateDeviceDescription();
        this.updateChipFamilyDisplay();
        
        // Listen for changes
        selectEl.addEventListener('change', (e) => {
            this.selectedTarget = e.target.value;
            this.updateDeviceDescription();
            this.updateChipFamilyDisplay();
            this.renderReleases(this.releases); // Re-render to update available files
        });
    }

    setupChipFamilySelector() {
        const toggleBtn = document.getElementById('toggleCustomChip');
        const customSelector = document.getElementById('customChipSelector');
        const customChipSelect = document.getElementById('customChipFamily');
        
        if (!toggleBtn || !customSelector || !customChipSelect) return;
        
        // Toggle custom chip family selector
        toggleBtn.addEventListener('click', () => {
            const isVisible = customSelector.style.display !== 'none';
            customSelector.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible 
                ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="margin-right: 0.25rem;"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Override Chip Family'
                : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="margin-right: 0.25rem;"><path d="M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Hide Override';
            
            if (isVisible) {
                // Reset to target's chip family
                this.customChipFamily = null;
                this.updateChipFamilyDisplay();
            }
        });
        
        // Listen for custom chip family changes
        customChipSelect.addEventListener('change', (e) => {
            this.customChipFamily = e.target.value;
            this.updateChipFamilyDisplay();
        });
    }

    getCurrentChipFamily() {
        // Use custom chip family if set, otherwise use target's chip family
        if (this.customChipFamily) {
            return this.customChipFamily;
        }
        
        const target = this.config.deviceTargets?.find(t => t.id === this.selectedTarget);
        return target?.chipFamily || this.config.chipFamily || 'ESP32';
    }

    updateChipFamilyDisplay() {
        const chipBadge = document.getElementById('chipFamilyDisplay');
        const customChipBtn = document.getElementById('toggleCustomChip');
        const customSelector = document.getElementById('customChipSelector');
        
        if (!chipBadge) return;
        
        const chipFamily = this.getCurrentChipFamily();
        const target = this.config.deviceTargets?.find(t => t.id === this.selectedTarget);
        const isHardwareLocked = target && target.chipFamily && this.selectedTarget !== 'esp32dev';
        
        chipBadge.textContent = chipFamily;
        
        // Update badge color and style
        if (this.customChipFamily) {
            chipBadge.style.background = 'var(--warning)';
        } else if (isHardwareLocked) {
            chipBadge.style.background = 'var(--text-tertiary)';
        } else {
            chipBadge.style.background = 'var(--primary)';
        }
        
        // Show/hide custom chip selector based on hardware
        if (customChipBtn && customSelector) {
            if (isHardwareLocked) {
                // Hide custom option for specific hardware
                customChipBtn.style.display = 'none';
                customSelector.style.display = 'none';
                this.customChipFamily = null;
            } else {
                // Show custom option for generic hardware
                customChipBtn.style.display = 'inline-flex';
            }
        }
    }

    updateDeviceDescription() {
        const descriptionEl = document.getElementById('deviceDescription');
        if (!descriptionEl || !this.config.deviceTargets) return;
        
        const target = this.config.deviceTargets.find(t => t.id === this.selectedTarget);
        if (target && target.description) {
            descriptionEl.textContent = target.description;
        }
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadReleases());
        }

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreReleases());
        }

        // Help blade
        const helpBtn = document.getElementById('helpBtn');
        const closeHelpBtn = document.getElementById('closeHelpBlade');
        const helpBlade = document.getElementById('helpBlade');
        
        if (helpBtn && helpBlade) {
            helpBtn.addEventListener('click', () => {
                helpBlade.classList.add('active');
            });
        }
        
        if (closeHelpBtn && helpBlade) {
            closeHelpBtn.addEventListener('click', () => {
                helpBlade.classList.remove('active');
            });
            
            // Close on overlay click
            const overlay = helpBlade.querySelector('.blade-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => {
                    helpBlade.classList.remove('active');
                });
            }
        }
    }

    async loadReleases() {
        const loadingEl = document.getElementById('loadingReleases');
        const containerEl = document.getElementById('releasesContainer');
        const noReleasesEl = document.getElementById('noReleases');

        // Show loading state
        loadingEl.style.display = 'flex';
        containerEl.style.display = 'none';
        noReleasesEl.style.display = 'none';

        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/releases?per_page=50`
            );

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const releases = await response.json();
            this.releases = releases;

            // Hide loading
            loadingEl.style.display = 'none';

            if (releases.length === 0) {
                noReleasesEl.style.display = 'flex';
            } else {
                containerEl.style.display = 'grid';
                this.renderReleases(releases);
            }
        } catch (error) {
            console.error('Error loading releases:', error);
            loadingEl.style.display = 'none';
            noReleasesEl.style.display = 'flex';
            noReleasesEl.querySelector('h3').textContent = 'Error loading releases';
            noReleasesEl.querySelector('p').textContent = error.message;
        }
    }

    renderReleases(releases, append = false) {
        const container = document.getElementById('releasesContainer');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        
        if (!append) {
            container.innerHTML = '';
            this.displayedCount = 0;
        }

        let isFirstStableRelease = !append;
        let rendered = 0;
        
        for (let i = this.displayedCount; i < releases.length && rendered < this.releasesPerPage; i++) {
            const release = releases[i];
            const releaseCard = this.createReleaseCard(release, isFirstStableRelease);
            if (releaseCard) {
                container.appendChild(releaseCard);
                rendered++;
                // Mark that we've seen the first stable release
                if (!release.prerelease && isFirstStableRelease) {
                    isFirstStableRelease = false;
                }
            }
            this.displayedCount++;
        }
        
        // Show or hide Load More button
        if (loadMoreContainer) {
            if (this.displayedCount < releases.length) {
                loadMoreContainer.style.display = 'flex';
            } else {
                loadMoreContainer.style.display = 'none';
            }
        }
    }

    loadMoreReleases() {
        this.renderReleases(this.releases, true);
    }

    getTargetAssets(release, target) {
        // Find firmware and filesystem files for the selected target
        // Handle legacy naming: 'spa-control-pcb' is synonymous with 'espa-v1'
        const targetNames = [target];
        if (target === 'espa-v1') {
            targetNames.push('spa-control-pcb');
        }
        
        let firmware = null;
        let spiffs = null;
        
        // Try each target name
        for (const targetName of targetNames) {
            const firmwarePattern = new RegExp(`firmware[_-]${targetName}[_-]?.*\\.bin$`, 'i');
            const spiffsPattern = new RegExp(`spiffs[_-]${targetName}\\.bin$`, 'i');
            
            if (!firmware) {
                firmware = release.assets.find(asset => firmwarePattern.test(asset.name));
            }
            if (!spiffs) {
                spiffs = release.assets.find(asset => spiffsPattern.test(asset.name));
            }
            
            // If we found both, we can stop
            if (firmware && spiffs) break;
        }
        
        return { firmware, spiffs };
    }

    createReleaseCard(release, isFirstStable = false) {
        const card = document.createElement('div');
        card.className = 'release-card';

        const date = new Date(release.published_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Get assets for selected target
        const { firmware, spiffs } = this.getTargetAssets(release, this.selectedTarget);
        
        // Skip this release if no firmware for selected target
        if (!firmware && !spiffs) {
            return null;
        }

        const targetInfo = this.config.deviceTargets?.find(t => t.id === this.selectedTarget);

        card.innerHTML = `
            <div class="release-header">
                <div class="release-title">
                    <div class="release-name">${this.escapeHtml(release.name || release.tag_name)}</div>
                    <div class="release-tag">${this.escapeHtml(release.tag_name)}</div>
                </div>
                ${!release.prerelease && isFirstStable ? '<span class="release-badge">Latest</span>' : ''}
            </div>
            <div class="release-date">Released on ${date}</div>
            <div class="release-actions">
                <button class="btn-primary btn-small flash-btn" data-release-id="${release.id}" ${!firmware ? 'disabled' : ''}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8.5 2L3 9H8L7.5 14L13 7H8L8.5 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Flash
                </button>
                ${release.body ? `
                    <button class="btn-secondary btn-small changelog-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3 6.5C3 5.67157 3.67157 5 4.5 5H11.5C12.3284 5 13 5.67157 13 6.5V11.5C13 12.3284 12.3284 13 11.5 13H4.5C3.67157 13 3 12.3284 3 11.5V6.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M5 5V4C5 3.44772 5.44772 3 6 3H10C10.5523 3 11 3.44772 11 4V5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M6 8.5H10M6 10.5H8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        Details
                    </button>
                ` : ''}
                <a href="${release.html_url}" target="_blank" class="btn-secondary btn-small btn-icon-text" style="text-decoration: none;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" fill="currentColor"/>
                    </svg>
                    <span class="btn-text-label">GitHub</span>
                </a>
            </div>
        `;

        // Add flash button event listener
        const flashBtn = card.querySelector('.flash-btn');
        if (flashBtn && !flashBtn.disabled) {
            flashBtn.addEventListener('click', () => this.prepareFlash(release));
        }

        // Add changelog button listener
        const changelogBtn = card.querySelector('.changelog-btn');
        if (changelogBtn) {
            changelogBtn.addEventListener('click', () => this.openChangelogBlade(release, date));
        }

        return card;
    }

    async prepareFlash(release) {
        // Get assets for selected target
        const { firmware, spiffs } = this.getTargetAssets(release, this.selectedTarget);
        
        if (!firmware) {
            alert('No firmware file found for the selected target.');
            return;
        }
        
        // Create manifest for flashing
        await this.createAndFlashManifest(release, firmware, spiffs);
    }

    async flashWithManifest(manifestUrl) {
        try {
            const response = await fetch(manifestUrl);
            const manifest = await response.json();
            this.showFlashDialog(manifest);
        } catch (error) {
            console.error('Error loading manifest:', error);
            alert('Error loading firmware manifest. Please try again.');
        }
    }

    async createAndFlashManifest(release, firmware, spiffs) {
        // Build parts array
        const parts = [];
        
        // Add firmware (typically at 0x10000 for factory builds)
        if (firmware) {
            parts.push({
                path: firmware.browser_download_url,
                offset: firmware.name.includes('factory') ? 0x0 : 0x10000
            });
        }
        
        // Add filesystem if available (typically at 0x290000)
        if (spiffs) {
            parts.push({
                path: spiffs.browser_download_url,
                offset: 0x290000
            });
        }

        // Get the appropriate chip family
        const chipFamily = this.getCurrentChipFamily();

        // Create manifest
        const manifest = {
            name: `${release.name || release.tag_name} - ${this.selectedTarget}${this.customChipFamily ? ' (Custom)' : ''}`,
            version: release.tag_name,
            home_assistant_domain: "esphome",
            new_install_prompt_erase: true,
            builds: [
                {
                    chipFamily: chipFamily,
                    parts: parts
                }
            ]
        };

        this.showFlashDialog(manifest);
    }

    showFlashDialog(manifest) {
        // Create and show ESP Web Tools install button
        const installButton = document.createElement('esp-web-install-button');
        installButton.manifest = JSON.stringify(manifest);
        
        // Create custom button for the activate slot
        const customButton = document.createElement('button');
        customButton.setAttribute('slot', 'activate');
        customButton.className = 'btn-primary';
        customButton.textContent = 'Connect';
        installButton.appendChild(customButton);
        
        // Create a temporary dialog
        const dialog = document.createElement('dialog');
        dialog.className = 'flash-dialog';
        dialog.innerHTML = `
            <div class="flash-dialog-content">
                <div class="flash-dialog-header">
                    <div class="flash-dialog-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h2>Flash Firmware</h2>
                    <button class="flash-dialog-close" id="closeDialog" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <p class="flash-dialog-description">
                    Connect your ESP device via USB and click the Connect button below to begin flashing.
                </p>
                <div class="flash-dialog-footer">
                    <div class="flash-dialog-button-container"></div>
                    <button id="cancelFlash" class="btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        dialog.querySelector('.flash-dialog-button-container').appendChild(installButton);
        document.body.appendChild(dialog);
        
        dialog.showModal();
        
        const closeDialog = () => {
            dialog.close();
            dialog.remove();
        };
        
        dialog.querySelector('#closeDialog').addEventListener('click', closeDialog);
        dialog.querySelector('#cancelFlash').addEventListener('click', closeDialog);
        
        // Close on backdrop click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // Listen for flash events
        installButton.addEventListener('state-changed', (e) => {
            this.handleFlashState(e.detail);
        });
    }

    handleFlashState(state) {
        const statusSection = document.getElementById('flashStatus');
        const statusContent = document.getElementById('statusContent');
        
        statusSection.style.display = 'block';
        
        const message = document.createElement('div');
        message.className = 'status-message';
        
        if (state.state === 'error') {
            message.className += ' status-error';
            message.textContent = `Error: ${state.message}`;
        } else if (state.state === 'installed') {
            message.className += ' status-success';
            message.textContent = '✓ Firmware flashed successfully!';
        } else {
            message.textContent = `${state.message || state.state}`;
        }
        
        statusContent.appendChild(message);
        statusContent.scrollTop = statusContent.scrollHeight;
    }

    openChangelogBlade(release, formattedDate) {
        const blade = document.getElementById('changelogBlade');
        const title = document.getElementById('bladeReleaseTitle');
        const tag = document.getElementById('bladeReleaseTag');
        const date = document.getElementById('bladeReleaseDate');
        const changelog = document.getElementById('bladeChangelog');
        
        // Populate blade content
        title.textContent = release.name || release.tag_name;
        tag.textContent = release.tag_name;
        date.textContent = `Released on ${formattedDate}`;
        changelog.innerHTML = this.formatChangelog(release.body || 'No changelog available.', false);
        
        // Show blade with animation
        blade.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Setup close handlers if not already done
        if (!this.bladeHandlersSetup) {
            const closeBtn = document.getElementById('closeBlade');
            const overlay = blade.querySelector('.blade-overlay');
            
            const closeBlade = () => {
                blade.classList.remove('active');
                document.body.style.overflow = '';
            };
            
            closeBtn.addEventListener('click', closeBlade);
            overlay.addEventListener('click', closeBlade);
            
            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && blade.classList.contains('active')) {
                    closeBlade();
                }
            });
            
            this.bladeHandlersSetup = true;
        }
    }

    formatChangelog(text, preview = false) {
        if (!text) return '';
        
        let formatted = text;
        
        if (preview) {
            // For preview, take first 250 chars and find a good break point
            if (text.length > 250) {
                formatted = text.substring(0, 250);
                const lastNewline = formatted.lastIndexOf('\n');
                const lastPeriod = formatted.lastIndexOf('.');
                const breakPoint = Math.max(lastNewline, lastPeriod);
                if (breakPoint > 100) {
                    formatted = formatted.substring(0, breakPoint + 1);
                }
                formatted += '...';
            }
        }
        
        // Escape HTML first
        formatted = this.escapeHtml(formatted);
        
        // Code blocks (```language\ncode\n```)
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });
        
        // Inline code (`code`)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Headers - must be at start of line
        formatted = formatted.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        // Bold and italic
        formatted = formatted.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
        formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
        formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Links [text](url)
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Bullet points (unordered lists)
        formatted = formatted.replace(/^[•\-\*\+] (.+)$/gm, '<li>$1</li>');
        
        // Numbered lists
        formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
        
        // Wrap consecutive list items in ul/ol tags
        formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
            return `<ul>${match}</ul>`;
        });
        
        // Blockquotes
        formatted = formatted.replace(/^&gt;\s*(.+)$/gm, '<blockquote>$1</blockquote>');
        
        // Horizontal rules
        formatted = formatted.replace(/^[-*_]{3,}$/gm, '<hr>');
        
        // Paragraphs - split by double newlines
        const lines = formatted.split('\n');
        let inList = false;
        let inCodeBlock = false;
        let result = [];
        let paragraph = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if we're in a code block
            if (line.includes('<pre>')) inCodeBlock = true;
            if (line.includes('</pre>')) inCodeBlock = false;
            
            // Check if we're in a list
            if (line.includes('<ul>')) inList = true;
            if (line.includes('</ul>')) inList = false;
            
            // Skip if in code block or list
            if (inCodeBlock || inList || line.startsWith('<h') || line.startsWith('<hr') || line.startsWith('<blockquote')) {
                if (paragraph.length > 0) {
                    result.push(`<p>${paragraph.join(' ')}</p>`);
                    paragraph = [];
                }
                result.push(line);
            } else if (line === '') {
                if (paragraph.length > 0) {
                    result.push(`<p>${paragraph.join(' ')}</p>`);
                    paragraph = [];
                }
            } else {
                paragraph.push(line);
            }
        }
        
        // Add remaining paragraph
        if (paragraph.length > 0) {
            result.push(`<p>${paragraph.join(' ')}</p>`);
        }
        
        formatted = result.join('\n');
        
        // Clean up extra whitespace
        formatted = formatted.replace(/\n{3,}/g, '\n\n');
        
        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// Initialize the app when config is loaded
if (typeof ESP_FLASHER_CONFIG !== 'undefined') {
    window.flasher = new ESPFlasher(ESP_FLASHER_CONFIG);
} else {
    console.error('Configuration not loaded. Please check config.js');
}
