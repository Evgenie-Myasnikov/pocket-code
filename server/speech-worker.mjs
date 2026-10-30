import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),s=require('sherpa-onnx-node'),dir=workerData.directory;
try{
 const tts=new s.OfflineTts({model:{supertonic:{durationPredictor:path.join(dir,'duration_predictor.int8.onnx'),textEncoder:path.join(dir,'text_encoder.int8.onnx'),vectorEstimator:path.join(dir,'vector_estimator.int8.onnx'),vocoder:path.join(dir,'vocoder.int8.onnx'),ttsJson:path.join(dir,'tts.json'),unicodeIndexer:path.join(dir,'unicode_indexer.bin'),voiceStyle:path.join(dir,'voice.bin')},numThreads:4,provider:'cpu',debug:false}});
 const audio=tts.generate({text:workerData.text,generationConfig:new s.GenerationConfig({sid:workerData.voice,numSteps:8,speed:1,extra:{lang:workerData.language}})});
 const samples=audio.samples,rate=audio.sampleRate;
 if(!samples.length||samples.length>rate*180)throw Error('Invalid speech duration');
 const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
 parentPort.postMessage({audio:b.toString('base64'),mime:'audio/wav'});
}catch{parentPort.postMessage({error:'Local speech generation failed.'});}
