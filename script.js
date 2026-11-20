/* AccessBridge AI – script.js
   Sections: helpers · views · display · speech output · overlay · composer · suggestions ·
   simplify / translate / AI · picture cards · listen (speech to text) · history ·
   emergency · settings · shortcuts · offline (service worker)
   Everything runs in the browser (Web Speech API). No server needed. */

(() => {
  'use strict';

  /* =====================================================
     1. HELPERS
     ===================================================== */
  const $ = (id) => document.getElementById(id);
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const PREFIX = 'accessbridge:';

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(PREFIX + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
    },
    remove(key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    },
    clearAll() {
      try {
        Object.keys(localStorage).filter((k) => k.indexOf(PREFIX) === 0).forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    }
  };

  const statusEl = $('status');
  let statusTimer = null;
  function say(msg) {
    statusEl.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 4000);
  }

  async function copyText(text) {
    if (!text.trim()) { say('Nothing to copy yet.'); return; }
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (err) { /* ignore */ }
      t.remove();
    }
    say('Copied.');
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const normLang = (l) => (l || '').replace('_', '-').toLowerCase();
  const hasTamil = (s) => /[\u0B80-\u0BFF]/.test(s || '');

  /* Elements used in several sections */
  const messageEl = $('message');
  const langEl = $('lang');
  const voiceEl = $('voice');
  const rateEl = $('rate');
  const pitchEl = $('pitch');

  const isTamilMode = () => normLang(langEl.value).startsWith('ta');
  const langName = (code) => {
    const opt = Array.from(langEl.options).find((o) => o.value === code);
    return opt ? opt.textContent : code;
  };

  /* =====================================================
     2. VIEWS (tabs)
     ===================================================== */
  const VIEWS = ['communicate', 'cards', 'listen', 'history', 'emergency', 'settings'];

  function showView(name) {
    if (VIEWS.indexOf(name) === -1) name = 'communicate';
    VIEWS.forEach((v) => {
      const on = v === name;
      $('view-' + v).hidden = !on;
      const tab = $('tab-' + v);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    if (name === 'history') renderHistory();
    window.scrollTo(0, 0);
  }

  function goTo(name) {
    if (location.hash === '#' + name) showView(name);
    else location.hash = name;
  }

  window.addEventListener('hashchange', () => showView(location.hash.replace('#', '')));

  VIEWS.forEach((v, i) => {
    const tab = $('tab-' + v);
    tab.addEventListener('click', () => goTo(v));
    tab.addEventListener('keydown', (e) => {
      let next = -1;
      if (e.key === 'ArrowRight') next = (i + 1) % VIEWS.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + VIEWS.length) % VIEWS.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = VIEWS.length - 1;
      if (next >= 0) { e.preventDefault(); goTo(VIEWS[next]); $('tab-' + VIEWS[next]).focus(); }
    });
  });

  /* =====================================================
     3. DISPLAY SETTINGS
     ===================================================== */
  const SIZES = [90, 100, 115, 130, 150, 175];
  let sizeIdx = store.get('sizeIdx', 1);
  let contrastOn = store.get('contrast', false);
  let easyOn = store.get('easy', false);

  function applyDisplay() {
    document.documentElement.style.setProperty('--fs', SIZES[sizeIdx] + '%');
    document.body.dataset.contrast = contrastOn ? 'on' : 'off';
    document.body.dataset.easy = easyOn ? 'on' : 'off';
    $('btnContrast').setAttribute('aria-pressed', String(contrastOn));
    $('btnEasy').setAttribute('aria-pressed', String(easyOn));
    store.set('sizeIdx', sizeIdx); store.set('contrast', contrastOn); store.set('easy', easyOn);
  }
  $('btnSmaller').addEventListener('click', () => { sizeIdx = Math.max(0, sizeIdx - 1); applyDisplay(); say('Text size ' + SIZES[sizeIdx] + '%'); });
  $('btnLarger').addEventListener('click', () => { sizeIdx = Math.min(SIZES.length - 1, sizeIdx + 1); applyDisplay(); say('Text size ' + SIZES[sizeIdx] + '%'); });
  $('btnContrast').addEventListener('click', () => { contrastOn = !contrastOn; applyDisplay(); say(contrastOn ? 'High contrast on' : 'High contrast off'); });
  $('btnEasy').addEventListener('click', () => { easyOn = !easyOn; applyDisplay(); say(easyOn ? 'Easy reading on' : 'Easy reading off'); });

  function updateNet() {
    const on = navigator.onLine;
    $('netBadge').textContent = on ? 'Online' : 'Offline';
    $('netBadge').dataset.state = on ? 'on' : 'off';
  }
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);

  /* =====================================================
     4. HISTORY STORE (needed by speech output)
     ===================================================== */
  let hist = store.get('history', []);

  function addHistory(type, text, lang) {
    const clean = (text || '').trim();
    if (!clean) return;
    hist.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), type, text: clean, lang: lang || '' });
    hist = hist.slice(0, 100);
    store.set('history', hist);
    if (!$('view-history').hidden) renderHistory();
    updateSuggestions();
  }

  /* =====================================================
     5. SPEECH OUTPUT (text to speech)
     ===================================================== */
  const voiceNote = $('voiceNote');
  let voices = [];

  function voicesFor(lang) {
    const l = normLang(lang);
    const base = l.split('-')[0];
    const same = voices.filter((v) => normLang(v.lang).split('-')[0] === base);
    return same.sort((a, b) => (normLang(b.lang) === l) - (normLang(a.lang) === l));
  }

  function fillVoices() {
    const lang = langEl.value;
    const list = voicesFor(lang);
    const saved = store.get('voice:' + lang, '');
    voiceEl.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = ''; auto.textContent = 'Automatic';
    voiceEl.appendChild(auto);
    list.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')';
      voiceEl.appendChild(o);
    });
    if (saved && list.some((v) => v.name === saved)) voiceEl.value = saved;

    if (!synth) {
      voiceNote.textContent = 'Speech output is not supported in this browser. Please use Google Chrome or Microsoft Edge.';
      voiceNote.hidden = false;
    } else if (voices.length && !list.length) {
      voiceNote.textContent = 'No ' + langName(lang) + ' voice was found on this device. Install that language voice in your system settings, or try Chrome or Edge.';
      voiceNote.hidden = false;
    } else {
      voiceNote.hidden = true;
    }
  }

  function loadVoices() {
    if (synth) voices = synth.getVoices();
    fillVoices();
  }

  function pickVoice(lang) {
    if (normLang(lang) === normLang(langEl.value) && voiceEl.value) {
      const chosen = voices.find((v) => v.name === voiceEl.value);
      if (chosen) return chosen;
    }
    return voicesFor(lang)[0] || null;
  }

  /* Choose the language that matches the script of the text (Tamil letters vs. others) */
  function resolveLang(text, lang) {
    if (lang) return lang;
    const selected = langEl.value;
    const tamilSelected = normLang(selected).startsWith('ta');
    const tamilText = hasTamil(text);
    if (tamilText && !tamilSelected) return 'ta-IN';
    if (!tamilText && tamilSelected) return 'en-IN';
    return selected;
  }

  function speak(text, lang, options) {
    const opts = options || {};
    const clean = (text || '').trim();
    if (!clean) { say('Type or choose something to speak first.'); return; }
    if (!synth) { say('Speech output is not supported in this browser.'); return; }
    const useLang = resolveLang(clean, lang);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = useLang;
    const v = pickVoice(useLang);
    if (v) u.voice = v;
    u.rate = parseFloat(rateEl.value);
    u.pitch = parseFloat(pitchEl.value);
    u.volume = 1;
    u.onstart = () => say('Speaking…');
    u.onend = () => say('Done.');
    u.onerror = (e) => { if (e.error !== 'canceled' && e.error !== 'interrupted') say('Could not speak: ' + e.error); };
    synth.speak(u);
    if (opts.log !== false) addHistory('spoken', clean, useLang);
  }

  function stopSpeaking() {
    if (synth) synth.cancel();
    say('Stopped.');
  }

  if (synth) {
    loadVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = loadVoices;
  }

  langEl.value = store.get('lang', 'en-IN');
  rateEl.value = store.get('rate', 1);
  pitchEl.value = store.get('pitch', 1);
  fillVoices();

  langEl.addEventListener('change', () => { store.set('lang', langEl.value); fillVoices(); renderCards(); });
  voiceEl.addEventListener('change', () => store.set('voice:' + langEl.value, voiceEl.value));
  rateEl.addEventListener('change', () => store.set('rate', rateEl.value));
  pitchEl.addEventListener('change', () => store.set('pitch', pitchEl.value));

  /* =====================================================
     6. BIG-SCREEN OVERLAY
     ===================================================== */
  const overlayEl = $('overlay');
  let overlayText = '';
  let overlayLang = '';
  let overlayReturnFocus = null;

  function showBig(text, lang) {
    const clean = (text || '').trim();
    if (!clean) { say('Type a message first.'); return; }
    overlayText = clean; overlayLang = lang || '';
    $('overlayText').textContent = clean;
    overlayReturnFocus = document.activeElement;
    overlayEl.hidden = false;
    $('btnOverlayClose').focus();
  }

  function closeBig() {
    overlayEl.hidden = true;
    if (overlayReturnFocus && overlayReturnFocus.focus) overlayReturnFocus.focus();
  }

  $('btnOverlayClose').addEventListener('click', closeBig);
  $('btnOverlaySpeak').addEventListener('click', () => speak(overlayText, overlayLang));
  overlayEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [$('btnOverlaySpeak'), $('btnOverlayClose')];
    const idx = items.indexOf(document.activeElement);
    e.preventDefault();
    const next = e.shiftKey ? (idx <= 0 ? items.length - 1 : idx - 1) : (idx + 1) % items.length;
    items[next].focus();
  });

  /* =====================================================
     7. COMPOSER BUTTONS
     ===================================================== */
  $('btnSpeak').addEventListener('click', () => speak(messageEl.value));
  $('btnStop').addEventListener('click', stopSpeaking);
  $('btnShow').addEventListener('click', () => showBig(messageEl.value, resolveLang(messageEl.value)));
  $('btnCopy').addEventListener('click', () => copyText(messageEl.value));
  $('btnClear').addEventListener('click', () => { messageEl.value = ''; updateSuggestions(); messageEl.focus(); say('Message cleared.'); });
  messageEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); speak(messageEl.value); }
  });
  messageEl.addEventListener('input', updateSuggestions);

  /* =====================================================
     8. PICTURE CARDS DATA (also used by suggestions + translation)
     ===================================================== */
  const CATEGORIES = ['All', 'Emergency', 'Health', 'Daily', 'Travel', 'Social'];

  const DEFAULT_CARDS = [
    { icon: '🆘', cat: 'Emergency', en: 'Please help me', ta: 'தயவுசெய்து எனக்கு உதவுங்கள்' },
    { icon: '🚑', cat: 'Emergency', en: 'Call an ambulance', ta: 'ஆம்புலன்ஸை அழையுங்கள்' },
    { icon: '👮', cat: 'Emergency', en: 'Call the police', ta: 'காவல்துறையை அழையுங்கள்' },
    { icon: '👨‍👩‍👧', cat: 'Emergency', en: 'Call my family', ta: 'என் குடும்பத்தினரை அழையுங்கள்' },
    { icon: '🔥', cat: 'Emergency', en: 'There is a fire', ta: 'தீ பிடித்துள்ளது' },
    { icon: '📍', cat: 'Emergency', en: 'I am lost', ta: 'நான் வழி தவறிவிட்டேன்' },

    { icon: '🩺', cat: 'Health', en: 'I need a doctor', ta: 'எனக்கு மருத்துவர் வேண்டும்' },
    { icon: '🤕', cat: 'Health', en: 'I am in pain', ta: 'எனக்கு வலிக்கிறது' },
    { icon: '😵', cat: 'Health', en: 'I feel dizzy', ta: 'எனக்கு தலைசுற்றுகிறது' },
    { icon: '💊', cat: 'Health', en: 'I need my medicine', ta: 'எனக்கு மருந்து வேண்டும்' },
    { icon: '😮‍💨', cat: 'Health', en: 'I cannot breathe well', ta: 'எனக்கு மூச்சு விட சிரமமாக இருக்கிறது' },

    { icon: '💧', cat: 'Daily', en: 'I need water', ta: 'எனக்கு தண்ணீர் வேண்டும்' },
    { icon: '🍚', cat: 'Daily', en: 'I am hungry', ta: 'எனக்கு பசிக்கிறது' },
    { icon: '☕', cat: 'Daily', en: 'I want tea', ta: 'எனக்கு தேநீர் வேண்டும்' },
    { icon: '🚻', cat: 'Daily', en: 'I need to use the washroom', ta: 'நான் கழிவறைக்குச் செல்ல வேண்டும்' },
    { icon: '😴', cat: 'Daily', en: 'I am tired', ta: 'எனக்கு சோர்வாக இருக்கிறது' },
    { icon: '🏠', cat: 'Daily', en: 'I want to go home', ta: 'நான் வீட்டிற்குப் போக வேண்டும்' },

    { icon: '🚌', cat: 'Travel', en: 'Where is the bus stop?', ta: 'பேருந்து நிறுத்தம் எங்கே?' },
    { icon: '🚆', cat: 'Travel', en: 'Where is the railway station?', ta: 'ரயில் நிலையம் எங்கே?' },
    { icon: '🎫', cat: 'Travel', en: 'How much is the ticket?', ta: 'டிக்கெட் எவ்வளவு?' },
    { icon: '🏥', cat: 'Travel', en: 'Please take me to the hospital', ta: 'என்னை மருத்துவமனைக்கு அழைத்துச் செல்லுங்கள்' },
    { icon: '🧭', cat: 'Travel', en: 'Please show me the way', ta: 'தயவுசெய்து வழி காட்டுங்கள்' },

    { icon: '😊', cat: 'Social', en: 'Hello', ta: 'வணக்கம்' },
    { icon: '🙏', cat: 'Social', en: 'Thank you', ta: 'நன்றி' },
    { icon: '😔', cat: 'Social', en: 'Sorry', ta: 'மன்னிக்கவும்' },
    { icon: '👍', cat: 'Social', en: 'Yes', ta: 'ஆம்' },
    { icon: '👎', cat: 'Social', en: 'No', ta: 'இல்லை' },
    { icon: '✋', cat: 'Social', en: 'Please wait', ta: 'தயவுசெய்து காத்திருங்கள்' },
    { icon: '💡', cat: 'Social', en: 'I understand', ta: 'எனக்குப் புரிகிறது' },
    { icon: '❓', cat: 'Social', en: 'I do not understand', ta: 'எனக்குப் புரியவில்லை' },
    { icon: '🐢', cat: 'Social', en: 'Please speak slowly', ta: 'தயவுசெய்து மெதுவாகப் பேசுங்கள்' },
    { icon: '🔁', cat: 'Social', en: 'Please repeat that', ta: 'தயவுசெய்து மீண்டும் சொல்லுங்கள்' },
    { icon: '✍️', cat: 'Social', en: 'Please write it down', ta: 'தயவுசெய்து எழுதிக் காட்டுங்கள்' }
  ];

  /* Extra phrase pairs used only for offline translation and suggestions */
  const EXTRA_PHRASES = [
    { en: 'Good morning', ta: 'காலை வணக்கம்' },
    { en: 'Good night', ta: 'இனிய இரவு' },
    { en: 'How are you?', ta: 'நீங்கள் எப்படி இருக்கிறீர்கள்?' },
    { en: 'I am fine', ta: 'நான் நலமாக இருக்கிறேன்' },
    { en: 'What is your name?', ta: 'உங்கள் பெயர் என்ன?' },
    { en: 'Please come here', ta: 'தயவுசெய்து இங்கே வாருங்கள்' },
    { en: 'Where is the hospital?', ta: 'மருத்துவமனை எங்கே?' },
    { en: 'Where is the washroom?', ta: 'கழிவறை எங்கே?' },
    { en: 'I am happy', ta: 'நான் மகிழ்ச்சியாக இருக்கிறேன்' },
    { en: 'I need help', ta: 'எனக்கு உதவி தேவை' },
    { en: 'I cannot hear you', ta: 'எனக்கு நீங்கள் சொல்வது கேட்கவில்லை' },
    { en: 'I cannot speak', ta: 'என்னால் பேச முடியாது' }
  ];

  let cards = store.get('cards2', null) || DEFAULT_CARDS.map((c) => ({ ...c }));
  let activeCat = 'All';

  /* =====================================================
     9. SUGGESTIONS (phrase prediction)
     ===================================================== */
  const sugEl = $('suggestions');

  function suggestionPool() {
    const seen = new Set();
    const pool = [];
    const add = (t) => {
      const key = (t || '').trim().toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); pool.push(t.trim()); }
    };
    hist.filter((h) => h.type === 'spoken').slice(0, 30).forEach((h) => add(h.text));
    cards.forEach((c) => { add(c.en); add(c.ta); });
    EXTRA_PHRASES.forEach((p) => { add(p.en); add(p.ta); });
    return pool;
  }

  function updateSuggestions() {
    sugEl.innerHTML = '';
    const q = messageEl.value.trim().toLowerCase();
    if (q.length < 2) return;
    const starts = [];
    const contains = [];
    suggestionPool().forEach((p) => {
      const low = p.toLowerCase();
      if (low === q) return;
      if (low.indexOf(q) === 0) starts.push(p);
      else if (low.indexOf(q) > 0) contains.push(p);
    });
    starts.concat(contains).slice(0, 5).forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p;
      b.addEventListener('click', () => { messageEl.value = p; updateSuggestions(); messageEl.focus(); });
      sugEl.appendChild(b);
    });
  }

  /* =====================================================
     10. RESULT BOX: SIMPLIFY · TRANSLATE · AI
     ===================================================== */
  const resultBox = $('resultBox');
  let resultText = '';
  let resultLang = '';

  function showResult(title, text, lang) {
    resultText = text; resultLang = lang || '';
    $('resultTitle').textContent = title;
    $('resultOut').textContent = text;
    const actionable = !!lang;
    $('btnResSpeak').hidden = !actionable;
    $('btnResUse').hidden = !actionable;
    resultBox.hidden = false;
    $('resultOut').focus();
  }

  $('btnResSpeak').addEventListener('click', () => speak(resultText.replace(/\n/g, ' '), resultLang));
  $('btnResUse').addEventListener('click', () => { messageEl.value = resultText; resultBox.hidden = true; updateSuggestions(); messageEl.focus(); say('Message replaced.'); });
  $('btnResClose').addEventListener('click', () => { resultBox.hidden = true; messageEl.focus(); });

  /* ----- Offline simplifier (English) ----- */
  const WORDS = {
    utilize: 'use', utilise: 'use', utilization: 'use', purchase: 'buy', commence: 'start',
    terminate: 'end', assist: 'help', assistance: 'help', require: 'need', requires: 'needs',
    required: 'needed', approximately: 'about', additional: 'more', sufficient: 'enough',
    demonstrate: 'show', obtain: 'get', inform: 'tell', consume: 'eat', reside: 'live',
    residence: 'home', attempt: 'try', subsequently: 'then', therefore: 'so', consequently: 'so',
    however: 'but', numerous: 'many', individuals: 'people', individual: 'person',
    regarding: 'about', facilitate: 'help', immediately: 'now', currently: 'now',
    medication: 'medicine', physician: 'doctor', administer: 'give', discontinue: 'stop',
    difficulty: 'trouble', modify: 'change', verify: 'check', indicate: 'show',
    provide: 'give', request: 'ask', transportation: 'transport', employment: 'job',
    prohibited: 'not allowed', ensure: 'make sure', unable: 'not able', commencement: 'start',
    accommodate: 'fit', magnitude: 'size', beneficial: 'helpful', endeavour: 'try', endeavor: 'try'
  };

  const PHRASES = [
    ['in order to', 'to'], ['due to the fact that', 'because'], ['in the event that', 'if'],
    ['prior to', 'before'], ['a number of', 'some'], ['as a result of', 'because of'],
    ['with regard to', 'about'], ['at this point in time', 'now'], ['in spite of the fact that', 'although'],
    ['in addition to', 'and'], ['on a daily basis', 'every day']
  ];

  function matchCase(source, replacement) {
    const first = source.charAt(0);
    return first !== first.toLowerCase() ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
  }
  const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

  function simplify(text) {
    let t = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    PHRASES.forEach(([from, to]) => {
      t = t.replace(new RegExp('\\b' + from + '\\b', 'gi'), (m) => matchCase(m, to));
    });
    t = t.replace(/\b[A-Za-z]+\b/g, (w) => {
      const r = WORDS[w.toLowerCase()];
      return r ? matchCase(w, r) : w;
    });

    const lines = [];
    t.split(/(?<=[.!?])\s+/).forEach((s) => {
      s = s.trim();
      if (!s) return;
      const endMark = (s.match(/[.!?]$/) || ['.'])[0];
      let parts = [s];
      if (wordCount(s) > 12) {
        parts = s.split(/;\s*|,\s+(?:and|but)\s+|,\s+/).map((p) => p.trim()).filter(Boolean);
        const merged = [];
        parts.forEach((p) => {
          if (merged.length && wordCount(p) < 3) merged[merged.length - 1] += ', ' + p;
          else merged.push(p);
        });
        parts = merged;
      }
      parts.forEach((p, idx) => {
        let line = p.replace(/[.!?]+$/, '').trim();
        if (!line) return;
        line = line.charAt(0).toUpperCase() + line.slice(1);
        lines.push(line + (idx === parts.length - 1 ? endMark : '.'));
      });
    });
    return lines;
  }

  $('btnSimplify').addEventListener('click', () => {
    const text = messageEl.value.trim();
    if (!text) { say('Type a message first, then press Simplify.'); messageEl.focus(); return; }
    if (hasTamil(text)) {
      showResult('Simplify', 'Offline simplify works for English text. For Tamil, add an AI key in Settings and use "AI improve".', '');
      return;
    }
    const lines = simplify(text);
    showResult('Simpler version', lines.join('\n'), resolveLang(text));
    say(lines.length + (lines.length === 1 ? ' sentence' : ' short sentences'));
  });

  /* ----- Offline translation (phrase bank) ----- */
  const normPhrase = (s) => s.toLowerCase().replace(/[.!?,।\s]+$/g, '').replace(/\s+/g, ' ').trim();

  function lookupTranslation(text) {
    const n = normPhrase(text);
    const all = cards.filter((c) => c.en && c.ta).concat(EXTRA_PHRASES);
    for (let i = 0; i < all.length; i++) {
      if (normPhrase(all[i].en) === n) return { text: all[i].ta, lang: 'ta-IN' };
      if (normPhrase(all[i].ta) === n) return { text: all[i].en, lang: 'en-IN' };
    }
    return null;
  }

  /* ----- Optional AI (Anthropic API, called straight from the browser for demos) ----- */
  const aiKey = () => store.get('aiKey', '');

  async function callAI(system, userText) {
    const key = aiKey();
    if (!key) throw new Error('Add your API key in Settings first.');
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: store.get('aiModel', 'claude-haiku-5-5'),
          max_tokens: 500,
          system,
          messages: [{ role: 'user', content: userText }]
        })
      });
    } catch (e) {
      throw new Error('Could not reach the AI service. Check your internet connection.');
    }
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = (j.error && j.error.message) || ''; } catch (e) { /* ignore */ }
      throw new Error('AI request failed (' + res.status + '). ' + detail);
    }
    const data = await res.json();
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  }

  async function withBusy(button, task) {
    const label = button.textContent;
    button.disabled = true; button.textContent = 'Working…';
    try { await task(); }
    catch (e) { say(e.message || 'Something went wrong.'); }
    finally { button.disabled = false; button.textContent = label; }
  }

  $('btnTranslate').addEventListener('click', () => {
    const text = messageEl.value.trim();
    if (!text) { say('Type a message first, then press Translate.'); messageEl.focus(); return; }
    const toTamil = !hasTamil(text);
    const hit = lookupTranslation(text);
    if (hit) { showResult('Translation', hit.text, hit.lang); return; }
    if (aiKey()) {
      withBusy($('btnTranslate'), async () => {
        const target = toTamil ? 'Tamil' : 'English';
        const out = await callAI('You are a careful translator for an accessibility app. Translate the user message into simple, natural ' + target + '. Reply with the translation only.', text);
        showResult('Translation (AI)', out, toTamil ? 'ta-IN' : 'en-IN');
      });
      return;
    }
    showResult('Translation not found', 'Offline translation covers the picture-card phrases and common phrases. To translate any sentence, add an AI key in Settings.', '');
  });

  $('btnAI').addEventListener('click', () => {
    const text = messageEl.value.trim();
    if (!text) { say('Type a message first.'); messageEl.focus(); return; }
    withBusy($('btnAI'), async () => {
      const out = await callAI('You help people with speech, hearing or reading difficulties communicate. Rewrite the message as clear, polite, short sentences in the same language as the message. Keep the meaning. Reply with the rewritten message only.', text);
      showResult('AI improved message', out, hasTamil(text) ? 'ta-IN' : resolveLang(text));
    });
  });

  function refreshAIButton() { $('btnAI').hidden = !aiKey(); }

  /* =====================================================
     11. PICTURE CARDS UI
     ===================================================== */
  const gridEl = $('cardGrid');
  const catChipsEl = $('catChips');
  const searchEl = $('cardSearch');

  function cardView(c) {
    const useTa = (isTamilMode() && !!c.ta) || !c.en;
    return { text: useTa ? c.ta : c.en, alt: useTa ? c.en : c.ta, lang: useTa ? 'ta-IN' : 'en-IN' };
  }

  function renderCats() {
    catChipsEl.innerHTML = '';
    CATEGORIES.forEach((cat) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = cat;
      b.setAttribute('aria-pressed', String(cat === activeCat));
      b.addEventListener('click', () => { activeCat = cat; renderCats(); renderCards(); });
      catChipsEl.appendChild(b);
    });
  }

  function renderCards() {
    gridEl.innerHTML = '';
    const q = searchEl.value.trim().toLowerCase();
    let shown = 0;
    cards.forEach((c, i) => {
      const cat = c.cat || 'Daily';
      if (activeCat !== 'All' && cat !== activeCat) return;
      if (q && (c.en || '').toLowerCase().indexOf(q) === -1 && (c.ta || '').toLowerCase().indexOf(q) === -1) return;
      shown++;
      const view = cardView(c);
      const wrap = document.createElement('div');
      wrap.className = 'card-wrap';

      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'card'; btn.dataset.cat = cat;
      const icon = document.createElement('span');
      icon.className = 'icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = c.icon || '⭐';
      const label = document.createElement('span');
      label.className = 'label'; label.textContent = view.text;
      btn.append(icon, label);
      if (view.alt) {
        const alt = document.createElement('span');
        alt.className = 'alt'; alt.textContent = view.alt;
        btn.append(alt);
      }
      btn.addEventListener('click', () => {
        speak(view.text, view.lang);
        messageEl.value = (messageEl.value.trim() ? messageEl.value.trim() + ' ' : '') + view.text;
        updateSuggestions();
      });

      const del = document.createElement('button');
      del.type = 'button'; del.className = 'card-del'; del.textContent = '×';
      del.setAttribute('aria-label', 'Remove card: ' + view.text);
      del.addEventListener('click', () => {
        cards.splice(i, 1);
        store.set('cards2', cards);
        renderCards();
        say('Card removed.');
      });

      wrap.append(btn, del);
      gridEl.appendChild(wrap);
    });
    $('cardEmpty').hidden = shown > 0;
  }

  searchEl.addEventListener('input', renderCards);

  $('cardForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const icon = $('cardIcon').value.trim() || '⭐';
    const en = $('cardEn').value.trim();
    const ta = $('cardTa').value.trim();
    if (!en && !ta) { say('Please type the card text in English or Tamil.'); $('cardEn').focus(); return; }
    cards.push({ icon, cat: $('cardCat').value, en, ta });
    store.set('cards2', cards);
    $('cardForm').reset();
    renderCards();
    say('Card added.');
  });

  $('btnResetCards').addEventListener('click', () => {
    if (!window.confirm('Restore the default cards? Your custom cards will be removed.')) return;
    cards = DEFAULT_CARDS.map((c) => ({ ...c }));
    store.set('cards2', cards);
    renderCards();
    say('Default cards restored.');
  });

  /* =====================================================
     12. LISTEN (speech to text)
     ===================================================== */
  const transcriptEl = $('transcript');
  const listenBtn = $('btnListen');
  const listenNote = $('listenNote');
  const listenLang = $('listenLang');
  let recognition = null;
  let listening = false;
  let finalText = '';
  let interimText = '';

  listenLang.value = store.get('listenLang', 'en-IN');
  listenLang.addEventListener('change', () => {
    store.set('listenLang', listenLang.value);
    if (listening) { stopListening(); startListening(); }
  });

  function renderTranscript() {
    transcriptEl.textContent = '';
    if (finalText) transcriptEl.appendChild(document.createTextNode(finalText));
    if (interimText) {
      const s = document.createElement('span');
      s.className = 'interim'; s.textContent = interimText;
      transcriptEl.appendChild(s);
    }
  }

  function setListeningUI(on) {
    listenBtn.textContent = on ? 'Stop listening' : 'Start listening';
    listenBtn.setAttribute('aria-pressed', String(on));
  }

  function startListening() {
    if (!SpeechRec) {
      listenNote.textContent = 'Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.';
      listenNote.hidden = false;
      return;
    }
    if (synth) synth.cancel();
    recognition = new SpeechRec();
    recognition.lang = listenLang.value;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript.trim() + ' ';
        else interimText += r[0].transcript;
      }
      renderTranscript();
    };

    recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      listening = false; setListeningUI(false);
      const messages = {
        'not-allowed': 'Microphone is blocked. Allow microphone access in the browser address bar and try again.',
        'service-not-allowed': 'Microphone is blocked. Allow microphone access and try again.',
        'audio-capture': 'No microphone was found.',
        'network': 'Speech recognition needs an internet connection.',
        'language-not-supported': 'This language is not supported for listening in this browser.'
      };
      const msg = messages[e.error] || 'Listening stopped: ' + e.error;
      listenNote.textContent = msg; listenNote.hidden = false; say(msg);
    };

    recognition.onend = () => {
      interimText = ''; renderTranscript();
      if (listening) { try { recognition.start(); } catch (err) { listening = false; setListeningUI(false); } }
      else setListeningUI(false);
    };

    try {
      listenNote.hidden = true;
      recognition.start();
      listening = true; setListeningUI(true); say('Listening…');
    } catch (err) {
      say('Could not start listening. Please try again.');
    }
  }

  function stopListening() {
    listening = false;
    if (recognition) { try { recognition.stop(); } catch (e) { /* ignore */ } }
    setListeningUI(false);
  }

  listenBtn.addEventListener('click', () => {
    if (listening) { stopListening(); say('Stopped listening.'); } else startListening();
  });
  $('btnTClear').addEventListener('click', () => { finalText = ''; interimText = ''; renderTranscript(); say('Cleared.'); });
  $('btnTCopy').addEventListener('click', () => copyText(finalText));
  $('btnTSend').addEventListener('click', () => {
    if (!finalText.trim()) { say('Nothing to send yet.'); return; }
    messageEl.value = finalText.trim(); updateSuggestions();
    goTo('communicate'); messageEl.focus();
    say('Added to your message.');
  });
  $('btnTSpeak').addEventListener('click', () => speak(finalText, listenLang.value));
  $('btnTSave').addEventListener('click', () => {
    if (!finalText.trim()) { say('Nothing to save yet.'); return; }
    addHistory('heard', finalText, listenLang.value);
    say('Saved to history.');
  });

  if (!SpeechRec) {
    listenNote.textContent = 'Speech recognition works in Google Chrome and Microsoft Edge. This browser does not support it.';
    listenNote.hidden = false;
  }

  /* =====================================================
     13. HISTORY
     ===================================================== */
  function renderHistory() {
    const list = $('histList');
    list.innerHTML = '';
    const spoken = hist.filter((h) => h.type === 'spoken').length;
    const heard = hist.filter((h) => h.type === 'heard').length;
    $('histStats').textContent = hist.length
      ? hist.length + ' saved: ' + spoken + ' spoken, ' + heard + ' heard. Only the latest 100 are kept, on this device.'
      : 'No messages yet. Messages you speak, and conversations you save from Listen, appear here.';

    hist.forEach((h) => {
      const li = document.createElement('li');
      li.className = 'hist-item';

      const meta = document.createElement('div');
      meta.className = 'hist-meta';
      const tag = document.createElement('span');
      tag.className = 'tag ' + h.type; tag.textContent = h.type === 'heard' ? 'Heard' : 'Spoken';
      const when = document.createElement('time');
      when.textContent = new Date(h.ts).toLocaleString();
      meta.append(tag, when);

      const text = document.createElement('div');
      text.className = 'hist-text'; text.textContent = h.text;

      const actions = document.createElement('div');
      actions.className = 'hist-actions';
      const bSpeak = document.createElement('button');
      bSpeak.type = 'button'; bSpeak.className = 'btn'; bSpeak.textContent = 'Speak again';
      bSpeak.addEventListener('click', () => speak(h.text, h.lang || undefined, { log: false }));
      const bUse = document.createElement('button');
      bUse.type = 'button'; bUse.className = 'btn'; bUse.textContent = 'Use as message';
      bUse.addEventListener('click', () => { messageEl.value = h.text; updateSuggestions(); goTo('communicate'); messageEl.focus(); });
      const bCopy = document.createElement('button');
      bCopy.type = 'button'; bCopy.className = 'btn'; bCopy.textContent = 'Copy';
      bCopy.addEventListener('click', () => copyText(h.text));
      const bDel = document.createElement('button');
      bDel.type = 'button'; bDel.className = 'btn'; bDel.textContent = 'Delete';
      bDel.addEventListener('click', () => {
        hist = hist.filter((x) => x.id !== h.id);
        store.set('history', hist); renderHistory(); say('Deleted.');
      });
      actions.append(bSpeak, bUse, bCopy, bDel);

      li.append(meta, text, actions);
      list.appendChild(li);
    });
  }

  $('btnHistExport').addEventListener('click', () => {
    if (!hist.length) { say('Nothing to download yet.'); return; }
    const lines = hist.slice().reverse().map((h) => '[' + new Date(h.ts).toLocaleString() + '] ' + (h.type === 'heard' ? 'HEARD' : 'SPOKEN') + ': ' + h.text);
    downloadText('accessbridge-history.txt', 'AccessBridge AI conversation history\n\n' + lines.join('\n') + '\n');
    say('Downloaded.');
  });
  $('btnHistPrint').addEventListener('click', () => window.print());
  $('btnHistClear').addEventListener('click', () => {
    if (!hist.length) return;
    if (!window.confirm('Delete all saved messages?')) return;
    hist = []; store.set('history', hist); renderHistory(); say('History cleared.');
  });

  /* =====================================================
     14. EMERGENCY
     ===================================================== */
  function sosMessage() {
    return isTamilMode()
      ? { text: 'எனக்கு உதவி தேவை. தயவுசெய்து உதவுங்கள்.', lang: 'ta-IN' }
      : { text: 'I need help. Please help me.', lang: 'en-IN' };
  }

  $('btnSOS').addEventListener('click', () => {
    const m = sosMessage();
    showBig(m.text, m.lang);
    speak(m.text, m.lang);
  });
  $('btnSosShow').addEventListener('click', () => { const m = sosMessage(); showBig(m.text, m.lang); });

  const ecName = $('ecName');
  const ecPhone = $('ecPhone');
  const ecCall = $('ecCall');
  const ecSms = $('ecSms');
  const ecWa = $('ecWa');
  const alertEl = $('alertText');
  const locStatus = $('locStatus');
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  let myPlace = null;

  /* 10 digits -> +91, 0xxxxxxxxxx -> +91, 91xxxxxxxxxx -> +91..., keeps +country numbers */
  function normalizePhone(raw) {
    let d = (raw || '').replace(/[^\d+]/g, '');
    if (d.charAt(0) === '+') return '+' + d.slice(1).replace(/\+/g, '');
    d = d.replace(/\+/g, '');
    if (d.indexOf('00') === 0) return '+' + d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') return '+91' + d.slice(1);
    if (d.length === 12 && d.indexOf('91') === 0) return '+' + d;
    if (d.length === 10) return '+91' + d;
    return d;
  }
  const phoneOk = (p) => /^\+?\d{10,15}$/.test(p);

  function buildAlert() {
    let t = 'EMERGENCY! I need help. எனக்கு உதவி தேவை.';
    if (myPlace) t += ' My location: https://maps.google.com/?q=' + myPlace.lat + ',' + myPlace.lng;
    return t;
  }

  function setLink(a, href) {
    if (href) { a.href = href; a.setAttribute('aria-disabled', 'false'); }
    else { a.href = '#emergency'; a.setAttribute('aria-disabled', 'true'); }
  }

  function refreshContactUI() {
    const phone = normalizePhone(ecPhone.value);
    const ok = phoneOk(phone);
    const body = encodeURIComponent(alertEl.value);
    setLink(ecCall, ok ? 'tel:' + phone : '');
    setLink(ecSms, ok ? 'sms:' + phone + (isIOS ? '&' : '?') + 'body=' + body : '');
    setLink(ecWa, ok ? 'https://wa.me/' + phone.replace('+', '') + '?text=' + body : '');
  }

  (function loadContact() {
    const c = store.get('contact', { name: '', phone: '' });
    ecName.value = c.name || ''; ecPhone.value = c.phone || '';
    alertEl.value = buildAlert();
    refreshContactUI();
  })();

  ecPhone.addEventListener('input', refreshContactUI);
  alertEl.addEventListener('input', refreshContactUI);

  [ecCall, ecSms, ecWa].forEach((a) => {
    a.addEventListener('click', (e) => {
      if (a.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        say('Enter a valid mobile number first (10 digits, or with country code).');
        ecPhone.focus();
      }
    });
  });

  $('btnEcSave').addEventListener('click', () => {
    const phone = normalizePhone(ecPhone.value);
    if (!phoneOk(phone)) { say('Please enter a valid mobile number (10 digits, or with country code).'); ecPhone.focus(); return; }
    store.set('contact', { name: ecName.value.trim(), phone: ecPhone.value.trim() });
    refreshContactUI();
    say('Contact saved: ' + phone);
  });

  $('btnGetLoc').addEventListener('click', () => {
    if (!navigator.geolocation) { locStatus.textContent = 'Location is not supported in this browser.'; return; }
    locStatus.textContent = 'Getting your location…';
    navigator.geolocation.getCurrentPosition(
      (p) => {
        myPlace = { lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) };
        alertEl.value = buildAlert();
        locStatus.textContent = 'Location added to the message.';
        refreshContactUI();
      },
      (err) => {
        locStatus.textContent = err.code === 1
          ? 'Location permission was denied. Allow location in the browser address bar and try again.'
          : 'Could not get your location. Location works on https:// or http://localhost, and needs GPS or internet.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  $('btnShare').addEventListener('click', async () => {
    const text = alertEl.value.trim();
    if (!text) { say('The alert message is empty.'); return; }
    if (navigator.share) {
      try { await navigator.share({ title: 'AccessBridge AI alert', text }); }
      catch (e) { /* user cancelled */ }
    } else {
      copyText(text);
      say('Sharing is not supported here, so the message was copied.');
    }
  });
  $('btnAlertCopy').addEventListener('click', () => copyText(alertEl.value));

  /* =====================================================
     15. SETTINGS
     ===================================================== */
  $('aiKey').value = aiKey();
  $('aiModel').value = store.get('aiModel', 'claude-haiku-5-5');

  $('btnAISave').addEventListener('click', () => {
    const key = $('aiKey').value.trim();
    const model = $('aiModel').value.trim() || 'claude-haiku-5-5';
    if (!key) { say('Paste an API key first.'); return; }
    store.set('aiKey', key); store.set('aiModel', model);
    refreshAIButton(); say('AI assist is on. Find "AI improve" on the Communicate page.');
  });
  $('btnAIClear').addEventListener('click', () => {
    store.remove('aiKey'); $('aiKey').value = ''; refreshAIButton(); say('API key removed.');
  });
  $('btnResetAll').addEventListener('click', () => {
    if (!window.confirm('Erase all saved data (history, cards, contact, settings) from this browser?')) return;
    store.clearAll();
    location.hash = 'communicate';
    location.reload();
  });

  /* =====================================================
     16. KEYBOARD SHORTCUTS
     ===================================================== */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!overlayEl.hidden) closeBig();
      else if (synth && synth.speaking) stopSpeaking();
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-6]$/.test(e.key)) {
      e.preventDefault();
      goTo(VIEWS[parseInt(e.key, 10) - 1]);
    }
  });

  /* =====================================================
     17. START
     ===================================================== */
  applyDisplay();
  updateNet();
  renderCats();
  renderCards();
  refreshAIButton();
  showView(location.hash.replace('#', '') || 'communicate');

  /* Offline support (works when opened through http://localhost or https) */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ }); });
  }
})();
