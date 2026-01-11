// Configuration for ESPa Flasher
// This flasher is part of the espa.diy project
// Visit https://espa.diy for more information

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
    // Format: firmware_{target}_factory.bin and spiffs_{target}.bin
    deviceTargets: [
        { 
            id: 'esp32dev', 
            name: 'ESP32 Dev Board', 
            description: 'Generic ESP32 development board',
            chipFamily: 'ESP32'
        },
        { 
            id: 'espa-v1', 
            name: 'eSpa v1', 
            description: 'eSpa Mini and eSpa Max v1.x based on the ESP32-S3 chip',
            chipFamily: 'ESP32-S3'
        },
        { 
            id: 'espa-v2', 
            name: 'eSpa v2', 
            description: 'eSpa Mini v2.x based on the ESP32-C6 chip',
            chipFamily: 'ESP32-C6'
        },
    ],
    
    // Default target to select
    defaultTarget: 'espa-v1',
    
    // Optional: GitHub Personal Access Token for private repos
    // Leave empty for public repositories
    githubToken: '',
};

// Learn more about ESPa at https://espa.diy
// 
// For custom firmware repositories, update owner and repo above.
// The flasher expects releases with files named:
//   firmware_{target}_factory.bin
//   spiffs_{target}.bin
