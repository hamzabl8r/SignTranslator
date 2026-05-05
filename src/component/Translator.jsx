import React, { useState, useEffect, useCallback, useRef } from 'react';
import Webcam from 'react-webcam';
import './Styles/Translator.css';

const API_BASE = 'https://zen-footing-depravity.ngrok-free.dev';

const VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: 'user',
};

const IMAGES_PER_CAPTURE = 5;      // how many frames to grab per burst
const CAPTURE_INTERVAL_MS = 200;   // ms between each frame

function normalizeLabel(value) {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

/* ── Sign Card ─────────────────────────────────────────────── */
function SignCard({ sign, isNew }) {
  const label = typeof sign === 'string' ? sign : sign?.label ?? '';

  return (
    <li className={`sd-card${isNew ? ' sd-card--new' : ''}`}>
      <div className="sd-card__media">
        <svg
          className="sd-card__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 10 4.553-2.07A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.895L15 14" />
          <rect x="2" y="6" width="13" height="12" rx="2" />
        </svg>

        {isNew && <span className="sd-card__new-badge">New ✓</span>}
      </div>

      <div className="sd-card__footer">
        <span className="sd-card__label">{label.replace(/_/g, ' ')}</span>
      </div>
    </li>
  );
}

/* ── Contributor Panel ─────────────────────────────────────── */
function ContributorPanel({ onContribute }) {
  const [label, setLabel] = useState('');
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState([]); // array of base64 strings
  const [progress, setProgress] = useState(0);  // 0..IMAGES_PER_CAPTURE
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const webcamRef = useRef(null);
  const intervalRef = useRef(null);
  const framesRef = useRef([]);

  const clearCapture = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => () => clearCapture(), [clearCapture]);

  const discard = useCallback(() => {
    clearCapture();
    framesRef.current = [];
    setCaptured([]);
    setProgress(0);
    setStatus('idle');
    setErrorMsg('');
    setCapturing(false);
  }, [clearCapture]);

  const startCapture = useCallback(() => {
    const webcam = webcamRef.current;
    if (!webcam) { setCamError('Camera not ready.'); return; }

    framesRef.current = [];
    setCaptured([]);
    setProgress(0);
    setErrorMsg('');
    setStatus('idle');
    setCapturing(true);

    intervalRef.current = setInterval(() => {
      const screenshot = webcam.getScreenshot({ width: 640, height: 480 });

      if (screenshot) {
        framesRef.current.push(screenshot);
        setProgress(framesRef.current.length);
      }

      if (framesRef.current.length >= IMAGES_PER_CAPTURE) {
        clearInterval(intervalRef.current);
        setCaptured([...framesRef.current]);
        setCapturing(false);
      }
    }, CAPTURE_INTERVAL_MS);
  }, []);

  // Convert base64 data URL → Blob
  function dataURLtoBlob(dataURL) {
    const [header, data] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  const handleUpload = async () => {
    if (captured.length === 0 || !label.trim()) {
      setStatus('error');
      setErrorMsg('Enter a word and capture images first.');
      return;
    }

    const normalizedLabel = normalizeLabel(label);
    setStatus('uploading');
    setErrorMsg('');

    try {
      // Upload each captured frame as a separate image
      const uploads = captured.map((dataURL, i) => {
        const fd = new FormData();
        fd.append('label', normalizedLabel);
        fd.append('uploadedAt', new Date().toISOString());
        const blob = dataURLtoBlob(dataURL);
        fd.append('image', blob, `capture_${i}.jpg`);
        return fetch(`${API_BASE}/api/signs/contribute`, {
          method: 'POST',
          body: fd,
        });
      });

      const responses = await Promise.all(uploads);
      const failed = responses.filter((r) => !r.ok);

      if (failed.length > 0) {
        throw new Error(`${failed.length} image(s) failed to upload.`);
      }

      onContribute(normalizedLabel);
      setStatus('success');
      setLabel('');
      discard();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Upload failed');
    }
  };

  return (
    <aside className="sd-panel">
      <h2 className="sd-panel__title">Contribute a Sign</h2>
      <p className="sd-panel__desc">
        Capture {IMAGES_PER_CAPTURE} images of your hand sign to add to the dataset.
      </p>

      <div className="sd-field">
        <label htmlFor="sign-label">Word or Phrase</label>
        <input
          id="sign-label"
          type="text"
          placeholder="e.g. HELLO, THANK_YOU"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={capturing || status === 'uploading'}
        />
      </div>

      <div className="sd-camera">
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored
          screenshotFormat="image/jpeg"
          videoConstraints={VIDEO_CONSTRAINTS}
          className="sd-webcam"
          onUserMedia={() => { setCamReady(true); setCamError(''); }}
          onUserMediaError={() => { setCamReady(false); setCamError('Unable to access your camera.'); }}
        />

        <div className="sd-camera__overlay">
          {capturing && (
            <div className="sd-recording-pill">
              <span className="sd-recording-dot" />
              Capturing… {progress}/{IMAGES_PER_CAPTURE}
            </div>
          )}

          {!capturing && captured.length > 0 && (
            <div className="sd-camera__hint sd-camera__hint--success">
              ✓ {captured.length} image{captured.length > 1 ? 's' : ''} captured
            </div>
          )}

          {!capturing && captured.length === 0 && camReady && (
            <div className="sd-camera__hint">Camera ready</div>
          )}
        </div>
      </div>

      {/* Thumbnail strip */}
      {captured.length > 0 && (
        <div className="sd-thumbs">
          {captured.map((src, i) => (
            <img key={i} src={src} alt={`frame-${i}`} className="sd-thumb" />
          ))}
        </div>
      )}

      {camError && <div className="sd-status sd-status--error">{camError}</div>}

      <div className="sd-actions">
        <button
          type="button"
          className="sd-btn sd-btn--primary"
          onClick={startCapture}
          disabled={!camReady || capturing || status === 'uploading'}
        >
          {captured.length > 0 ? 'Capture Again' : 'Capture Images'}
        </button>

        <button
          type="button"
          className="sd-btn sd-btn--ghost"
          onClick={discard}
          disabled={capturing || captured.length === 0}
        >
          Discard
        </button>
      </div>

      <div className="sd-actions sd-actions--single">
        <button
          type="button"
          className="sd-btn sd-btn--primary"
          onClick={handleUpload}
          disabled={captured.length === 0 || !label.trim() || status === 'uploading'}
        >
          {status === 'uploading' ? 'Uploading...' : `Upload ${captured.length} Image${captured.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {status === 'success' && (
        <div className="sd-status sd-status--success">
          Sign uploaded successfully.
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="sd-status sd-status--error">{errorMsg}</div>
      )}
    </aside>
  );
}

/* ── Main Translator Component ─────────────────────────────── */
const Translator = () => {
  const [signs, setSigns] = useState([]);
  const [query, setQuery] = useState('');
  const [newSigns, setNewSigns] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/signs`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error('Failed to fetch signs'))
      )
      .then((data) => setSigns(Array.isArray(data.signs) ? data.signs : []))
      .catch(() => setSigns([]))
      .finally(() => setLoading(false));
  }, []);

  const handleContribute = (newLabel) => {
    setSigns((prev) => {
      if (prev.includes(newLabel)) return prev;
      return [...prev, newLabel];
    });

    setNewSigns((prev) => new Set([...prev, newLabel]));

    setTimeout(() => {
      setNewSigns((prev) => {
        const next = new Set(prev);
        next.delete(newLabel);
        return next;
      });
    }, 4000);
  };

  const filtered = signs.filter((s) =>
    s.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="sd-root">
      <div className="sd-shell">
        <header className="sd-topbar">
          <div>
            <h1 className="sd-title">Sign Dictionary Translator</h1>
            <p className="sd-subtitle">
              Search available signs and contribute new recordings.
            </p>
          </div>

          <div className="sd-topbar__search">
            <input
              className="sd-search"
              type="search"
              placeholder="Search signs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </header>

        <div className="sd-layout">
          <ContributorPanel onContribute={handleContribute} />

          <section className="sd-library">
            <div className="sd-library__head">
              <div>
                <h2 className="sd-panel__title">Sign Library</h2>
                <p className="sd-library__meta">
                  {loading ? 'Loading signs...' : `${filtered.length} sign(s) found`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="sd-empty">Loading dictionary...</div>
            ) : filtered.length === 0 ? (
              <div className="sd-empty">No matching signs found.</div>
            ) : (
              <ul className="sd-grid">
                {filtered.map((sign) => (
                  <SignCard
                    key={sign}
                    sign={sign}
                    isNew={newSigns.has(sign)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Translator;