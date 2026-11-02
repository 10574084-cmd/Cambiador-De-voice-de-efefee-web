# Voice Lab — Web Voice Changer

An independent browser-based voice changer inspired by the general idea of voice-effects apps. It does not reuse the original Android application's source code, assets, or native libraries.

## Features

- Live microphone input.
- Load an audio file in the browser.
- Presets: Normal, Robot, Radio, Echo, Cave, Helium, Deep, and Alien.
- Adjustable pitch, echo, reverb, and distortion.
- Record the processed output and download it as WebM audio.
- Audio processing runs locally in the current browser tab.

## Run it

Serve the repository over HTTPS or localhost, then open index.html. Microphone access normally requires a secure context and user permission. GitHub Pages provides HTTPS.

## Publish with GitHub Pages

1. Open Settings → Pages in this repository.
2. Under Build and deployment, set the source to GitHub Actions.
3. Push to the main branch or manually run the Deploy Voice Lab workflow.
4. The site will be published at https://10574084-cmd.github.io/Cambiador-De-voice-de-efefee-web/.

The workflow copies only the web app files into the Pages artifact. It does not publish the XAPK or the inspection scripts as website files.

## Notes

- Browser audio processing and recording support vary by browser and device.
- The pitch effect is a lightweight time-domain shifter and may introduce artifacts at extreme settings.
- Use headphones while monitoring a live microphone to reduce feedback.
- The original XAPK remains separate and unchanged in the repository.
