ACCESSBRIDGE AI  (Version 2.0)
Smart Multilingual Assistive Communication Platform
MCA Hackathon | Domain: Accessibility and Inclusion
=====================================================

WHAT IT DOES
------------
AccessBridge AI helps people who find it hard to speak, hear or read long
sentences communicate in everyday places such as hospitals, buses and shops.

SECTIONS
1. Communicate    - type a message and the browser speaks it aloud.
                    Phrase suggestions appear while you type.
                    "Show big" displays the message full-screen so the other
                    person can read it. "Simplify" rewrites hard English
                    sentences into short ones (offline). "Translate" changes
                    Tamil <-> English (phrase bank offline, any sentence with AI).
2. Picture cards  - 33 one-tap cards in Tamil and English across 5 categories
                    (Emergency, Health, Daily, Travel, Social) with search.
                    Add or remove your own cards.
3. Listen         - turns speech into large text. Save, copy or speak it back.
4. History        - everything you spoke or saved. Replay, reuse, download as
                    a text file, or print.
5. Emergency      - one big "I need help" button (speaks + full-screen message),
                    emergency numbers (112, 108, 100, 101), saved family contact,
                    call button, and an alert message (with optional GPS location) that
                    you send through your SMS app, WhatsApp, Share or Copy.
6. Settings       - easy-reading spacing, optional AI assist, erase data, about.

Also: text size A-/A+, high contrast, keyboard-only use, screen-reader labels,
works offline after first visit (service worker), installable as an app.


HOW TO RUN
----------
EASIEST (Windows): unzip, then double-click  start-windows.bat
         (If Python is not installed it opens index.html directly.)
         Do NOT type "localhost" in the browser by yourself. If you see
         "localhost refused to connect", the server is not running; just
         double-click index.html instead.

Option 1 (quickest): unzip, then double-click index.html.
         Use Google Chrome or Microsoft Edge.

Option 2 (recommended for the demo: offline + install as app):
         Open a terminal inside the "accessbridge-ai" folder and run:
             python -m http.server 8000
         Then open  http://localhost:8000  in Chrome or Edge.
         (In Chrome you can click the install icon in the address bar.)

Internet is needed only for: the font, speech-to-text (Chrome sends audio to
Google's speech service) and the optional AI buttons.


FILES
-----
start-windows.bat  one-click launcher for Windows
index.html          page structure (6 sections)
style.css           design, high contrast, responsive, print styles
script.js           all features
manifest.json       installable app details
sw.js               offline support
icon.svg            app icon
README.txt          this file
PROJECT_ABSTRACT.md hackathon abstract, architecture, impact, future scope


OPTIONAL AI ASSIST (Settings page)
----------------------------------
Paste an Anthropic API key to enable "AI improve" and translation of any
sentence. Notes:
- The key is kept only in your browser (localStorage). This is for demos.
  A real product must call the AI from a secure server, never from the browser.
- Your message text is sent to Anthropic when you press an AI button.
- You can change the model name in Settings if it is retired in future.
Without a key everything else still works.


TAMIL VOICE NOTE
----------------
Tamil speech output needs a Tamil voice on the device.
- Android / Chrome: usually available.
- Windows: Settings > Time & Language > Speech > Add voices > Tamil.
The page shows a message under the language box if no voice is found.


5-MINUTE DEMO SCRIPT
--------------------
1. Problem (30 s): many people cannot speak or hear easily; tools are English-only.
2. Communicate (60 s): type "I need some water", press Speak. Show suggestions.
   Press "Show big" to show the screen to a judge.
3. Picture cards (45 s): switch language to Tamil, tap Health / Emergency cards.
4. Listen (60 s): Start listening, ask a friend to speak, "Use as my message".
5. Simplify + Translate (45 s): paste a long sentence, press Simplify.
   Type "Thank you", press Translate.
6. Emergency (45 s): press "I need help", show the big message and contacts.
7. Accessibility (15 s): A+, High contrast, keyboard shortcuts (Alt+1 to 6).
8. Future scope (20 s): sign-language recognition, more languages, secure
   AI backend, caregiver dashboard.


KEYBOARD SHORTCUTS
------------------
Ctrl + Enter   speak the message
Esc            stop speaking / close big screen
Alt + 1 to 6   switch sections


ABOUT SMS (IMPORTANT)
---------------------
A web page cannot send an SMS automatically. The SMS and WhatsApp buttons open
your messaging app with the number and message already filled in; you press Send.
- SMS button works on phones (Android / iPhone). On a laptop it may do nothing.
- WhatsApp button works on phone and laptop (WhatsApp Web / Desktop).
- 10-digit numbers automatically become +91xxxxxxxxxx.
- "Add my location" needs permission and works on https:// or http://localhost.
Sending real SMS automatically needs a server and a paid SMS service. That is
listed as future scope.


TROUBLESHOOTING
---------------
- No sound: check device volume and that a voice exists for the language.
- Listening does not start: allow the microphone in the address bar.
- "network" error while listening: check your internet connection.
- Old version still showing after an update: hard refresh (Ctrl + Shift + R).
- Browser not supported: use Chrome or Edge.
