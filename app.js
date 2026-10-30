// Main application logic
// Update these values whenever the flasher website is released.
const ESP_FLASHER_RELEASE = Object.freeze({
    version: '1.1.0',
    releasedAt: '2026-10-27T18:58:00+13:00'
});

class ESPFlasher {
    constructor(config) {
        this.config = config;
        this.releases = [];
        this.selectedTarget = config.defaultTarget || (config.deviceTargets && config.deviceTargets[0]?.id) || 'esp32dev';
        this.customChipFamily = null; // null means use target's chip family
        this.customParts = {};
        this.customObjectUrls = [];
        this.releasesPerPage = 6;
        this.releasePage = 1;
        this.hasMoreReleases = true;
        this.hasMoreReleasePages = true;
        this.pendingCompatibleReleases = [];
        this.loadingMoreReleases = false;
        this.init();
    }

    async init() {
        this.setupDeviceSelector();
        this.setupChipFamilySelector();
        this.setupBuildInstructions();
        this.setupSiteReleaseInfo();
        this.setupEventListeners();
        await this.loadReleases();
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
        this.pendingCompatibleReleases = [];
        
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
        this.applyDefaultCustomOffsets();
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
        const partTypes = ['factory', 'application', 'fileSystem'];
        this.customParts = {};

        partTypes.forEach(type => {
            const input = document.getElementById(`${type}File`);
            const offsetInput = document.getElementById(`${type}Offset`);
            if (!input) return;

            input.addEventListener('change', event => this.handleCustomFileSelect(event, type));
            document.querySelector(`[data-clear-part="${type}"]`)?.addEventListener('click', () => {
                this.clearCustomPart(type);
            });
            offsetInput?.addEventListener('input', () => {
                offsetInput.dataset.modified = 'true';
                this.validateCustomParts(false);
            });
        });

        this.applyDefaultCustomOffsets();
        document.getElementById('flashCustomBtn')?.addEventListener('click', () => this.flashCustomBinary());
    }

    handleCustomFileSelect(event, type) {
        const file = event.target.files[0] || null;
        const fileName = document.getElementById(`${type}FileName`);
        const label = event.target.nextElementSibling;

        this.customParts[type] = file;
        if (fileName) fileName.textContent = file ? file.name : this.getCustomFilePlaceholder(type);
        label?.classList.toggle('has-file', Boolean(file));
        const clearButton = document.querySelector(`[data-clear-part="${type}"]`);
        if (clearButton) clearButton.disabled = !file;
        this.validateCustomParts(false);
    }

    clearCustomPart(type) {
        const input = document.getElementById(`${type}File`);
        const fileName = document.getElementById(`${type}FileName`);
        const clearButton = document.querySelector(`[data-clear-part="${type}"]`);

        if (input) {
            input.value = '';
            input.nextElementSibling?.classList.remove('has-file');
        }
        this.customParts[type] = null;
        if (fileName) fileName.textContent = this.getCustomFilePlaceholder(type);
        if (clearButton) clearButton.disabled = true;
        this.validateCustomParts(false);
    }

    clearCustomFirmwareSelection() {
        ['factory', 'application', 'fileSystem'].forEach(type => this.clearCustomPart(type));
        this.revokeCustomObjectUrls();
        this.applyDefaultCustomOffsets();
    }

    getCustomFilePlaceholder(type) {
        return {
            factory: 'Choose factory.bin file',
            application: 'Choose firmware.bin file',
            fileSystem: 'Choose filesystem.bin file'
        }[type];
    }

    parseVersion(version) {
        const match = String(version || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i);
        return match ? match.slice(1).map(Number) : null;
    }

    compareVersions(left, right) {
        const a = this.parseVersion(left);
        const b = this.parseVersion(right);
        if (!a || !b) return null;
        for (let i = 0; i < 3; i++) {
            if (a[i] !== b[i]) return a[i] - b[i];
        }
        return 0;
    }

    getPartitionLayout() {
        const layouts = this.config.partitionLayouts || {};
        const defaultName = this.config.defaultPartitionLayout;

        return layouts[defaultName] || {
            applicationOffset: 0x10000,
            fileSystemOffset: 0x670000
        };
    }

    applyDefaultCustomOffsets() {
        const layout = this.getPartitionLayout();
        const defaults = {
            factory: 0x0,
            application: layout.applicationOffset,
            fileSystem: layout.fileSystemOffset
        };

        Object.entries(defaults).forEach(([type, offset]) => {
            const input = document.getElementById(`${type}Offset`);
            if (input && input.dataset.modified !== 'true') {
                input.value = `0x${offset.toString(16).toUpperCase()}`;
            }
        });
    }

    parseOffset(value) {
        const text = String(value || '').trim();
        if (!/^(?:0x[0-9a-f]+|\d+)$/i.test(text)) return null;
        const offset = Number.parseInt(text, text.toLowerCase().startsWith('0x') ? 16 : 10);
        return Number.isSafeInteger(offset) && offset >= 0 ? offset : null;
    }

    validateCustomParts(showError = true) {
        const selected = Object.entries(this.customParts).filter(([, file]) => Boolean(file));
        let error = '';

        if (!selected.length) {
            error = 'Select at least one binary file.';
        } else if (this.customParts.factory && selected.length > 1) {
            error = 'A factory image must be flashed by itself.';
        }

        const offsets = new Set();
        if (!error) {
            for (const [type] of selected) {
                const offset = this.parseOffset(document.getElementById(`${type}Offset`)?.value);
                if (offset === null) {
                    error = `Enter a valid offset for ${type}.`;
                    break;
                }
                if (type === 'factory' && offset !== 0) {
                    error = 'The factory offset must be 0x0.';
                    break;
                }
                if (offsets.has(offset)) {
                    error = 'Each selected binary must use a different offset.';
                    break;
                }
                offsets.add(offset);
            }
        }

        const errorElement = document.getElementById('customValidationError');
        if (errorElement) {
            errorElement.textContent = error;
            errorElement.style.display = showError && error ? 'flex' : 'none';
        }
        const button = document.getElementById('flashCustomBtn');
        if (button) button.disabled = Boolean(error);
        return !error;
    }

    async flashCustomBinary() {
        if (!this.validateCustomParts(true)) return;
        this.revokeCustomObjectUrls();

        const parts = [];
        for (const [type, file] of Object.entries(this.customParts)) {
            if (!file) continue;
            const data = await this.readFileAsArrayBuffer(file);
            const url = URL.createObjectURL(new Blob([data]));
            this.customObjectUrls.push(url);
            parts.push({
                path: url,
                offset: this.parseOffset(document.getElementById(`${type}Offset`).value),
                type
            });
        }

        const manifest = this.buildManifest({
            name: 'Custom Firmware',
            version: 'custom',
            parts: parts.map(({ path, offset }) => ({ path, offset }))
        });
        this.showFlashDialog(manifest, { parts });
    }

    revokeCustomObjectUrls() {
        this.customObjectUrls.forEach(url => URL.revokeObjectURL(url));
        this.customObjectUrls = [];
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

    setupSiteReleaseInfo() {
        const releaseInfo = document.getElementById('siteReleaseInfo');
        const release = ESP_FLASHER_RELEASE;
        if (!releaseInfo || !release?.version) return;

        const releasedAt = release.releasedAt ? new Date(release.releasedAt) : null;
        const hasValidDate = releasedAt && !Number.isNaN(releasedAt.getTime());
        const formattedDate = hasValidDate
            ? releasedAt.toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
            })
            : null;

        releaseInfo.textContent = formattedDate
            ? `Flasher v${release.version} | Released ${formattedDate}`
            : `Flasher v${release.version}`;
        releaseInfo.hidden = false;
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

    async fetchReleasePage(page) {
        const headers = this.config.githubToken
            ? { Authorization: `Bearer ${this.config.githubToken}` }
            : {};
        const response = await fetch(
            `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/releases` +
            `?per_page=${this.releasesPerPage}&page=${page}`,
            { headers }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const releases = await response.json();
        return {
            releases,
            hasMore: releases.length === this.releasesPerPage
        };
    }

    async loadReleaseBatch() {
        const compatibleReleases = [];

        compatibleReleases.push(...this.pendingCompatibleReleases.splice(0, this.releasesPerPage));

        // A GitHub page can contain releases that do not have a factory image
        // for the selected target. Continue requesting pages until six cards can
        // be displayed, or GitHub indicates that there are no more releases.
        while (compatibleReleases.length < this.releasesPerPage && this.hasMoreReleasePages) {
            const result = await this.fetchReleasePage(this.releasePage);
            this.releasePage += 1;
            this.hasMoreReleasePages = result.hasMore;
            this.releases.push(...result.releases);

            result.releases.forEach(release => {
                if (this.getTargetAsset(release, this.selectedTarget)) {
                    if (compatibleReleases.length < this.releasesPerPage) {
                    compatibleReleases.push(release);
                    } else {
                        this.pendingCompatibleReleases.push(release);
                    }
                }
            });
        }

        this.hasMoreReleases = this.hasMoreReleasePages || this.pendingCompatibleReleases.length > 0;
        return compatibleReleases;
    }

    async loadReleases() {
        const loadingEl = document.getElementById('loadingReleases');
        const containerEl = document.getElementById('releasesContainer');
        const noReleasesEl = document.getElementById('noReleases');
        const loadMoreContainer = document.getElementById('loadMoreContainer');

        if (!loadingEl || !containerEl || !noReleasesEl) {
            console.error('Release-list elements are missing from the page.');
            return;
        }

        loadingEl.style.display = 'flex';
        containerEl.style.display = 'none';
        noReleasesEl.style.display = 'none';
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';

        this.releasePage = 1;
        this.hasMoreReleases = true;
        this.hasMoreReleasePages = true;
        this.pendingCompatibleReleases = [];
        this.releases = [];

        try {
            const releases = await this.loadReleaseBatch();
            loadingEl.style.display = 'none';

            if (releases.length === 0) {
                noReleasesEl.style.display = 'flex';
            } else {
                containerEl.style.display = 'grid';
                this.renderReleases(releases, false);
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
        const noReleasesEl = document.getElementById('noReleases');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (!container) return;

        if (!append) container.innerHTML = '';

        let isFirstStableRelease = !append;
        releases.forEach(release => {
            const releaseCard = this.createReleaseCard(release, isFirstStableRelease);
            if (!releaseCard) return;

            container.appendChild(releaseCard);
            if (!release.prerelease && isFirstStableRelease) {
                isFirstStableRelease = false;
            }
        });

        const hasRenderedReleases = container.children.length > 0;
        container.style.display = hasRenderedReleases ? 'grid' : 'none';
        if (noReleasesEl) noReleasesEl.style.display = hasRenderedReleases ? 'none' : 'flex';

        if (loadMoreContainer) {
            loadMoreContainer.style.display = this.hasMoreReleases ? 'flex' : 'none';
        }
    }

    async loadMoreReleases() {
        if (this.loadingMoreReleases || !this.hasMoreReleases) return;

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        this.loadingMoreReleases = true;
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }

        try {
            const releases = await this.loadReleaseBatch();
            this.renderReleases(releases, true);
        } catch (error) {
            console.error('Error loading more releases:', error);
            alert(`Unable to load more releases: ${error.message}`);
        } finally {
            this.loadingMoreReleases = false;
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Load More Releases';
            }
        }
    }

    getTargetAsset(release, target) {
        // Release flashing requires a merged factory image at offset 0x0.
        // Handle the legacy target name used by older eSpa v1 releases.
        const targetNames = target === 'espa-v1'
            ? [target, 'spa-control-pcb']
            : [target];

        for (const targetName of targetNames) {
            const escapedTarget = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const patterns = [
                new RegExp(`^firmware[_-]${escapedTarget}[_-]factory\\.bin$`, 'i'),
                new RegExp(`^firmware[_-]${escapedTarget}[_-].*factory.*\\.bin$`, 'i')
            ];

            for (const pattern of patterns) {
                const asset = release.assets.find(candidate => pattern.test(candidate.name));
                if (asset) return asset;
            }
        }

        return null;
    }

    createReleaseCard(release, isFirstStable = false) {
        const card = document.createElement('div');
        card.className = 'release-card';

        const date = new Date(release.published_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Get assets for selected target
        const firmware = this.getTargetAsset(release, this.selectedTarget);
        
        // Skip this release if no firmware for selected target
        if (!firmware) {
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
        const firmware = this.getTargetAsset(release, this.selectedTarget);
        
        if (!firmware) {
            alert('No firmware file found for the selected target.');
            return;
        }
        
        // Create manifest for flashing
        await this.createAndFlashManifest(release, firmware);
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

    async createAndFlashManifest(release, firmware) {
        const baseUrl = window.location.origin;
        const proxiedUrl = `${baseUrl}/proxy?url=${encodeURIComponent(firmware.browser_download_url)}`;
        const manifest = this.buildManifest({
            name: `${release.name || release.tag_name} - ${this.selectedTarget}${this.customChipFamily ? ' (Custom)' : ''}`,
            version: release.tag_name,
            parts: [{ path: proxiedUrl, offset: 0x0 }]
        });

        console.log('Created release manifest:', manifest);
        this.showFlashDialog(manifest);
    }

    buildManifest({ name, version, parts }) {
        return {
            name,
            version,
            home_assistant_domain: 'esphome',
            new_install_prompt_erase: true,
            builds: [{
                chipFamily: this.getCurrentChipFamily(),
                parts
            }]
        };
    }

    restorePageInteraction() {
        document.body.style.removeProperty('overflow');
        document.documentElement.style.removeProperty('overflow');
    }

    cleanupNativeInstaller(observer = null, { revokeUrls = true } = {}) {
        observer?.disconnect();
        this.nativeInstallHost?.remove();
        this.nativeInstallHost = null;
        if (revokeUrls) this.revokeCustomObjectUrls();
        this.restorePageInteraction();
    }

    showFlashDialog(manifest, context = {}) {
        // ESP Web Tools owns the complete modal workflow. The site creates only
        // a temporary install button and cleans it up when the native dialog
        // emits its public `closed` event.
        // Remove any stale installer host, but keep the object URLs belonging
        // to this manifest alive until ESP Web Tools closes its dialog.
        this.cleanupNativeInstaller(null, { revokeUrls: false });
        this.currentManifest = manifest;

        const installButton = document.createElement('esp-web-install-button');
        const manifestJson = JSON.stringify(manifest);
        installButton.manifest =
            'data:application/json;charset=utf-8,' + encodeURIComponent(manifestJson);
        installButton.setAttribute('erase-first', 'true');

        const activateButton = document.createElement('button');
        activateButton.type = 'button';
        activateButton.slot = 'activate';
        activateButton.textContent = 'Connect & Flash';
        installButton.appendChild(activateButton);

        const host = document.createElement('div');
        host.hidden = true;
        host.appendChild(installButton);
        document.body.appendChild(host);
        this.nativeInstallHost = host;

        const observer = new MutationObserver(() => {
            const espDialog = document.querySelector('ewt-install-dialog');
            if (!espDialog) return;

            observer.disconnect();
            espDialog.addEventListener('closed', () => {
                if (context.parts) {
                    // The public ESP Web Tools lifecycle does not expose whether
                    // the dialog closed after success, failure, or cancellation.
                    // Clear custom selections whenever that workflow closes so
                    // a local binary is never left armed for an accidental reflash.
                    this.clearCustomFirmwareSelection();
                }
                this.cleanupNativeInstaller();
            }, { once: true });
        });
        observer.observe(document.body, { childList: true });

        // Keep this synchronous with the user's Flash click so Web Serial retains
        // the required user activation.
        activateButton.click();
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
        const chipInfoSection = dialog.querySelector('#chipInfoSection');
        const viewLogsBtn = dialog.querySelector('#viewLogsBtn');
        
        // Show chip info and logs button when connected
        if (state.state === 'initializing' && installButton.info) {
            const info = installButton.info;
            
            if (chipInfoSection) {
                chipInfoSection.style.display = 'block';
                const chipType = dialog.querySelector('#chipType');
                const chipMac = dialog.querySelector('#chipMac');
                const chipFlash = dialog.querySelector('#chipFlash');
                
                if (chipType && info.chipFamily) chipType.textContent = info.chipFamily;
                if (chipMac && info.macAddress) chipMac.textContent = this.formatMacAddress(info.macAddress);
                if (chipFlash && info.flashSize) chipFlash.textContent = this.formatFlashSize(info.flashSize);
            }
            
            // Show logs button once connected
            if (viewLogsBtn) viewLogsBtn.style.display = 'block';
        }
        
        // Map states to user-friendly messages
        const stateMessages = {
            'initializing': 'Connecting to device...',
            'preparing': 'Preparing firmware files...',
            'erasing': 'Erasing flash memory (this may take a minute)...',
            'writing': 'Writing firmware to device...',
            'manifest': 'Loading firmware manifest...',
        };
        
        if (state.state === 'error') {
            if (description) description.style.display = 'none';
            if (progressDiv) {
                progressDiv.style.display = 'block';
                progressDiv.innerHTML = `
                    <div class="progress-error">
                        <i class="fas fa-exclamation-circle"></i>
                        <strong>Flash Failed</strong>
                        <p>${state.message || 'An error occurred during flashing'}</p>
                    </div>
                `;
            }
            if (footer) footer.style.display = 'flex';
            if (cancelBtn) cancelBtn.textContent = 'Close';
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
                const buttonContainer = footer.querySelector('#flashButtonContainer');
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
                } else if (state.details?.toLowerCase().includes('filesystem') || state.details?.toLowerCase().includes('spiffs')) {
                    if (progressMessage) progressMessage.textContent = '💾 Writing file system...';
                }
            }
        }
    }    
    formatMacAddress(mac) {
        if (!mac) return '-';
        // Format MAC address with colons
        return mac.match(/.{1,2}/g)?.join(':').toUpperCase() || mac;
    }
    
    formatFlashSize(size) {
        if (!size) return '-';
        // Convert bytes to MB
        const mb = size / (1024 * 1024);
        return `${mb.toFixed(0)} MB`;
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
