# Local speech evaluation

Selected candidate: [Supertonic 3 Russian through sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/tts/all/Russian/supertonic-3-ru.html).

The selected backend is integrated as an optional local host engine. System speech remains available with explicit language/voice selection.

## Reproduced probe

- Runtime: sherpa-onnx 2.0.1, CPU, four threads, eight generation steps, Russian language, normal speed.
- Model: sherpa-onnx-supertonic-3-tts-int8-2026-05-11; extracted model/config files approximately 145.3 MB.
- Input: identical synthetic Russian paragraph covering numbers, a question and ambiguous stresses; no private chat content.
- Speaker 0: 27.92 seconds of audio generated in 4.55 seconds.
- Speaker 5: 27.94 seconds generated in 5.10 seconds.
- Initial engine load: 0.51 seconds; observed output rate: 44,100 Hz. The demo page lists 24,000 Hz; playback must use the actual returned audio rate.
- PCM WAV files were generated and checked for nonempty, non-silent samples. No subjective listening-quality claim or device-speaker test was made.

These are single-run timings on the evaluation machine, not cross-device performance guarantees. Evaluation models, Python runtime and samples remain in ignored local storage. The application uses the pinned sherpa-onnx-node 2.0.1 runtime; model weights are installed separately and are not bundled with the UI.

## License and integration boundary

The model uses [OpenRAIL-M](https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE); the sample code has a separate MIT license. Preserve the model terms/notices when distributing it. No paid speech API is needed for local synthesis.

## Using the integration

Open Appearance & language > Read aloud. Choose System voice or Supertonic 3, select one of ten speaker IDs and use Preview voice/Stop. The engine and speaker persist on the current device and apply to answer read-aloud.

Download Supertonic 3 voices installs the fixed model on the connected host once, after verifying its pinned SHA-256. The installer requires the host tar utility; Windows includes it on supported installations. It retains the model README, code license and complete model license notice. No API key or paid synthesis service is used. This initial download requires internet; subsequent inference runs on the host CPU. Android receives the generated WAV and requires the host connection.

Native synthesis runs in bounded worker threads; validated requests contain at most 1,200 characters, speaker IDs 0-9 and a supported language. The frontend splits longer answers, revokes audio URLs and stops playback on cancellation, ignoring late responses. An already submitted chunk can complete on the host after a client stops playback; worker execution is bounded and HTTP disconnects terminate it.

The speech endpoints use the existing host authentication/role middleware. Windows bridge access allows only the exact status/install/synthesize endpoints. Models are stored in host application data, outside repository boards and release source.

## Validation and remaining limits

- Generated real WAV through the native Node worker, tested cancellation and model-install extraction from the already downloaded pinned archive.
- Verified invalid model bytes are rejected by the checksum, request limits and host authentication.
- Browser mocks verified speaker persistence, preview requests and ignoring audio after Stop; system Russian voice selection and copy/draft behavior also passed.
- Windows native policy checks and build passed. Android device speaker playback and subjective voice quality remain unverified.

Silero/Piper comparison was superseded by selection of Supertonic 3.
