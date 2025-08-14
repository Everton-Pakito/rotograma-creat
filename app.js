let videoStream, mediaRecorder, recordedChunks = [];
let trackWatchId = null;
let trackPoints = [];
let map, mapMarker;

async function initCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video:{facingMode:"environment"}, audio:true });
  } catch {
    videoStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
  }
  document.getElementById('camVideo').srcObject = videoStream;
}

function initMap() {
  map = L.map('miniMap', { zoomControl:false, attributionControl:false }).setView([0,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 18);
      mapMarker = L.marker([latitude, longitude]).addTo(map);
    });
  }
}

function startRecording(){
  recordedChunks=[];
  mediaRecorder=new MediaRecorder(videoStream,{mimeType:'video/webm;codecs=vp9'});
  mediaRecorder.ondataavailable=e=>{if(e.data.size>0)recordedChunks.push(e.data);};
  mediaRecorder.onstop=()=>{
    const blob=new Blob(recordedChunks,{type:'video/webm'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='rotograma.webm';
    a.click();
  };
  mediaRecorder.start();
  startTrack();
  document.getElementById('startRecBtn').disabled=true;
  document.getElementById('stopRecBtn').disabled=false;
}

function stopRecording(){
  if(mediaRecorder) mediaRecorder.stop();
  stopTrack();
  document.getElementById('startRecBtn').disabled=false;
  document.getElementById('stopRecBtn').disabled=true;
}

async function capturePhotoWithMap(){
  const video=document.getElementById('camVideo');
  const w=video.videoWidth||1920, h=video.videoHeight||1080;
  const canvas=document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(video,0,0,w,h);
  const mapCanvas=await html2canvas(document.getElementById('miniMapWrap'),{backgroundColor:null, useCORS:true, scale:2});
  const insetW=Math.floor(w*0.25), insetH=insetW, pad=20;
  ctx.drawImage(mapCanvas, w-insetW-pad, pad, insetW, insetH);
  const logo=document.getElementById('logoWatermark');
  const logoW=Math.floor(w*0.2);
  const logoH=Math.floor(logoW*(logo.naturalHeight/logo.naturalWidth));
  ctx.drawImage(logo,(w-logoW)/2, pad, logoW, logoH);
  ctx.fillStyle='white'; ctx.font=`${Math.floor(w*0.02)}px sans-serif`;
  ctx.fillText(new Date().toLocaleString(), pad, h-pad);
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/jpeg',0.9);
  a.download='captura.jpg';
  a.click();
}

function startTrack(){
  trackPoints=[];
  trackWatchId=navigator.geolocation.watchPosition(pos=>{
    const {latitude,longitude,altitude}=pos.coords;
    const time=new Date(pos.timestamp).toISOString();
    trackPoints.push({lat:latitude,lon:longitude,ele:altitude||0,time});
    if(mapMarker) mapMarker.setLatLng([latitude,longitude]);
  },err=>{}, {enableHighAccuracy:true});
}

function stopTrack(){
  if(trackWatchId) navigator.geolocation.clearWatch(trackWatchId);
}

function exportGPX(){
  if(!trackPoints.length){alert('Sem pontos');return;}
  const gpx=`<?xml version="1.0"?><gpx version="1.1" creator="Rotograma"><trk><trkseg>${
    trackPoints.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele}</ele><time>${p.time}</time></trkpt>`).join('')
  }</trkseg></trk></gpx>`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([gpx],{type:'application/gpx+xml'}));
  a.download='rota.gpx'; a.click();
}

async function exportKMZ(){
  if(!trackPoints.length){alert('Sem pontos');return;}
  const kml=`<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><LineString><coordinates>${
    trackPoints.map(p=>`${p.lon},${p.lat},${p.ele}`).join(' ')
  }</coordinates></LineString></Placemark></Document></kml>`;
  const zip=new JSZip();
  zip.file('doc.kml',kml);
  const blob=await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='rota.kmz'; a.click();
}

function bindUI(){
  document.getElementById('startRecBtn').onclick=startRecording;
  document.getElementById('stopRecBtn').onclick=stopRecording;
  document.getElementById('captureBtn').onclick=capturePhotoWithMap;
  document.getElementById('exportGpxBtn').onclick=exportGPX;
  document.getElementById('exportKmzBtn').onclick=exportKMZ;
  document.getElementById('toggleMapBtn').onclick=()=>{
    const m=document.getElementById('miniMapWrap');
    m.style.display=(m.style.display==='none')?'block':'none';
  };
}

(async()=>{ await initCamera(); initMap(); bindUI(); })();
