import React, { useState, useEffect, useCallback, useRef } from 'react';
import Webcam from 'react-webcam';
import { useSelector } from 'react-redux';
import './Styles/Translator.css';
import './Styles/SignModal.css';
import './Styles/DatasetUpload.css';



const API_BASE = "https://modelsigntranslator.onrender.com";
const BACKEND_URL = "https://backpfe-production-789f.up.railway.app";

const VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: 'user',
};

const IMAGES_PER_CAPTURE = 3;
const CAPTURE_INTERVAL_MS = 300;

// Helper functions
function normalizeLabel(value) {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

function dataURLtoBlob(dataURL) {
  const [header, data] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

async function uploadWithLimit(uploadFns, limit = 2) {
  const results = [];
  const errors = [];

  for (let i = 0; i < uploadFns.length; i += limit) {
    const batch = uploadFns.slice(i, i + limit);
    const batchResults = await Promise.allSettled(batch.map(fn => fn()));

    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({ index: i + idx, error: result.reason });
      }
    });
  }

  return { results, errors };
}

/* ── Sign Images Modal ─────────────────────────────────────── */
function SignModal({ sign, onClose }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/signs/${sign}/images`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        const imgs = Array.isArray(data.images) ? data.images : [];
        setImages(imgs);
        if (imgs.length > 0) setSelected(imgs[0]);
      })
      .catch(() => setError('Impossible de charger les images.'))
      .finally(() => setLoading(false));
  }, [sign]);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="sd-modal-backdrop" onClick={handleBackdrop}>
      <div className="sd-modal">
        <div className="sd-modal__header">
          <h3 className="sd-modal__title">{sign.replace(/_/g, ' ')}</h3>
          <button className="sd-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="sd-modal__body">
          {loading && (
            <div className="sd-modal__loading">Chargement des images...</div>
          )}

          {!loading && error && (
            <div className="sd-modal__error">{error}</div>
          )}

          {!loading && !error && images.length === 0 && (
            <div className="sd-modal__empty">Aucune image disponible pour ce signe.</div>
          )}

          {!loading && !error && images.length > 0 && (
            <>
              {/* Main image */}
              <div className="sd-modal__main-img-wrap">
                <img
                  className="sd-modal__main-img"
                  src={selected}
                  alt={sign}
                />
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="sd-modal__thumbs">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`${sign}-${i}`}
                      className={`sd-modal__thumb ${selected === img ? 'sd-modal__thumb--active' : ''}`}
                      onClick={() => setSelected(img)}
                    />
                  ))}
                </div>
              )}

              <p className="sd-modal__count">{images.length} image{images.length > 1 ? 's' : ''}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sign Card Component ── */
function SignCard({ sign, isNew, onClick }) {
  return (
    <li
      className={`sd-card${isNew ? ' sd-card--new' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      title={`Voir les images de "${sign.replace(/_/g, ' ')}"`}
    >
      <div className="sd-card__media">
        <svg className="sd-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="m15 10 4.553-2.07A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.895L15 14" />
          <rect x="2" y="6" width="13" height="12" rx="2" />
        </svg>
        {isNew && <span className="sd-card__new-badge">New ✓</span>}
        <span className="sd-card__view-hint">👁 Voir</span>
      </div>
      <div className="sd-card__footer">
        <span className="sd-card__label">{sign.replace(/_/g, ' ')}</span>
      </div>
    </li>
  );
}

/* ── Contributor Panel ── */
function ContributorPanel({ onContribute }) {
  const [label, setLabel] = useState('');
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const webcamRef = useRef(null);
  const intervalRef = useRef(null);
  const framesRef = useRef([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

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
    if (!webcam) {
      setCamError('Camera not ready.');
      return;
    }

    framesRef.current = [];
    setCaptured([]);
    setProgress(0);
    setErrorMsg('');
    setStatus('idle');
    setCapturing(true);

    intervalRef.current = setInterval(() => {
      try {
        const screenshot = webcam.getScreenshot({ width: 640, height: 480 });

        if (screenshot) {
          framesRef.current.push(screenshot);
          setProgress(framesRef.current.length);
        }

        if (framesRef.current.length >= IMAGES_PER_CAPTURE) {
          clearCapture();
          setCaptured([...framesRef.current]);
          setCapturing(false);
        }
      } catch (err) {
        console.error('Capture error:', err);
        clearCapture();
        setCapturing(false);
        setErrorMsg('Failed to capture image');
      }
    }, CAPTURE_INTERVAL_MS);
  }, [clearCapture]);

  const handleUpload = async () => {
    if (captured.length === 0) {
      setStatus('error');
      setErrorMsg('Please capture images first.');
      return;
    }

    if (!label.trim()) {
      setStatus('error');
      setErrorMsg('Please enter a word or phrase.');
      return;
    }

    const normalizedLabel = normalizeLabel(label);
    setStatus('uploading');
    setErrorMsg('');

    try {
      const uploadFns = captured.map((dataURL, i) => async () => {
        const fd = new FormData();
        fd.append('label', normalizedLabel);
        fd.append('uploadedAt', new Date().toISOString());
        const blob = dataURLtoBlob(dataURL);
        fd.append('image', blob, `capture_${Date.now()}_${i}.jpg`);

        const response = await fetch(`${API_BASE}/api/signs/contribute`, {
          method: 'POST',
          body: fd,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        return { success: true, index: i };
      });

      const { results, errors } = await uploadWithLimit(uploadFns);

      if (errors.length > 0 && results.length === 0) {
        throw new Error(`Upload failed: ${errors[0].error.message}`);
      }

      onContribute(normalizedLabel);
      setStatus('success');
      setLabel('');
      discard();

      // FIXED: removed stale closure bug — no longer checks `status` inside setTimeout
      setTimeout(() => {
        if (isMountedRef.current) {
          setStatus('idle');
        }
      }, 3000);

    } catch (err) {
      console.error('Upload error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Upload failed. Please try again.');
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
          onUserMediaError={() => { setCamReady(false); setCamError('Unable to access camera.'); }}
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
              ✓ {captured.length} image(s) captured
            </div>
          )}
        </div>
      </div>

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
          {status === 'uploading' ? 'Uploading...' : `Upload ${captured.length} Image(s)`}
        </button>
      </div>

      {status === 'success' && (
        <div className="sd-status sd-status--success">✓ Sign uploaded successfully!</div>
      )}
      {status === 'error' && errorMsg && (
        <div className="sd-status sd-status--error">⚠️ {errorMsg}</div>
      )}
    </aside>
  );
}

/* ── Dataset Submit Panel ── */
function DatasetSubmitPanel() {
  const { token } = useSelector((state) => state.user);
  const [form, setForm] = useState({ name: '', description: '', type: 'csv' });
  const [images, setImages] = useState([]);       // File objects
  const [previews, setPreviews] = useState([]);   // base64 previews
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Max 10 images
    const newFiles = [...images, ...files].slice(0, 10);
    setImages(newFiles);

    // Generate previews
    const readers = newFiles.map((file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      })
    );
    Promise.all(readers).then(setPreviews);
  };

  const removeImage = (index) => {
    const newFiles = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImages(newFiles);
    setPreviews(newPreviews);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setStatus('error');
      setErrorMsg('Le nom du dataset est requis.');
      return;
    }

    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      setStatus('error');
      setErrorMsg('Vous devez être connecté pour soumettre un dataset.');
      return;
    }

    const authHeader = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
    setStatus('loading');
    setErrorMsg('');

    try {
      // Use FormData to support file uploads
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('description', form.description.trim());
      fd.append('type', form.type);
      images.forEach((file) => fd.append('images', file));

      const response = await fetch(`${BACKEND_URL}/dataset/add`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: fd,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Erreur lors de la soumission');

      setStatus('success');
      setForm({ name: '', description: '', type: 'csv' });
      setImages([]);
      setPreviews([]);
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Erreur réseau');
    }
  };

  return (
    <aside className="sd-panel sd-panel--dataset">
      <h2 className="sd-panel__title">📦 Submit a Dataset</h2>
      <p className="sd-panel__desc">Soumettez un dataset pour validation par l'administrateur.</p>

      <div className="sd-field">
        <label htmlFor="ds-name">Nom du dataset *</label>
        <input
          id="ds-name" name="name" type="text"
          placeholder="ex: Dataset LSF Alphabet"
          value={form.name}
          onChange={handleChange}
          disabled={status === 'loading'}
        />
      </div>

      <div className="sd-field">
        <label htmlFor="ds-desc">Description</label>
        <textarea
          id="ds-desc" name="description" rows={3}
          placeholder="Décrivez le contenu du dataset..."
          value={form.description}
          onChange={handleChange}
          disabled={status === 'loading'}
          style={{ resize: 'vertical', minHeight: 72 }}
        />
      </div>

      <div className="sd-field">
        <label htmlFor="ds-type">Type</label>
        <select
          id="ds-type" name="type"
          value={form.type}
          onChange={handleChange}
          disabled={status === 'loading'}
          className="sd-select"
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
          <option value="images">Images</option>
          <option value="audio">Audio</option>
          <option value="text">Texte</option>
        </select>
      </div>

      {/* ── Image uploader ── */}
      <div className="sd-field">
        <label>Images (max 10)</label>
        <div
          className="sd-upload-zone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles({ target: { files: e.dataTransfer.files } });
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFiles}
            disabled={status === 'loading'}
          />
          {previews.length === 0 ? (
            <div className="sd-upload-zone__placeholder">
              <span style={{ fontSize: 28 }}>🖼️</span>
              <p>Glissez des images ici ou <strong>cliquez pour choisir</strong></p>
              <p style={{ fontSize: 12, opacity: 0.5 }}>JPG, PNG, WEBP — max 20 MB par fichier</p>
            </div>
          ) : (
            <div className="sd-upload-previews">
              {previews.map((src, i) => (
                <div key={i} className="sd-upload-preview">
                  <img src={src} alt={`preview-${i}`} />
                  <button
                    className="sd-upload-preview__remove"
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    type="button"
                  >✕</button>
                </div>
              ))}
              {images.length < 10 && (
                <div className="sd-upload-preview sd-upload-preview--add">
                  <span>＋</span>
                </div>
              )}
            </div>
          )}
        </div>
        {images.length > 0 && (
          <p className="sd-upload-count">{images.length} image{images.length > 1 ? 's' : ''} sélectionnée{images.length > 1 ? 's' : ''}</p>
        )}
      </div>

      <div className="sd-actions sd-actions--single">
        <button
          className="sd-btn sd-btn--primary"
          onClick={handleSubmit}
          disabled={status === 'loading' || !form.name.trim()}
        >
          {status === 'loading' ? 'Soumission en cours...' : '📤 Soumettre le dataset'}
        </button>
      </div>

      {status === 'success' && (
        <div className="sd-status sd-status--success">✅ Dataset soumis ! En attente de validation.</div>
      )}
      {status === 'error' && errorMsg && (
        <div className="sd-status sd-status--error">❌ {errorMsg}</div>
      )}
    </aside>
  );
}

/* ── Main Translator Component ── */
const Translator = () => {
  const [signs, setSigns] = useState(['HELLO', 'THANK_YOU', 'YES', 'NO', 'PLEASE']);
  const [query, setQuery] = useState('');
  const [newSigns, setNewSigns] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePanel, setActivePanel] = useState('contribute');
  const [selectedSign, setSelectedSign] = useState(null);

  // FIXED: extracted fetchSigns so it can be called on retry as well
  const fetchSigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/signs`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      let signsArray = [];
      if (data.signs && Array.isArray(data.signs)) {
        signsArray = data.signs;
      } else if (data.data && Array.isArray(data.data)) {
        signsArray = data.data;
      } else if (Array.isArray(data)) {
        signsArray = data;
      }

      if (signsArray.length > 0) {
        setSigns(signsArray);
      }
    } catch (err) {
      console.error('Failed to fetch signs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSigns();
  }, [fetchSigns]);

  const handleContribute = (newLabel) => {
    setSigns(prev => {
      if (prev.includes(newLabel)) return prev;
      return [...prev, newLabel];
    });
    setNewSigns(prev => new Set([...prev, newLabel]));
    setTimeout(() => {
      setNewSigns(prev => {
        const next = new Set(prev);
        next.delete(newLabel);
        return next;
      });
    }, 4000);
  };

  const filtered = signs.filter(sign =>
    sign.toLowerCase().includes(query.toLowerCase())
  );

  if (error && !loading) {
    return (
      <div className="sd-root">
        <div className="sd-error-container" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>Unable to Load Signs</h2>
          <p style={{ color: '#dc2626' }}>{error}</p>
          {/* FIXED: retry without full page reload */}
          <button
            onClick={fetchSigns}
            className="sd-btn sd-btn--primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sd-root">
      <div className="sd-shell">
        <header className="sd-topbar">
          <div>
            <h1 className="sd-title">Sign Dictionary Translator</h1>
            <p className="sd-subtitle">Search available signs and contribute new recordings.</p>
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

        <div className="sd-tabs">
          <button
            className={`sd-tab ${activePanel === 'contribute' ? 'sd-tab--active' : ''}`}
            onClick={() => setActivePanel('contribute')}
          >
            🎥 Contribute a Sign
          </button>
          <button
            className={`sd-tab ${activePanel === 'dataset' ? 'sd-tab--active' : ''}`}
            onClick={() => setActivePanel('dataset')}
          >
            📦 Submit a Dataset
          </button>
        </div>

        <div className="sd-layout">
          {activePanel === 'contribute'
            ? <ContributorPanel onContribute={handleContribute} />
            : <DatasetSubmitPanel />
          }

          <section className="sd-library">
            <div className="sd-library__head">
              <h2 className="sd-panel__title">Sign Library</h2>
              <p className="sd-library__meta">
                {loading ? 'Loading signs...' : `${filtered.length} sign(s) found`}
              </p>
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
                    onClick={() => setSelectedSign(sign)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {selectedSign && (
        <SignModal
          sign={selectedSign}
          onClose={() => setSelectedSign(null)}
        />
      )}
    </div>
  );
};

export default Translator;