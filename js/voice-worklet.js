/* Changement de hauteur de voix en direct (AudioWorklet, utilisé par js/megaphone.js).
   Deux têtes de lecture, décalées d'une demi-fenêtre, se fondent l'une dans l'autre :
   la voix monte (ratio > 1) ou descend (ratio < 1) sans changer de vitesse. */
class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: "ratio", defaultValue: 1.5, minValue: 0.5, maxValue: 2, automationRate: "k-rate" }];
  }

  constructor() {
    super();
    this.size = 16384; // mémoire circulaire
    this.buf = new Float32Array(this.size);
    this.w = 0; // position d'écriture
    this.W = 2400; // taille de la fenêtre, environ 50 ms à 48 kHz
    this.d = 0; // distance de lecture, entre 0 et W
  }

  // Lit la mémoire à « delay » échantillons en arrière, avec interpolation
  read(delay) {
    let pos = this.w - delay;
    while (pos < 0) pos += this.size;
    const i0 = Math.floor(pos) % this.size;
    const i1 = (i0 + 1) % this.size;
    const f = pos - Math.floor(pos);
    return this.buf[i0] * (1 - f) + this.buf[i1] * f;
  }

  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const ratio = params.ratio[0];
    const out = output[0];
    const W = this.W;
    for (let i = 0; i < out.length; i++) {
      this.buf[this.w] = input ? input[i] : 0;
      const d1 = this.d;
      let d2 = d1 + W / 2;
      if (d2 >= W) d2 -= W;
      // Fenêtres de Hann décalées : leur somme vaut 1, pas de creux ni de clic
      const g1 = Math.sin((Math.PI * d1) / W) ** 2;
      const g2 = Math.sin((Math.PI * d2) / W) ** 2;
      out[i] = g1 * this.read(d1) + g2 * this.read(d2);
      // La distance de lecture change de (ratio - 1) à chaque échantillon
      this.d -= ratio - 1;
      while (this.d < 0) this.d += W;
      while (this.d >= W) this.d -= W;
      this.w = (this.w + 1) % this.size;
    }
    for (let c = 1; c < output.length; c++) output[c].set(out);
    return true;
  }
}

registerProcessor("pitch-shifter", PitchShifter);
