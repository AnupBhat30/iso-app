import { XMLParser } from 'fast-xml-parser';

/**
 * Parse KML file content and extract place coordinates
 * @param {string} kmlContent - Raw KML file content
 * @returns {Array} Array of store objects with lat, lng, name
 */
export function parseKML(kmlContent) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });

    const result = parser.parse(kmlContent);
    const stores = [];

    try {
        const document = result.kml?.Document;
        if (!document) return [];

        // Handle Folders (common in Google My Maps KMLs)
        const folders = Array.isArray(document.Folder) ? document.Folder : (document.Folder ? [document.Folder] : []);

        if (folders.length > 0) {
            folders.forEach(folder => {
                const folderName = folder.name || '';
                const brand = detectBrand(folderName);

                const placemarks = Array.isArray(folder.Placemark) ? folder.Placemark : (folder.Placemark ? [folder.Placemark] : []);

                placemarks.forEach((placemark, index) => {
                    const store = extractStoreData(placemark, brand, stores.length + 1);
                    if (store) stores.push(store);
                });
            });
        } else {
            // Direct Placemarks in Document
            const placemarks = Array.isArray(document.Placemark) ? document.Placemark : (document.Placemark ? [document.Placemark] : []);
            placemarks.forEach((placemark, index) => {
                const store = extractStoreData(placemark, 'unknown', stores.length + 1);
                if (store) stores.push(store);
            });
        }
    } catch (error) {
        console.error('Error parsing KML:', error);
    }

    return stores;
}

/**
 * Helper to extract store data from a placemark
 */
function extractStoreData(placemark, defaultBrand, id) {
    if (placemark?.Point?.coordinates) {
        const coords = placemark.Point.coordinates.toString().trim().split(',');
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);

        if (!isNaN(lat) && !isNaN(lng)) {
            // Try to find brand in name if default is unknown
            const brand = defaultBrand === 'unknown' ? detectBrand(placemark.name || '') : defaultBrand;

            return {
                id,
                name: placemark.name || `Store ${id}`,
                lat,
                lng,
                description: placemark.description || '',
                brand
            };
        }
    }
    return null;
}

/**
 * Detect brand from store name
 */
function detectBrand(name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('blinkit')) return 'blinkit';
    if (lowerName.includes('zepto')) return 'zepto';
    if (lowerName.includes('instamart') || lowerName.includes('swiggy')) return 'instamart';
    return 'unknown';
}

/**
 * Convert stores array to KML format
 */
export function storesToKML(stores) {
    const placemarks = stores.map(store => `
    <Placemark>
      <name>${store.name}</name>
      <description>${store.brand}</description>
      <Point>
        <coordinates>${store.lng},${store.lat},0</coordinates>
      </Point>
    </Placemark>
  `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Dark Stores</name>
    ${placemarks}
  </Document>
</kml>`;
}
