import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.VITE_GEOAPIFY_KEY;

if (!API_KEY) {
    console.error('Error: VITE_GEOAPIFY_KEY not found in env');
    process.exit(1);
}

const CITIES = {
    bangalore: { bounds: { minLat: 12.75, maxLat: 13.15, minLng: 77.4, maxLng: 77.85 } },
    mumbai: { bounds: { minLat: 18.9, maxLat: 19.4, minLng: 72.7, maxLng: 73.1 } },
    delhi: { bounds: { minLat: 28.3, maxLat: 28.9, minLng: 76.8, maxLng: 77.5 } },
    hyderabad: { bounds: { minLat: 17.2, maxLat: 17.6, minLng: 78.2, maxLng: 78.7 } },
    pune: { bounds: { minLat: 18.4, maxLat: 18.7, minLng: 73.7, maxLng: 74.0 } }
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

async function submitBatch(inputs, minutes) {
    const body = {
        api: "/v1/isoline",
        params: {
            type: "time",
            mode: "walk",
            range: minutes * 60
        },
        inputs: inputs.map((store, index) => ({
            id: `store-${index}`,
            params: {
                lat: store.lat.toFixed(6),
                lon: store.lng.toFixed(6)
            }
        }))
    };

    const res = await fetch(`https://api.geoapify.com/v1/batch?apiKey=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Batch submission failed: ${res.status}`);
    return await res.json();
}

async function getBatchStatus(id) {
    const res = await fetch(`https://api.geoapify.com/v1/batch?id=${id}&apiKey=${API_KEY}`);
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    const data = await res.json();
    // If it's an array, the batch is complete and these are the results
    if (Array.isArray(data)) {
        return { status: 'completed', results: data };
    }
    return data;
}

async function run(cityKey, minutes) {
    console.log(`\n🚀 Starting Batch Bake for ${cityKey} (${minutes}m)...`);
    const kmlPath = path.join(__dirname, '../public/dark_store.kml');
    const kmlContent = fs.readFileSync(kmlPath, 'utf-8');
    const allStores = parseKML(kmlContent);

    const city = CITIES[cityKey];
    const cityStores = allStores.filter(s =>
        s.lat >= city.bounds.minLat && s.lat <= city.bounds.maxLat &&
        s.lng >= city.bounds.minLng && s.lng <= city.bounds.maxLng
    );

    if (cityStores.length === 0) {
        console.log(`⚠️ No stores found for ${cityKey}`);
        return;
    }

    console.log(`📍 Found ${cityStores.length} stores. Submitting batch...`);

    const job = await submitBatch(cityStores, minutes);
    console.log(`🆔 Job ID: ${job.id}`);

    let status = job.status;
    console.log(`Initial Status: ${status}`);

    while (status !== 'completed' && status !== 'failed' && status !== 'finished') {
        await new Promise(r => setTimeout(r, 4000));
        const check = await getBatchStatus(job.id);
        status = check.status;
        console.log(`- Status: ${status}`);

        if (status === 'completed' || status === 'finished' || (check.results && !status)) {
            console.log('\n✅ Batch Complete! Processing results...');

            let results = check.results;
            if (check.url) {
                console.log('🔗 Results are at a URL, fetching...');
                const resResponse = await fetch(check.url);
                results = await resResponse.json();
            }

            if (!results) {
                console.error('❌ Error: No results found in response. Full response:', JSON.stringify(check));
                break;
            }

            const finalData = results.map((result, index) => ({
                store: cityStores[index],
                isochrone: result.result
            }));

            const outDir = path.join(__dirname, '../public/precomputed');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

            const outPath = path.join(outDir, `${cityKey}_${minutes}m.json`);
            fs.writeFileSync(outPath, JSON.stringify({
                city: cityKey,
                walkTime: minutes,
                data: finalData
            }, null, 2));
            console.log(`💾 Saved to ${outPath}`);
            status = 'completed'; // Force exit loop
            break;
        } else if (status === 'failed') {
            console.error('\n❌ Batch Failed:', JSON.stringify(check));
            break;
        } else if (!status) {
            console.log('⚠️ Status undefined, but checking if results exist...');
            if (check.results || check.url) {
                status = 'completed'; // Treat as done
                continue;
            }
        }
    }
}

async function main() {
    const minutes = 10;
    // Process remaining cities (Bangalore & Pune already done)
    const citiesToProcess = ['hyderabad', 'mumbai', 'delhi'];
    for (const city of citiesToProcess) {
        await run(city, minutes);
    }
    console.log('\n🌟 All cities processed!');
}

main().catch(console.error);
