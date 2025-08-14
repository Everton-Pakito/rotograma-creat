let videoStream, mediaRecorder, recordedChunks = [], events = [];

async function initCamera() {
  videoStream = await navigator.mediaDevices.getUserMedia({ video: { width:1280, height:720 }, audio: true });
  document.getElementById('camVideo').srcObject = videoStream;
}

function startRecording() {
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(videoStream, { mimeType: 'video/webm; codecs=vp9' });
  mediaRecorder.ondataavailable = e => { if(e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.start();
  document.getElementById('startRecBtn').disabled = true;
  document.getElementById('stopRecBtn').disabled = false;
}

function stopRecording() {
  mediaRecorder.stop();
  document.getElementById('startRecBtn').disabled = false;
  document.getElementById('stopRecBtn').disabled = true;
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rotograma.webm';
    a.click();
    URL.revokeObjectURL(url);
  };
}

function captureEvent() {
  const video = document.getElementById('camVideo');
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const imgData = canvas.toDataURL('image/jpeg');
  const event = { label: 'Curva/Acesso', image: imgData, timestamp: new Date().toLocaleTimeString() };
  events.push(event);

  const div = document.createElement('div');
  div.className = 'event';
  div.innerHTML = `<img class='thumb' src='${imgData}' /><div class='meta'><b>${event.label}</b><br>${event.timestamp}</div>`;
  document.getElementById('eventsContainer').appendChild(div);
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'landscape' });
  events.forEach((ev, i) => {
    pdf.text(`Evento: ${ev.label}`, 10, 10 + i*70);
    pdf.addImage(ev.image, 'JPEG', 10, 20 + i*70, 120, 67);
  });
  pdf.save('rotograma.pdf');
}

document.getElementById('startRecBtn').onclick = startRecording;
document.getElementById('stopRecBtn').onclick = stopRecording;
document.getElementById('captureBtn').onclick = captureEvent;
document.getElementById('exportPdfBtn').onclick = exportPDF;

initCamera();

// Inicializa mapa Leaflet (exemplo)
const map = L.map('map').setView([-23.55052, -46.633308], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);