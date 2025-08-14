let videoStream, mediaRecorder, recordedChunks = [];
let trackWatchId = null;
let trackPoints = []; // {lat, lon, ele?, time}
let map, mapMarker;

// Initialize camera
async function initCamera() {
  const constraints = {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      facingMode: { ideal: "environment" }
    },
    audio: true
  };
  try {
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    // fallback if environment not available
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { width:1280, height:720 }, audio: true });
  }
  const videoEl = document.getElementById('camVideo');
  videoEl.srcObject = videoStream;
}

// Initialize mini Leaflet map
function initMap() {
  // Try to center map on current position at start
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 16);
      if (!mapMarker) {
        mapMarker = L.marker([latitude, longitude]).addTo(map);
      }
    });
  }

  map = L.map('miniMap', { zoomControl: false, attributionControl: false }).setView([0,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
}

// Start/Stop recording (video)
function startRecording() {
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(videoStream, { mimeType: 'video/webm; codecs=vp9' });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rotograma_${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };
  mediaRecorder.start();
  document.getElementById('startRecBtn').disabled = true;
  document.getElementById('stopRecBtn').disabled = false;
  setRecStatus();
  startTrack(); // also start GPS track
}
function stopRecording() {
  try { mediaRecorder.stop(); } catch {}
  document.getElementById('startRecBtn').disabled = false;
  document.getElementById('stopRecBtn').disabled = true;
  setRecStatus();
  stopTrack(); // stop GPS track (user can still export)
}
function setRecStatus() {
  const el = document.getElementById('recStatus');
  const rec = mediaRecorder && mediaRecorder.state === 'recording' ? 'gravando' : 'parado';
  el.textContent = `Vídeo: ${rec} • Trilhas: ${trackPoints.length} pts`;
}

// Capture photo including inset map
async function capturePhotoWithMap() {
  const video = document.getElementById('camVideo');
  const w = video.videoWidth || 1920;
  const h = video.videoHeight || 1080;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 1) draw current video frame
  ctx.drawImage(video, 0, 0, w, h);

  // 2) render #miniMap DOM to a canvas with html2canvas
  const mapWrap = document.getElementById('miniMapWrap');
  // Temporarily scale the overlay map for correct resolution on the final image
  const mapCanvas = await html2canvas(mapWrap, { backgroundColor: null, useCORS: true, scale: 2 });

  // 3) choose position for the inset (bottom-right)
  const insetW = Math.floor(w * 0.25);
  const insetH = Math.floor(insetW); // square
  const pad = Math.floor(w * 0.02);
  const x = w - insetW - pad;
  const y = h - insetH - pad;

  // Draw rounded rect background for better readability
  const radius = Math.floor(insetW * 0.06);
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, x-6, y-6, insetW+12, insetH+12, radius);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.restore();

  // 4) draw the map snapshot into our main canvas
  ctx.drawImage(mapCanvas, 0, 0, mapCanvas.width, mapCanvas.height, x, y, insetW, insetH);

  // 5) draw logo watermark
  const logoImg = document.getElementById('logoWatermark');
  ctx.drawImage(logoImg, (w - logoImg.width)/2, pad, logoImg.width, logoImg.height);

  // 6) add watermark text
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.font = `${Math.floor(w*0.02)}px sans-serif`;
  const ts = new Date().toLocaleString();
  ctx.fillText(`Rotograma • ${ts}`, pad, h - pad);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  // add to tray quick preview
  const img = document.createElement('img');
  img.className = 'thumb';
  img.src = dataUrl;
  document.getElementById('tray').prepend(img);

  // Offer download
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `captura_${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`;
  a.click();
}

// helper to draw rounded rect
function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

// GPS track (watchPosition)
function startTrack() {
  if (!('geolocation' in navigator)) {
    updateGpsStatus('GPS não suportado.');
    return;
  }
  trackPoints = [];
  if (trackWatchId) navigator.geolocation.clearWatch(trackWatchId);
  trackWatchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, altitude } = pos.coords;
      const time = new Date(pos.timestamp).toISOString();
      trackPoints.push({ lat: latitude, lon: longitude, ele: altitude || 0, time });
      updateGpsStatus(`GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} • pts: ${trackPoints.length}`);
      setRecStatus();
      updateMap(latitude, longitude);
    },
    err => updateGpsStatus('GPS erro: ' + err.message),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}
function stopTrack() {
  if (trackWatchId) {
    navigator.geolocation.clearWatch(trackWatchId);
    trackWatchId = null;
  }
  updateGpsStatus(`GPS pausado • pts: ${trackPoints.length}`);
}
function updateGpsStatus(text) {
  const el = document.getElementById('gpsStatus');
  el.textContent = text;
}
function updateMap(lat, lon) {
  if (!map) return;
  const latlng = [lat, lon];
  map.setView(latlng, Math.max(map.getZoom(), 15));
  if (!mapMarker) {
    mapMarker = L.marker(latlng).addTo(map);
  } else {
    mapMarker.setLatLng(latlng);
  }
}

// Export GPX
function exportGPX() {
  if (!trackPoints.length) {
    alert('Sem pontos gravados.');
    return;
  }
  const gpx =
`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Rotograma" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <trk>
    <name>Rota Rotograma</name>
    <trkseg>
      ${trackPoints.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele><time>${p.time}</time></trkpt>`).join('\n      ')}
    </trkseg>
  </trk>
</gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rota_${new Date().toISOString().replace(/[:.]/g,'-')}.gpx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Export KMZ (KML zipped)
async function exportKMZ() {
  if (!trackPoints.length) {
    alert('Sem pontos gravados.');
    return;
  }
  const kml =
`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Rota Rotograma</name>
    <Placemark>
      <name>Trilha</name>
      <Style>
        <LineStyle><color>ff22c55e</color><width>4</width></LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${trackPoints.map(p => `${p.lon},${p.lat},${p.ele}`).join(' ')}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

  const zip = new JSZip();
  zip.file("doc.kml", kml);
  const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `rota_${new Date().toISOString().replace(/[:.]/g,'-')}.kmz`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// UI wiring
function bindUI() {
  document.getElementById('startRecBtn').addEventListener('click', startRecording);
  document.getElementById('stopRecBtn').addEventListener('click', stopRecording);
  document.getElementById('captureBtn').addEventListener('click', capturePhotoWithMap);
  document.getElementById('exportGpxBtn').addEventListener('click', exportGPX);
  document.getElementById('exportKmzBtn').addEventListener('click', exportKMZ);
  document.getElementById('toggleMapBtn').addEventListener('click', () => {
    const wrap = document.getElementById('miniMapWrap');
    const vis = wrap.style.display !== 'none';
    wrap.style.display = vis ? 'none' : 'block';
  });
}

// Startup
(async function() {
  await initCamera();
  initMap();
  bindUI();
})();