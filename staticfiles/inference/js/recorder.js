export class MicRecorder {
  #recorder; #chunks = []; #stream;

  async start(onStop){
    this.#chunks = [];
    this.#stream   = await navigator.mediaDevices.getUserMedia({audio:true});
    this.#recorder = new MediaRecorder(this.#stream);
    this.#recorder.ondataavailable = e => e.data.size && this.#chunks.push(e.data);
    this.#recorder.onstop = () => {
       onStop(new Blob(this.#chunks, {type:'audio/wav'}));
       this.#stream.getTracks().forEach(t => t.stop());
    };
    this.#recorder.start();
  }
  stop(){ this.#recorder && this.#recorder.stop(); }
}
