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
        this.setupBuildInstructions();
        await this.loadReleases();
        this.setupEventListeners();
    }

    setupDeviceSelector() {
        const selectContainer = document.getElementById('deviceTargetSelect');
        const trigger = document.getElementById('deviceTargetTrigger');
        const dropdown = document.getElementById('deviceTargetDropdown');
        
        if (!selectContainer || !trigger || !dropdown || !this.config.deviceTargets) return;
        
        // Populate custom dropdown options
        this.config.deviceTargets.forEach((target, index) => {
            const option = document.createElement('div');
            option.className = 'custom-select-option';
            option.dataset.value = target.id;
            
            const title = document.createElement('div');
            title.className = 'option-title';
            title.textContent = target.name;
            
            const description = document.createElement('div');
            description.className = 'option-description';
            description.textContent = target.description || '';
            
            option.appendChild(title);
            if (target.description) {
                option.appendChild(description);
            }
            
            if (target.id === this.selectedTarget) {
                option.classList.add('selected');
                this.updateTriggerDisplay(target);
            }
            
            option.addEventListener('click', () => {
                this.selectDevice(target);
                selectContainer.classList.remove('active');
            });
            
            dropdown.appendChild(option);
        });
        
        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            selectContainer.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!selectContainer.contains(e.target)) {
                selectContainer.classList.remove('active');
            }
        });
        
        this.updateChipFamilyVisibility();
    }
    
    updateTriggerDisplay(target) {
        const trigger = document.getElementById('deviceTargetTrigger');
        if (!trigger) return;
        
        const titleEl = trigger.querySelector('.select-title');
        const descEl = trigger.querySelector('.select-description');
        
        if (titleEl) titleEl.textContent = target.name;
        if (descEl) descEl.textContent = target.description || '';
    }
    
    selectDevice(target) {
        this.selectedTarget = target.id;
        
        // Update selected state in dropdown
        const dropdown = document.getElementById('deviceTargetDropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.value === target.id) {
                    opt.classList.add('selected');
                }
            });
        }
        
        // Update trigger display
        this.updateTriggerDisplay(target);
        
        // Update other parts of the UI
        this.updateChipFamilyVisibility();
        this.renderReleases(this.releases);
        
        // Update build instructions
        const selectedDevice = this.config.deviceTargets?.find(t => t.id === this.selectedTarget);
        if (selectedDevice && selectedDevice.platformioTarget) {
            this.updateBuildInstructions(selectedDevice.platformioTarget);
        }
    }

    setupChipFamilySelector() {
        const chipFamilySelect = document.getElementById('chipFamilySelect');
        
        if (!chipFamilySelect) return;
        
        // Listen for chip family changes
        chipFamilySelect.addEventListener('change', (e) => {
            this.customChipFamily = e.target.value;
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

    updateChipFamilyVisibility() {
        const chipFamilySection = document.getElementById('chipFamilySection');
        const chipFamilySelect = document.getElementById('chipFamilySelect');
        
        if (!chipFamilySection) return;
        
        // Only show chip family selection for generic esp32dev board
        const isGenericBoard = this.selectedTarget === 'esp32dev';
        chipFamilySection.style.display = isGenericBoard ? 'flex' : 'none';
        
        if (isGenericBoard) {
            // Set chip family from select or use default
            if (chipFamilySelect && chipFamilySelect.value) {
                this.customChipFamily = chipFamilySelect.value;
            } else {
                this.customChipFamily = 'ESP32';
            }
        } else {
            // For specific hardware, use the device's chip family
            this.customChipFamily = null;
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

        // Custom binary upload
        this.setupCustomBinaryUpload();

        // Tab navigation
        this.setupTabs();
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                
                // Update active button
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update active panel
                tabPanels.forEach(panel => {
                    panel.classList.remove('active');
                    if (panel.id === `tab-${tabId}`) {
                        panel.classList.add('active');
                    }
                });
            });
        });
    }

    setupCustomBinaryUpload() {
        this.firmwareFile = null;
        this.spiffsFile = null;

        const firmwareInput = document.getElementById('firmwareFile');
        const spiffsInput = document.getElementById('spiffsFile');
        const flashCustomBtn = document.getElementById('flashCustomBtn');

        if (firmwareInput) {
            firmwareInput.addEventListener('change', (e) => {
                this.handleFileSelect(e, 'firmware');
            });
        }

        if (spiffsInput) {
            spiffsInput.addEventListener('change', (e) => {
                this.handleFileSelect(e, 'spiffs');
            });
        }

        if (flashCustomBtn) {
            flashCustomBtn.addEventListener('click', () => {
                this.flashCustomBinary();
            });
        }
    }

    handleFileSelect(event, type) {
        const file = event.target.files[0];
        const fileNameSpan = document.getElementById(`${type}FileName`);
        const fileLabel = event.target.nextElementSibling;
        
        if (file) {
            if (type === 'firmware') {
                this.firmwareFile = file;
            } else {
                this.spiffsFile = file;
            }
            
            if (fileNameSpan) {
                fileNameSpan.textContent = file.name;
            }
            
            if (fileLabel) {
                fileLabel.classList.add('has-file');
            }
        }

        // Enable flash button if firmware is selected
        const flashCustomBtn = document.getElementById('flashCustomBtn');
        if (flashCustomBtn) {
            flashCustomBtn.disabled = !this.firmwareFile;
        }
    }

    async flashCustomBinary() {
        if (!this.firmwareFile) {
            alert('Please select a firmware file');
            return;
        }

        const files = [];
        
        // Read firmware file
        const firmwareData = await this.readFileAsArrayBuffer(this.firmwareFile);
        files.push({
            data: firmwareData,
            address: 0x0
        });

        // Read SPIFFS file if provided
        if (this.spiffsFile) {
            const spiffsData = await this.readFileAsArrayBuffer(this.spiffsFile);
            files.push({
                data: spiffsData,
                address: 0x290000
            });
        }

        // Get chip family
        const chipFamily = this.customChipFamily || this.getCurrentChipFamily();

        // Create manifest for ESP Web Tools
        const manifest = {
            name: "Custom Firmware",
            version: "custom",
            home_assistant_domain: "esphome",
            new_install_prompt_erase: true,
            builds: [{
                chipFamily: chipFamily,
                parts: files.map(f => ({
                    path: URL.createObjectURL(new Blob([f.data])),
                    offset: f.address
                }))
            }]
        };

        this.showFlashDialog(manifest);
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    updateBuildInstructions(target) {
        const buildTargetName = document.getElementById('buildTargetName');
        const buildTargetName2 = document.getElementById('buildTargetName2');
        const buildTargetName3 = document.getElementById('buildTargetName3');
        const buildTargetName4 = document.getElementById('buildTargetName4');
        const buildTargetPath = document.getElementById('buildTargetPath');
        const currentBuildTarget = document.getElementById('currentBuildTarget');
        
        if (buildTargetName) buildTargetName.textContent = target;
        if (buildTargetName2) buildTargetName2.textContent = target;
        if (buildTargetName3) buildTargetName3.textContent = target;
        if (buildTargetName4) buildTargetName4.textContent = target;
        if (buildTargetPath) buildTargetPath.textContent = target;
        if (currentBuildTarget) currentBuildTarget.textContent = target;
    }

    setupBuildInstructions() {
        const repoUrl = document.getElementById('repoUrl');
        const repoName = document.getElementById('repoName');
        
        if (repoUrl && this.config.owner && this.config.repo) {
            repoUrl.textContent = `https://github.com/${this.config.owner}/${this.config.repo}.git`;
        }
        
        if (repoName && this.config.repo) {
            repoName.textContent = this.config.repo;
        }
        
        // Set initial build target from selected device
        const selectedDevice = this.config.deviceTargets?.find(t => t.id === this.selectedTarget);
        if (selectedDevice && selectedDevice.platformioTarget) {
            this.updateBuildInstructions(selectedDevice.platformioTarget);
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
                <div class="flash-progress" id="flashProgress" style="display: none;">
                    <div class="progress-header">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span id="progressMessage">Preparing...</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progressBar"></div>
                    </div>
                    <div class="progress-details" id="progressDetails"></div>
                </div>
                <div class="flash-success" id="flashSuccess" style="display: none;">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h3>Flash Complete!</h3>
                    <p>Your device has been successfully flashed.</p>
                    <div class="success-actions">
                        <button id="openConsole" class="btn-secondary">
                            <i class="fas fa-terminal"></i>
                            View Console & Logs
                        </button>
                    </div>
                </div>
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
        
        // Console button
        dialog.querySelector('#openConsole')?.addEventListener('click', () => {
            installButton.openLogsDialog();
        });
        
        // Close on backdrop click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });

        // Listen for flash events
        installButton.addEventListener('state-changed', (e) => {
            this.handleFlashState(e.detail, dialog, installButton);
        });
    }

    handleFlashState(state, dialog, installButton) {
        const progressDiv = dialog.querySelector('#flashProgress');
        const successDiv = dialog.querySelector('#flashSuccess');
        const progressMessage = dialog.querySelector('#progressMessage');
        const progressBar = dialog.querySelector('#progressBar');
        const progressDetails = dialog.querySelector('#progressDetails');
        const description = dialog.querySelector('.flash-dialog-description');
        const footer = dialog.querySelector('.flash-dialog-footer');
        const cancelBtn = dialog.querySelector('#cancelFlash');
        
        // Map states to user-friendly messages
        const stateMessages = {
            'initializing': 'Connecting to device...',
            'preparing': 'Preparing firmware files...',
            'erasing': 'Erasing flash memory...',
            'writing': 'Writing firmware to device...',
            'manifest': 'Loading firmware manifest...',
        };
        
        if (state.state === 'error') {
            if (progressDiv) {
                progressDiv.innerHTML = `
                    <div class="progress-error">
                        <i class="fas fa-exclamation-circle"></i>
                        <strong>Flash Failed</strong>
                        <p>${state.message || 'An error occurred during flashing'}</p>
                    </div>
                `;
            }
        } else if (state.state === 'installed') {
            // Hide progress, show success
            if (progressDiv) progressDiv.style.display = 'none';
            if (successDiv) {
                successDiv.style.display = 'block';
                // Update console button to actually work
                const consoleBtn = dialog.querySelector('#openConsole');
                if (consoleBtn && installButton) {
                    consoleBtn.onclick = () => {
                        if (typeof installButton.openLogsDialog === 'function') {
                            installButton.openLogsDialog();
                        }
                    };
                }
            }
            if (cancelBtn) {
                cancelBtn.textContent = 'Close';
            }
        } else {
            // Show progress
            if (description) description.style.display = 'none';
            if (progressDiv) progressDiv.style.display = 'block';
            if (footer) {
                const buttonContainer = footer.querySelector('.flash-dialog-button-container');
                if (buttonContainer) buttonContainer.style.display = 'none';
            }
            
            // Update message
            const message = stateMessages[state.state] || state.message || 'Processing...';
            if (progressMessage) progressMessage.textContent = message;
            
            // Update progress bar if percentage available
            if (state.percentage !== undefined && progressBar) {
                progressBar.style.width = `${state.percentage}%`;
            }
            
            // Add detailed status
            if (progressDetails && state.details) {
                progressDetails.textContent = state.details;
            }
            
            // Custom messages for different parts being written
            if (state.state === 'writing') {
                if (state.details?.includes('0x0') || state.details?.includes('firmware')) {
                    if (progressMessage) progressMessage.textContent = '📦 Writing firmware binary...';
                } else if (state.details?.includes('0x290000') || state.details?.includes('spiffs')) {
                    if (progressMessage) progressMessage.textContent = '💾 Writing filesystem (SPIFFS)...';
                }
            }
        }
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
