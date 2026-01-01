import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually if not present
if (!process.env.VITE_GEOAPIFY_KEY) {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

const API_KEY = process.env.VITE_GEOAPIFY_KEY;

if (!API_KEY) {
    console.error('Error: VITE_GEOAPIFY_KEY not found in env');
    process.exit(1);
}

const SPEED_DATA = {
    bangalore: {
        "Koramangala": 15, "Indiranagar": 16, "HSR Layout": 17, "Jayanagar": 14,
        "MG Road": 12, "Malleshwaram": 15, "Whitefield": 22, "Bellandur": 20,
        "Electronic City": 24, "Sarjapur Road": 18, "Hebbal": 20, "Rajajinagar": 16,
        "Kalyan Nagar": 19, "JP Nagar": 17
    },
    mumbai: {
        "Colaba": 14, "Lower Parel": 18, "Worli": 20, "Bandra West": 17,
        "Juhu": 19, "Andheri East": 21, "Powai": 23, "Goregaon": 20,
        "Borivali": 22, "Chembur": 21, "Vashi": 25
    },
    delhi: {
        "Connaught Place": 15, "Saket": 20, "Hauz Khas": 18, "Greater Kailash": 19,
        "Karol Bagh": 16, "Vasant Kunj": 22, "Dwarka": 24, "Rohini": 21,
        "Gurgaon CyberHub": 20, "Gurgaon Sector 56": 23, "Noida Sector 62": 25
    },
    hyderabad: {
        "Hitech City": 20, "Gachibowli": 22, "Madhapur": 18, "Kondapur": 21,
        "Kukatpally": 19, "Banjara Hills": 17, "Jubilee Hills": 18, "Begumpet": 20,
        "Abids": 14
    },
    pune: {
        "Koregaon Park": 16, "Kalyani Nagar": 18, "Viman Nagar": 19,
        "Hinjewadi Phase 1": 22, "Baner": 19, "Aundh": 20, "Wakad": 21,
        "Kothrud": 17, "Magarpatta": 23, "Hadapsar": 20
    }
};

const CITIES = {
    bangalore: {
        center: [12.9716, 77.5946],
        bounds: { minLat: 12.75, maxLat: 13.15, minLng: 77.4, maxLng: 77.85 },
        areas: [
            { name: "Koramangala", lat: 12.9345, lng: 77.6200 },
            { name: "Indiranagar", lat: 12.9719, lng: 77.6412 },
            { name: "HSR Layout", lat: 12.9116, lng: 77.6389 },
            { name: "Jayanagar", lat: 12.9308, lng: 77.5838 },
            { name: "JP Nagar", lat: 12.9063, lng: 77.5857 },
            { name: "Whitefield", lat: 12.9698, lng: 77.7499 },
            { name: "Malleshwaram", lat: 13.0031, lng: 77.5644 },
            { name: "Bellandur", lat: 12.9256, lng: 77.6762 },
            { name: "Hebbal", lat: 13.0358, lng: 77.5970 },
            { name: "Electronic City", lat: 12.8450, lng: 77.6600 },
            { name: "Sarjapur Road", lat: 12.9089, lng: 77.6869 },
            { name: "MG Road", lat: 12.9758, lng: 77.6096 },
            { name: "Rajajinagar", lat: 12.9815, lng: 77.5530 },
            { name: "Kalyan Nagar", lat: 13.0221, lng: 77.6403 }
        ]
    },
    mumbai: {
        center: [19.0760, 72.8777],
        bounds: { minLat: 18.9, maxLat: 19.4, minLng: 72.7, maxLng: 73.1 },
        areas: [
            { name: "Bandra West", lat: 19.0596, lng: 72.8295 },
            { name: "Juhu", lat: 19.1050, lng: 72.8264 },
            { name: "Andheri East", lat: 19.1136, lng: 72.8697 },
            { name: "Powai", lat: 19.1176, lng: 72.9060 },
            { name: "Lower Parel", lat: 18.9953, lng: 72.8292 },
            { name: "Worli", lat: 19.0176, lng: 72.8166 },
            { name: "Colaba", lat: 18.9067, lng: 72.8147 },
            { name: "Borivali", lat: 19.2307, lng: 72.8567 },
            { name: "Goregaon", lat: 19.1634, lng: 72.8412 },
            { name: "Chembur", lat: 19.0522, lng: 72.9005 },
            { name: "Vashi", lat: 19.0745, lng: 73.0010 }
        ]
    },
    delhi: {
        center: [28.6139, 77.2090],
        bounds: { minLat: 28.3, maxLat: 28.9, minLng: 76.8, maxLng: 77.5 },
        areas: [
            { name: "Connaught Place", lat: 28.6315, lng: 77.2167 },
            { "name": "Saket", "lat": 28.5245, "lng": 77.2100 },
            { "name": "Hauz Khas", "lat": 28.5494, "lng": 77.2001 },
            { "name": "Greater Kailash", "lat": 28.5482, "lng": 77.2341 },
            { "name": "Vasant Kunj", "lat": 28.5293, "lng": 77.1517 },
            { "name": "Dwarka", "lat": 28.5823, "lng": 77.0500 },
            { "name": "Rohini", "lat": 28.7041, "lng": 77.1025 },
            { "name": "Gurgaon CyberHub", "lat": 28.4950, "lng": 77.0878 },
            { "name": "Gurgaon Sector 56", "lat": 28.4230, "lng": 77.1000 },
            { "name": "Noida Sector 62", "lat": 28.6190, "lng": 77.3600 },
            { "name": "Karol Bagh", "lat": 28.6441, "lng": 77.1882 }
        ]
    },
    hyderabad: {
        center: [17.3850, 78.4867],
        bounds: { minLat: 17.2, maxLat: 17.6, minLng: 78.2, maxLng: 78.7 },
        areas: [
            { name: "Gachibowli", lat: 17.4401, lng: 78.3489 },
            { name: "Hitech City", lat: 17.4435, lng: 78.3772 },
            { name: "Kondapur", lat: 17.4622, lng: 78.3568 },
            { name: "Madhapur", lat: 17.4483, lng: 78.3915 },
            { name: "Banjara Hills", lat: 17.4116, lng: 78.4416 },
            { name: "Jubilee Hills", lat: 17.4332, lng: 78.3995 },
            { name: "Begumpet", lat: 17.4375, lng: 78.4482 },
            { name: "Kukatpally", lat: 17.4933, lng: 78.4000 },
            { name: "Abids", lat: 17.3910, lng: 78.4760 }
        ]
    },
    pune: {
        center: [18.5204, 73.8567],
        bounds: { minLat: 18.4, maxLat: 18.7, minLng: 73.7, maxLng: 74.0 },
        areas: [
            { name: "Koregaon Park", lat: 18.5362, lng: 73.8940 },
            { name: "Kalyani Nagar", lat: 18.5463, lng: 73.9033 },
            { name: "Hinjewadi Phase 1", lat: 18.5913, lng: 73.7389 },
            { name: "Viman Nagar", lat: 18.5679, lng: 73.9143 },
            { name: "Baner", lat: 18.5590, lng: 73.7787 },
            { name: "Aundh", lat: 18.5580, lng: 73.8075 },
            { name: "Kothrud", lat: 18.5074, lng: 73.8077 },
            { name: "Magarpatta", lat: 18.5140, lng: 73.9310 },
            { name: "Wakad", lat: 18.5987, lng: 73.7661 },
            { name: "Hadapsar", lat: 18.5089, lng: 73.9259 }
        ]
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

// Calculate closest area speed
function getSpeed(cityKey, lat, lng) {
    const city = CITIES[cityKey];
    let nearestArea = null;
    let minDist = Infinity;

    city.areas.forEach(area => {
        const dist = Math.sqrt(Math.pow(area.lat - lat, 2) + Math.pow(area.lng - lng, 2));
        if (dist < minDist) {
            minDist = dist;
            nearestArea = area.name;
        }
    });

    return SPEED_DATA[cityKey][nearestArea] || 20; // Default 20 if none found
}

async function submitBatch(cityKey, inputs, minutes, mode) {
    const inputsWithParams = inputs.map((store, index) => {
        if (mode === 'walk') {
            return {
                id: `store-${index}`,
                params: {
                    lat: store.lat.toFixed(6),
                    lon: store.lng.toFixed(6)
                }
            };
        } else {
            // Bike mode needs per-store range
            const speedKmh = getSpeed(cityKey, store.lat, store.lng);
            const rangeMeters = Math.round((speedKmh * 1000 / 60) * minutes);
            return {
                id: `store-${index}`,
                params: {
                    lat: store.lat.toFixed(6),
                    lon: store.lng.toFixed(6),
                    range: rangeMeters
                }
            };
        }
    });

    const body = {
        api: "/v1/isoline",
        params: {
            type: mode === 'walk' ? "time" : "distance",
            mode: mode === 'walk' ? "walk" : "motorcycle"
        },
        inputs: inputsWithParams
    };

    // Add shared range for walk mode
    if (mode === 'walk') {
        body.params.range = minutes * 60;
    }

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
    if (Array.isArray(data)) return { status: 'completed', results: data };
    return data;
}

async function run(cityKey, minutes, mode) {
    console.log(`\n🚀 Starting Batch Bake for ${cityKey} [${mode.toUpperCase()}] (${minutes}m)...`);
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

    const job = await submitBatch(cityKey, cityStores, minutes, mode);
    console.log(`🆔 Job ID: ${job.id}`);

    let status = job.status;
    while (status !== 'completed' && status !== 'failed' && status !== 'finished') {
        await new Promise(r => setTimeout(r, 5000));
        const check = await getBatchStatus(job.id);
        status = check.status;
        console.log(`- Status: ${status}`);

        if (status === 'completed' || status === 'finished' || (check.results && !status)) {
            console.log('\n✅ Batch Complete! Processing results...');
            let results = check.results;
            if (check.url) {
                const resResponse = await fetch(check.url);
                results = await resResponse.json();
            }

            const finalData = results.map((result, index) => {
                const geom = result.result.features[0].geometry;

                // Truncate coordinates to 5 decimal places (~1.1m precision) to save space/memory
                if (geom.type === 'Polygon') {
                    geom.coordinates = geom.coordinates.map(ring =>
                        ring.map(coord => [Number(coord[0].toFixed(5)), Number(coord[1].toFixed(5))])
                    );
                } else if (geom.type === 'MultiPolygon') {
                    geom.coordinates = geom.coordinates.map(poly =>
                        poly.map(ring =>
                            ring.map(coord => [Number(coord[0].toFixed(5)), Number(coord[1].toFixed(5))])
                        )
                    );
                }

                return {
                    store: cityStores[index],
                    isochrone: result.result
                };
            });

            const modeSuffix = mode === 'walk' ? '' : `_${mode}`;
            const outPath = path.join(__dirname, `../public/data/precomputed/${cityKey}_${minutes}m${modeSuffix}.json`);
            fs.writeFileSync(outPath, JSON.stringify({
                city: cityKey,
                time: minutes,
                mode: mode,
                data: finalData
            }, null, 2));

            console.log(`💾 Saved to ${outPath}`);
            status = 'completed';
            break;
        }
    }
}

async function main() {
    const minutes = parseInt(process.argv[2]) || 10;
    const mode = process.argv[3] || 'walk';
    const selectedCity = process.argv[4];

    if (selectedCity) {
        await run(selectedCity, minutes, mode);
    } else {
        const citiesToProcess = Object.keys(CITIES);
        for (const city of citiesToProcess) {
            await run(city, minutes, mode);
        }
    }
}

main().catch(console.error);
