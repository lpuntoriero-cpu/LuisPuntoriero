/* Drift Masters -> Smart City: última carrera real.
   Se carga al final de index.html, después del código principal.
   No cambia el firmware ni la conexión Bluetooth. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('smartcityBridge') !== '1') return;
  const originParam = params.get('smartcityOrigin') || '*';
  const targetOrigin = /^https?:\/\//.test(originParam) ? originParam : '*';
  const KEY = 'drift_masters_smartcity_last_race_v1';
  let lastSent = '';
  const valid = (d) => d && ['azul1','azulTotal','rojo1','rojoTotal'].every(
    k => Number.isFinite(Number(d[k])) && Number(d[k]) > 0
  ) && Number(d.azulTotal) > Number(d.azul1) && Number(d.rojoTotal) > Number(d.rojo1);
  function vehicleType() {
    const v = document.getElementById('vehicleType')?.value || 'drift';
    return ['drift', 'rc', 'yahboom', 'microbit'].includes(v) ? v : 'drift';
  }
  function buildRace() {
    // El firmware envía los cuatro valores VUELTAS en milisegundos.
    if (typeof datosRepeticion === 'undefined' || !valid(datosRepeticion)) return null;
    if (typeof raceSaved !== 'undefined' && !raceSaved) return null;
    const d = datosRepeticion;
    return {
      id: [d.azul1, d.azulTotal, d.rojo1, d.rojoTotal, Date.now()].join('-'),
      b1: Number(d.azul1) / 1000,
      bt: Number(d.azulTotal) / 1000,
      r1: Number(d.rojo1) / 1000,
      rt: Number(d.rojoTotal) / 1000,
      pb: typeof pilotNames !== 'undefined' ? String(pilotNames.azul || 'Azul') : 'Azul',
      pr: typeof pilotNames !== 'undefined' ? String(pilotNames.rojo || 'Rojo') : 'Rojo',
      vehicle: vehicleType(),
    };
  }
  function sendRace(race) {
    if (!race || !window.opener || window.opener.closed) return;
    try {
      window.opener.postMessage({ type: 'DM_SMARTCITY_RACE_V1', race }, targetOrigin);
    } catch (e) {
      console.warn('Enlace con Smart City:', e);
    }
  }
  // La maqueta refleja el tipo seleccionado incluso antes de largar la carrera.
  function sendVehicle() {
    if (!window.opener || window.opener.closed) return;
    try {
      window.opener.postMessage({ type: 'DM_SMARTCITY_VEHICLE_V1', vehicle: vehicleType() }, targetOrigin);
    } catch (e) {
      console.warn('Enlace de vehículo con Smart City:', e);
    }
  }
  document.getElementById('vehicleType')?.addEventListener('change', sendVehicle);
  function publishLatest() {
    const race = buildRace();
    if (!race) return;
    const fingerprint = [race.b1, race.bt, race.r1, race.rt, race.pb, race.pr, race.vehicle].join('|');
    if (fingerprint === lastSent) return;
    lastSent = fingerprint;
    try { localStorage.setItem(KEY, JSON.stringify(race)); } catch (e) {}
    sendRace(race);
  }
  // Intercepta el paquete VUELTAS ya procesado por la aplicación original.
  // No añade tráfico BLE ni modifica los comandos a micro:bit.
  const originalProcessMessage = window.processMessage;
  if (typeof originalProcessMessage === 'function') {
    window.processMessage = function (raw) {
      const result = originalProcessMessage.apply(this, arguments);
      if (typeof raw === 'string' && raw.trim().toUpperCase().startsWith('VUELTAS:')) {
        publishLatest();
      }
      return result;
    };
  } else {
    console.warn('Enlace Smart City: cargar después del script principal.');
  }
  document.addEventListener('dm-race-finished', () => {
    // Si el paquete VUELTAS precedió a RESULTADOS, reintenta después del cierre.
    setTimeout(publishLatest, 100);
  });
  window.addEventListener('message', (e) => {
    if (e.source !== window.opener) return;
    if (targetOrigin !== '*' && e.origin !== targetOrigin) return;
    if (e.data?.type === 'DM_SMARTCITY_GET_LATEST_V1') {
      try {
        const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (stored) sendRace(stored);
      } catch (e) {}
      sendVehicle();
    }
  });
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: 'DM_SMARTCITY_READY_V1' }, targetOrigin);
    sendVehicle();
  }
})();