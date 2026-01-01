import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.VITE_GEOAPIFY_KEY;

if (!API_KEY) {
    console.error('Error: VITE_GEOAPIFY_KEY not found in .env');
    process.exit(1);
}

const CITIES = {
    bangalore: {
        bounds: { minLat: 12.75, maxLat: 13.15, minLng: 77.4, maxLng: 77.85 }
    }
};

const detectBrand = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('blinkit')) return 'blinkit';
    if (lowerName.includes('zepto')) return 'zepto';
    if (lowerName.includes('instamart') || lowerName.includes('swiggy')) return 'instamart';
    return 'unknown';
};

const parseKML = (content) => {
    const parser = new XMLParser({ ignoreAttributes: false });
    const result = parser.parse(content);
    const stores = [];
    const document = result.kml?.Document;
    if (!document) return [];

    const folders = Array.isArray(document.Folder) ? document.Folder : (document.Folder ? [document.Folder] : []);

    const extract = (placemark, brand) => {
        if (placemark?.Point?.coordinates) {
            const coords = placemark.Point.coordinates.toString().trim().split(',');
            const lng = parseFloat(coords[0]);
            const lat = parseFloat(coords[1]);
            const storeBrand = brand === 'unknown' ? detectBrand(placemark.name || '') : brand;
            if (!isNaN(lat) && !isNaN(lng)) {
                stores.push({ name: placemark.name, lat, lng, brand: storeBrand });
            }
        }
    };

    folders.forEach(f => {
        const brand = detectBrand(f.name || '');
        const placemarks = Array.isArray(f.Placemark) ? f.Placemark : (f.Placemark ? [f.Placemark] : []);
        placemarks.forEach(p => extract(p, brand));
    });

    return stores;
};

async function fetchIsochrone(lat, lng, minutes) {
    const seconds = minutes * 60;
    const url = `https://api.geoapify.com/v1/isoline?lat=${lat}&lon=${lng}&type=time&mode=walk&range=${seconds}&apiKey=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
}

async function run(cityKey, minutes) {
    console.log(`Baking ${cityKey} at ${minutes}m...`);
    const kmlPath = path.join(__dirname, '../public/dark_store.kml');
    const kmlContent = fs.readFileSync(kmlPath, 'utf-8');
    const allStores = parseKML(kmlContent);

    const city = CITIES[cityKey];
    const filtered = allStores.filter(s =>
        s.lat >= city.bounds.minLat && s.lat <= city.bounds.maxLat &&
        s.lng >= city.bounds.minLng && s.lng <= city.bounds.maxLng
    );

    console.log(`Found ${filtered.length} stores. Starting batch...`);

    const results = [];
    const batchSize = 5;

    for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        await Promise.all(batch.map(async (store) => {
            try {
                const isochrone = await fetchIsochrone(store.lat, store.lng, minutes);
                results.push({ store, isochrone });
                console.log(`  ✓ ${store.name}`);
            } catch (e) {
                console.error(`  ✗ ${store.name}: ${e.message}`);
            }
        }));
        if (i + batchSize < filtered.length) await new Promise(r => setTimeout(r, 500));
    }

    const outPath = path.join(__dirname, `../src/data/precomputed/${cityKey}_${minutes}m.json`);
    fs.writeFileSync(outPath, JSON.stringify({
        city: cityKey,
        walkTime: minutes,
        data: results
    }, null, 2));
    console.log(`Saved to ${outPath}`);
}

const minutes = parseInt(process.argv[2]) || 10;
run('bangalore', minutes);
