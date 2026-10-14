// Toca o aviso sonoro. Feito com WebAudio para nao depender de arquivo de audio.
// "deal": duas notas subindo, tipo campainha de balcao. "warn": nota grave dupla.

const NOTES = {
  deal: [[784, 0], [1175, 0.13]],
  warn: [[392, 0], [392, 0.22]],
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target !== "offscreen" || msg.type !== "chime") return;
  const ctx = new AudioContext();
  for (const [freq, at] of NOTES[msg.kind] || NOTES.deal) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }
  setTimeout(() => ctx.close(), 1200);
});
