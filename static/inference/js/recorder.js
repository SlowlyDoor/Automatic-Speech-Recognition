export class MicRecorder {
  #recorder; #chunks = []; #stream;
  isPaused = false;

  async start(onStop) {
    this.#chunks = [];
    this.#stream   = await navigator.mediaDevices.getUserMedia({ audio:true });
    this.#recorder = new MediaRecorder(this.#stream);

    this.#recorder.ondataavailable = e => e.data.size && this.#chunks.push(e.data);
    this.#recorder.onstop = () => {
      onStop(new Blob(this.#chunks, { type:'audio/webm' }));
      this.#stream.getTracks().forEach(t => t.stop());
    };

    this.#recorder.start();
    this.isPaused = false;
  }

  pause()  { if (this.#recorder?.state === 'recording')  { this.#recorder.pause();  this.isPaused = true;  } }
  resume() { if (this.#recorder?.state === 'paused')     { this.#recorder.resume(); this.isPaused = false; } }
  stop()   { this.#recorder?.stop(); }
}