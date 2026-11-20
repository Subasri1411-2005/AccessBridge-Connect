# AccessBridge AI
**Smart Multilingual Assistive Communication Platform**

MCA Hackathon · Domain: Accessibility and Inclusion
Developed by M. Subasri, MCA, Rathinam Technical Campus

---

## 1. Problem statement
People with speech, hearing or reading difficulties struggle to communicate quickly in everyday situations such as hospitals, bus stands, shops and offices. Most assistive tools are English-only, need paid apps or special hardware, and do not work offline. In an emergency, these gaps become dangerous.

## 2. Proposed solution
AccessBridge AI is a free web application that runs in any modern browser. It combines text-to-speech, speech-to-text, one-tap picture cards, sentence simplification, Tamil and English translation, and an emergency help module in one accessible interface.

## 3. Key features
| Module | What it does |
|---|---|
| Communicate | Speaks typed text in Tamil, English and four other Indian languages. Phrase suggestions while typing. "Show big" displays the message full-screen. |
| Picture cards | 33 ready cards in 5 categories, Tamil and English, with search. Users add their own cards. |
| Listen | Live speech-to-text shown in large letters. Save, copy or speak back. |
| Simplify | Rule-based rewriting of difficult English into short sentences (works offline). |
| Translate | Offline Tamil and English phrase bank; any sentence with optional AI. |
| History | Saved conversations; replay, download as text, print. |
| Emergency | One-tap help message (spoken and shown big), emergency numbers, saved family contact, alert message with optional GPS location sent via SMS app, WhatsApp, Share or Copy. |
| Accessibility | Text size control, high contrast, easy-reading spacing, full keyboard use, ARIA labels for screen readers, reduced-motion support. |
| Offline and install | Service worker caching and web app manifest, so it works without internet after the first visit. |

## 4. Technology
HTML5, CSS3, JavaScript (ES6), Web Speech API (SpeechSynthesis and SpeechRecognition), localStorage, Service Worker, Web App Manifest, Geolocation API, optional Claude API for AI rewriting and translation.

## 5. Architecture
```
 User (type / tap / speak)
        |
  Browser app (HTML + CSS + JS)
   |-- Speech output   -> Web Speech API (SpeechSynthesis)
   |-- Speech input    -> Web Speech API (SpeechRecognition)
   |-- Phrase bank     -> picture cards + extra phrases (offline)
   |-- Simplifier      -> rule engine (offline)
   |-- AI (optional)   -> Claude API
   |-- Storage         -> localStorage (history, cards, contact, settings)
   |-- Offline         -> Service Worker cache
```
No account, no database and no server are needed. User data stays on the user's device.

## 6. Social impact
- Supports UN Sustainable Development Goal 10 (Reduced Inequalities).
- Free, works on low-cost phones and old laptops through the browser.
- Tamil-first design reaches users who are left out by English-only tools.
- Privacy by design: no sign-up, no tracking, data stays local.

## 7. Limitations (honest notes)
- Speech recognition depends on the browser (Chrome and Edge) and needs internet.
- Tamil voices depend on voices installed on the device.
- Simplifier and offline translation are rule and phrase based, not full AI. Full AI translation needs the optional API key.
- The API key in this prototype is stored in the browser for demo use; a production version must use a secure backend.
- Not a replacement for professional medical or emergency services.

## 8. Future scope
0. Automatic SMS alerts through a secure server and an SMS gateway (a browser alone cannot send SMS).
1. Sign-language and gesture recognition using the camera.
2. Secure backend for AI features and user accounts.
3. More languages and regional voices.
4. Caregiver dashboard and shared card sets for schools and hospitals.
5. Predictive typing trained on a user's own frequent phrases.
6. Native Android app.

## 9. Suggested evaluation answers
- **Why this project?** Communication is a basic right, and the tools to support it should be free and local-language.
- **What is innovative?** Tamil-first picture cards, emergency help and offline use in one accessible app.
- **How is it different from existing tools?** Free, no install, works offline, supports Tamil, privacy-friendly.
- **Is AI used?** Optional AI for rewriting and translation, plus rule-based language simplification offline.
