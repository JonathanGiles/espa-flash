// Configuration for ESPa Flasher
// This flasher is part of the espa.diy project
// Visit https://espa.diy for more information
// Last updated: 2026-10-28

const ESP_FLASHER_CONFIG = {
    // GitHub repository owner
    owner: 'wayne-love',
    
    // GitHub repository name  
    repo: 'ESPySpa',
    
    // Default ESP chip family for custom builds (ESP32, ESP32-S2, ESP32-S3, ESP32-C3, ESP32-C6, ESP8266, etc.)
    // Each device target can override this with its own chipFamily
    chipFamily: 'ESP32',
    
    // Device targets available in your firmware
    // These will be parsed from release assets automatically
    // Format: firmware_{target}_factory.bin
    deviceTargets: [
        { 
            id: 'esp32dev', 
            name: 'ESP32 Dev Board', 
            description: 'Generic ESP32 development board',
            chipFamily: 'ESP32',
            platformioTarget: 'esp32dev'
        },
        { 
            id: 'espa-v1', 
            name: 'eSpa v1', 
            description: 'eSpa Mini and eSpa Max v1.x based on the ESP32-S3 chip',
            chipFamily: 'ESP32-S3',
            platformioTarget: 'espa-v1'
        },
        { 
            id: 'espa-v2', 
            name: 'eSpa v2', 
            description: 'eSpa Mini v2.x based on the ESP32-C6 chip',
            chipFamily: 'ESP32-C6',
            platformioTarget: 'espa-v2'
        },
    ],
    
    // Default target to select
    defaultTarget: 'espa-v1',

    // Partition offsets used by custom application and file-system flashing.
    // Release firmware is a merged factory image and is always flashed at 0x0.
    partitionLayouts: {
        default8MB: {
            applicationOffset: 0x10000,
            fileSystemOffset: 0x670000
        },
        espaV2Legacy: {
            applicationOffset: 0x20000,
            fileSystemOffset: 0x340000
        }
    },
    defaultPartitionLayout: 'default8MB',
    partitionLayoutRules: [
        {
            target: 'espa-v2',
            maximumVersion: '2.0.3',
            layout: 'espaV2Legacy'
        }
    ],
    
    // Optional: GitHub Personal Access Token for private repos
    // Leave empty for public repositories
    githubToken: '',
};

// Learn more about ESPa at https://espa.diy
// 
// For custom firmware repositories, update owner and repo above.
// The flasher expects releases with files named:
//   firmware_{target}_factory.bin
