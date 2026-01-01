const GEOAPIFY_BASE_URL = 'https://api.geoapify.com/v1/isoline';

// Cache for isochrone results
const isochroneCache = new Map();

/**
 * Generate isochrone polygon for a single location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} minutes - Walking time in minutes
 * @param {string} apiKey - Geoapify API key
 * @returns {Promise<Object>} GeoJSON polygon
 */
export async function generateIsochrone(lat, lng, minutes, apiKey) {
    const cacheKey = `${lat},${lng},${minutes}`;

    if (isochroneCache.has(cacheKey)) {
        return isochroneCache.get(cacheKey);
    }

    const seconds = minutes * 60;
    const url = `${GEOAPIFY_BASE_URL}?lat=${lat}&lon=${lng}&type=time&mode=walk&range=${seconds}&apiKey=${apiKey}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        isochroneCache.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Isochrone API error:', error);
        // Return fallback circle if API fails
        return createFallbackCircle(lat, lng, minutes);
    }
}

/**
 * Generate isochrones for multiple stores with rate limiting
 * @param {Array} stores - Array of store objects
 * @param {number} minutes - Walking time in minutes
 * @param {string} apiKey - Geoapify API key
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} Array of isochrone results
 */
export async function batchGenerateIsochrones(stores, minutes, apiKey, onProgress) {
    const results = [];
    const batchSize = 5;
    const delayMs = 200; // Rate limiting

    for (let i = 0; i < stores.length; i += batchSize) {
        const batch = stores.slice(i, i + batchSize);

        const batchResults = await Promise.all(
            batch.map(store =>
                generateIsochrone(store.lat, store.lng, minutes, apiKey)
                    .then(iso => ({ store, isochrone: iso }))
            )
        );

        results.push(...batchResults);

        if (onProgress) {
            onProgress(Math.min(100, Math.round((results.length / stores.length) * 100)));
        }

        // Rate limiting delay
        if (i + batchSize < stores.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return results;
}

/**
 * Create a fallback circle when API is unavailable
 */
function createFallbackCircle(lat, lng, minutes) {
    // Approximate walking speed: 5 km/h = 83.3 m/min
    const radiusMeters = minutes * 83.3;
    const points = 32;
    const coordinates = [];

    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dx = radiusMeters * Math.cos(angle);
        const dy = radiusMeters * Math.sin(angle);

        // Convert meters to degrees (approximate)
        const dLat = dy / 111320;
        const dLng = dx / (111320 * Math.cos(lat * Math.PI / 180));

        coordinates.push([lng + dLng, lat + dLat]);
    }

    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
            },
            properties: {
                mode: 'walk',
                range: { value: minutes * 60, unit: 'seconds' }
            }
        }]
    };
}

/**
 * Clear the isochrone cache
 */
export function clearCache() {
    isochroneCache.clear();
}
