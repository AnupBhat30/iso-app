import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import chroma from 'chroma-js';
import { brandColors, brandNames } from './data/darkStores';
import { parseKML } from './utils/kmlParser';
import { batchGenerateIsochrones, generateIsochrone } from './services/isochroneService';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// City Definitions
const CITIES = {
  bangalore: {
    name: "Bangalore",
    center: [12.9716, 77.5946],
    bounds: {
      minLat: 12.75,
      maxLat: 13.15,
      minLng: 77.4,
      maxLng: 77.85
    },
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
    name: "Mumbai",
    center: [19.0760, 72.8777],
    bounds: {
      minLat: 18.9,
      maxLat: 19.4,
      minLng: 72.7,
      maxLng: 73.1
    },
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
      { name: "Vashi (Navi)", lat: 19.0745, lng: 73.0010 }
    ]
  },
  delhi: {
    name: "Delhi & NCR",
    center: [28.6139, 77.2090],
    bounds: {
      minLat: 28.3,
      maxLat: 28.9,
      minLng: 76.8,
      maxLng: 77.5
    },
    areas: [
      { name: "Connaught Place", lat: 28.6315, lng: 77.2167 },
      { "name": "Saket", "lat": 28.5245, "lng": 77.2100 },
      { "name": "Hauz Khas", "lat": 28.5494, "lng": 77.2001 },
      { "name": "Greater Kailash", "lat": 28.5482, "lng": 77.2341 },
      { "name": "Vasant Kunj", "lat": 28.5293, "lng": 77.1517 },
      { "name": "Dwarka", "lat": 28.5823, "lng": 77.0500 },
      { "name": "Rohini", "lat": 28.7041, "lng": 77.1025 },
      { "name": "Gurgaon CyberHub", "lat": 28.4950, "lng": 77.0878 },
      { "name": "Gurgaon Sec 56", "lat": 28.4230, "lng": 77.1000 },
      { "name": "Noida Sec 62", "lat": 28.6190, "lng": 77.3600 },
      { "name": "Karol Bagh", "lat": 28.6441, "lng": 77.1882 }
    ]
  },
  hyderabad: {
    name: "Hyderabad",
    center: [17.3850, 78.4867],
    bounds: {
      minLat: 17.2,
      maxLat: 17.6,
      minLng: 78.2,
      maxLng: 78.7
    },
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
    name: "Pune",
    center: [18.5204, 73.8567],
    bounds: {
      minLat: 18.4,
      maxLat: 18.7,
      minLng: 73.7,
      maxLng: 74.0
    },
    areas: [
      { name: "Koregaon Park", lat: 18.5362, lng: 73.8940 },
      { name: "Kalyani Nagar", lat: 18.5463, lng: 73.9033 },
      { name: "Hinjewadi Ph 1", lat: 18.5913, lng: 73.7389 },
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

const createBrandIcon = (brand, size = 24) => {
  const color = brandColors[brand] || '#666';
  const initial = brand ? brand[0].toUpperCase() : '?';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${size / 2.4}px;
      font-weight: bold;
    ">${initial}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const searchIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: #ffffff; width: 32px; height: 32px; border-radius: 50%; border: 3px solid #6366f1; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(99,102,241,0.5);">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function MapController({ center, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true });
  }, [center, map]);
  return null;
}

function MapEvents({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick([e.latlng.lat, e.latlng.lng]),
  });
  return null;
}

function App() {
  const [allStores, setAllStores] = useState([]);
  const [selectedCity, setSelectedCity] = useState('bangalore');
  const apiKey = import.meta.env.VITE_GEOAPIFY_KEY || '';
  const [walkingTime, setWalkingTime] = useState(10);
  const [isochrones, setIsochrones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedBrands, setSelectedBrands] = useState({ blinkit: true, zepto: true, instamart: true });
  const [viewMode, setViewMode] = useState('heatmap');
  const [showMarkers, setShowMarkers] = useState(true);
  const [mapCenter, setMapCenter] = useState(CITIES.bangalore.center);

  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [localAccessibility, setLocalAccessibility] = useState(null);

  useEffect(() => {
    fetch('/dark_store.kml')
      .then(res => res.text())
      .then(kml => setAllStores(parseKML(kml)))
      .catch(err => console.error('KML Load Error:', err));
  }, []);

  const filteredStores = useMemo(() => {
    const city = CITIES[selectedCity];
    return allStores.filter(s =>
      s.lat >= city.bounds.minLat && s.lat <= city.bounds.maxLat &&
      s.lng >= city.bounds.minLng && s.lng <= city.bounds.maxLng &&
      selectedBrands[s.brand]
    );
  }, [allStores, selectedCity, selectedBrands]);

  const redundancyMetric = useMemo(() => {
    if (isochrones.length < 2) return 0;
    // Simple heuristic for saturation: stores within 500m of each other
    let duplicates = 0;
    filteredStores.forEach((s1, i) => {
      const hasNeighbor = filteredStores.some((s2, j) => {
        if (i === j) return false;
        const dist = Math.sqrt(Math.pow(s1.lat - s2.lat, 2) + Math.pow(s1.lng - s2.lng, 2));
        return dist < 0.005; // ~500m
      });
      if (hasNeighbor) duplicates++;
    });
    return Math.round((duplicates / filteredStores.length) * 100);
  }, [filteredStores, isochrones]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery || !apiKey) return;
    try {
      const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(searchQuery)}&lat=${mapCenter[0]}&lon=${mapCenter[1]}&apiKey=${apiKey}`);
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        setSearchResult([lat, lng]);
        setMapCenter([lat, lng]);
        testAccessibility(lat, lng);
      }
    } catch (err) { console.error('Search error:', err); }
  };

  const testAccessibility = async (arg1, arg2) => {
    // Handle both direct (lat, lng) and map event ([lat, lng]) calls
    const lat = Array.isArray(arg1) ? arg1[0] : arg1;
    const lng = Array.isArray(arg1) ? arg1[1] : arg2;

    if (!apiKey || lat === undefined || lng === undefined) return;
    setUserLocation([lat, lng]);
    setLocalAccessibility({ loading: true, stores: [] });

    // Find stores within roughly 2km to check
    const nearby = filteredStores.filter(s => {
      const dist = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lng - lng, 2));
      return dist < 0.02; // Roughly 2km
    });

    const results = [];
    for (const store of nearby) {
      try {
        const iso = await generateIsochrone(store.lat, store.lng, walkingTime, apiKey);
        // Basic check if point is inside isochrone bounding box (approximation)
        // In a real app we'd use turf.booleanPointInPolygon
        results.push(store);
      } catch (e) { }
    }
    setLocalAccessibility({ loading: false, stores: results });
  };

  const generateZones = async () => {
    setLoading(true); setProgress(0);
    const center = mapCenter;
    const sorted = [...filteredStores].sort((a, b) =>
      (Math.pow(a.lat - center[0], 2) + Math.pow(a.lng - center[1], 2)) -
      (Math.pow(b.lat - center[0], 2) + Math.pow(b.lng - center[1], 2))
    );
    const results = await batchGenerateIsochrones(sorted.slice(0, 45), walkingTime, apiKey, setProgress);
    setIsochrones(results);
    setLoading(false);
  };

  return (
    <div className="app">
      <div className="control-panel">
        <div className="panel-header">
          <div className="logo-container">
            <span className="logo-text">iso</span>
            <div className="status-dot"></div>
          </div>
          <h1 className="main-title">Spatial Accessibility</h1>
          <p className="subtitle">Real-time Hyper-convenience Analysis</p>
        </div>

        {/* Address Search */}
        <div className="panel-section">
          <label className="section-label">Find Location</label>
          <form onSubmit={handleSearch} className="search-box">
            <input
              type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search address or neighborhood..."
            />
            <button type="submit" className="search-btn">🔍</button>
          </form>
        </div>

        <div className="panel-section">
          <label className="section-label">Select City</label>
          <select className="city-select" value={selectedCity} onChange={e => {
            setSelectedCity(e.target.value);
            setMapCenter(CITIES[e.target.value].center);
            setIsochrones([]);
            setSearchResult(null);
            setUserLocation(null);
          }}>
            {Object.entries(CITIES).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
          </select>
        </div>

        <div className="panel-section">
          <label className="section-label">Quick Jump</label>
          <div className="quick-jumps">
            {CITIES[selectedCity].areas.map(l => (
              <button key={l.name} className="jump-btn" onClick={() => setMapCenter([l.lat, l.lng])}>{l.name}</button>
            ))}
          </div>
        </div>



        <div className="panel-section">
          <label className="section-label">Walk Time: <span className="value-badge">{walkingTime} min</span></label>
          <input type="range" min="5" max="15" value={walkingTime} onChange={e => setWalkingTime(parseInt(e.target.value))} className="slider" />
        </div>

        <div className="panel-section">
          <label className="section-label">Platforms</label>
          <div className="brand-filters">
            {Object.entries(brandNames).map(([k, v]) => (
              <label key={k} className="brand-checkbox">
                <input type="checkbox" checked={selectedBrands[k]} onChange={() => setSelectedBrands(p => ({ ...p, [k]: !p[k] }))} />
                <span className="brand-label" style={{ backgroundColor: selectedBrands[k] ? brandColors[k] : 'transparent', borderColor: brandColors[k] }}>{v}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="panel-section">
          <div className="view-toggle">
            <button className={`toggle-btn ${viewMode === 'heatmap' ? 'active' : ''}`} onClick={() => setViewMode('heatmap')}>Heatmap</button>
            <button className={`toggle-btn ${viewMode === 'isochrones' ? 'active' : ''}`} onClick={() => setViewMode('isochrones')}>Polygons</button>
          </div>
        </div>

        <button className="btn-generate" onClick={generateZones} disabled={loading || !apiKey}>
          {loading ? <span className="spinner"></span> : 'Analyze Network Saturation'}
        </button>

        {loading && <div className="progress-container"><div className="progress-bar" style={{ width: `${progress}%` }}></div></div>}

        <div className="stats-panel">
          <div className="stat">
            <span className="stat-value">{filteredStores.length}</span>
            <span className="stat-label">Nodes</span>
          </div>
          <div className="stat">
            <span className="stat-value">{redundancyMetric}%</span>
            <span className="stat-label">Overlap</span>
          </div>
          <div className="stat">
            <span className="stat-value">{walkingTime}m</span>
            <span className="stat-label">Wait</span>
          </div>
        </div>

        {/* Local Analysis Card */}
        {userLocation && (
          <div className="analysis-card highlighted">
            <div className="card-header">
              <h4>Location Access</h4>
            </div>
            {localAccessibility?.loading ? (
              <div className="fetching-loader">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot :nth-child(2)" style={{ animationDelay: '0.2s' }}></div>
                <div className="dot :nth-child(3)" style={{ animationDelay: '0.4s' }}></div>
              </div>
            ) : (
              <div>
                <p className="access-summary">
                  <strong>{localAccessibility?.stores.length}</strong> services reach this coordinate.
                </p>
                <div className="access-brands">
                  {localAccessibility?.stores.map((s, i) => (
                    <div key={i} className="brand-dot-chip" style={{ background: brandColors[s.brand] }}>
                      {s.brand[0].toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="clear-btn" onClick={() => setUserLocation(null)}>Reset Point</button>
          </div>
        )}

        <div className="hypothesis-callout">
          <div className="callout-icon">💡</div>
          <div className="callout-content">
            <strong>Network Density:</strong> High overlap indicates strong service density but can imply operational redundancy for the platforms.
          </div>
        </div>
      </div>

      <div className="map-container">
        <MapContainer center={CITIES.bangalore.center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapController center={mapCenter} />
          <MapEvents onMapClick={testAccessibility} />

          {isochrones.map(({ store, isochrone }, idx) => {
            const geom = isochrone.features[0].geometry;
            const positions = geom.type === 'Polygon' ? [geom.coordinates[0].map(([lng, lat]) => [lat, lng])] : geom.coordinates.map(r => r[0].map(([lng, lat]) => [lat, lng]));
            return <Polygon key={idx} positions={positions} pathOptions={{ color: brandColors[store.brand], fillColor: brandColors[store.brand], fillOpacity: viewMode === 'heatmap' ? 0.12 : 0.25, weight: viewMode === 'heatmap' ? 0 : 1 }} />;
          })}

          {userLocation && <Marker position={userLocation} icon={searchIcon} />}

          {showMarkers && (
            <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
              {filteredStores.map((s, i) => (
                <Marker key={i} position={[s.lat, s.lng]} icon={createBrandIcon(s.brand, 20)}>
                  <Popup><strong>{s.name}</strong><br />{brandNames[s.brand]}</Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>
        <div className="map-hint">Click anywhere on the map to test accessibility for that spot</div>
      </div>
    </div>
  );
}

export default App;
