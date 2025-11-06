import React, { useMemo, useState } from "react";
import "./index.css";

/** ===== CONFIG =====
 * Replace with your live Web App URL after deploying the Apps Script.
 */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzJen1rMh3SCbSGs6iA_VJnLppoCRbcDjjNi8X-eaz1eEf6OJLCplDIoD3WSSa4T2b1/exec";
const SEARCH_API_URL = WEB_APP_URL;
const SUBMIT_API_URL = WEB_APP_URL;
const UPI_ID = "gautam.sekhar11@okhdfcbank";
/** ================== */

export default function App() {
  return (
    <div className="app">
      <AnimatedBackground />
      <main className="container">
        <Header />
        <Portal />
        <Footer />
      </main>
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="bg-scene">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="grid-line" />
    </div>
  );
}

function Header() {
  return (
    <header className="hero fade-in">
      <h1 className="title">City Jersey Portal</h1>
      <p className="subtitle">Search → Auto-fill → Copy UPI → Confirm → Submit</p>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <small>© {new Date().getFullYear()} Jersey Portal • Built with care</small>
    </footer>
  );
}

function Portal() {
  const [showModal, setShowModal] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [record, setRecord] = useState(null);
  const [upperSize, setUpperSize] = useState("");
  const [shortsSize, setShortsSize] = useState("");
  const [paid, setPaid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState("");

  const isDigits = useMemo(() => /^\d+$/.test(query.trim()), [query]);
  const isLetters = useMemo(() => /^[A-Za-z ]+$/.test(query.trim()), [query]);

  function notify(msg, ms = 2000) {
    setToast(String(msg));
    setTimeout(() => setToast(""), ms);
  }

  async function handleLookup() {
    setError("");
    setCandidates([]);
    const q = query.trim();
    if (!q) return setError("Please enter your phone or name.");
    if (!(isDigits || isLetters))
      return setError("Use only digits (phone) or letters/spaces (name).");

    setLoading(true);
    try {
      const url = new URL(SEARCH_API_URL);
      url.searchParams.set("q", q);
      const res = await Promise.race([
        fetch(url.toString(), { cache: "no-store" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), 4500)
        ),
      ]);
      const data = await res.json();

      if (!data?.ok) throw new Error(data?.error || "Lookup failed.");

      // Exact match found
      if (data.record) {
        setRecord({
          name: data.record.name || "",
          phone: String(data.record.phone || ""),
          jerseyName: data.record.jerseyName || data.record.name || "",
          jerseyNumber: String(data.record.jerseyNumber ?? ""),
        });
        setShowModal(false);
        return;
      }

      // No exact; show candidate list for names
      if (Array.isArray(data.candidates) && data.candidates.length) {
        setCandidates(data.candidates);
        return; // keep modal open showing list
      }

      // Nothing
      setError("No match found.");
    } catch (e) {
      setError(e.message || "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function pickCandidate(c) {
    // Only show name+phone in UI, but we keep jersey fields from API for autofill.
    setRecord({
      name: c.name || "",
      phone: String(c.phone || ""),
      jerseyName: c.jerseyName || c.name || "",
      jerseyNumber: String(c.jerseyNumber ?? ""),
    });
    setShowModal(false);
    setCandidates([]);
  }

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      notify("UPI id copied");
    } catch {
      notify("Copy failed — long press to copy");
    }
  }

  async function handleSubmit() {
    if (!record) return;
    const payload = {
      name: record.name,
      phone: record.phone,
      jerseyName: record.jerseyName,
      jerseyNumber: String(record.jerseyNumber ?? ""),
      upperSize,
      shortsSize,
      paid,
    };

    // Local backup always
    try {
      const key = "jersey:submissions";
      const all = JSON.parse(localStorage.getItem(key) || "[]");
      all.push({ ...payload, _ts: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(all));
    } catch {}

    try {
      const res = await fetch(SUBMIT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoid preflight
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Submit failed");

      setSubmitted(true);
      notify(`Saved! Updated FormData row: ${data.updatedRow || "n/a"}`);
    } catch (e) {
      notify(`Saved locally. Server error: ${e.message || "Failed to fetch"}`, 3000);
    }
  }

  const canSubmit = !!record && !!upperSize && !!shortsSize && !!paid;

  return (
    <>
      {toast && <div className="toast">{toast}</div>}

      {/* Modal (search or candidates) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card pop-in">
            <div className="modal-header">
              <h2 className="modal-title">Enter Details</h2>
              <p className="modal-sub">Phone (digits) or Name (letters)</p>
            </div>

            {/* Search box (hidden when showing candidates) */}
            {candidates.length === 0 && (
              <>
                <input
                  className="input big"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. 9876543210  or  Lebron"
                />
                {error && <p className="error">{error}</p>}
                <button className="btn btn-primary wide" onClick={handleLookup} disabled={loading}>
                  {loading ? "Searching…" : "Continue"}
                </button>
                <div className="modal-hint">
                  {isDigits ? "Interpreting as phone number" : isLetters ? "Interpreting as name" : ""}
                </div>
              </>
            )}

            {/* Candidate list (appears when no exact name match) */}
            {candidates.length > 0 && (
              <>
                <div className="list">
                  {candidates.map((c, i) => (
                    <button
                      key={i}
                      className="list-item"
                      onClick={() => pickCandidate(c)}
                      title="Tap to select"
                    >
                      <span className="list-name">{c.name}</span>
                      <span className="list-phone">{c.phone}</span>
                    </button>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="btn btn-accent" onClick={() => setCandidates([])}>
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main card */}
      <section className="card glass rise-in">
        <h3 className="card-title">
          {record ? `Welcome, ${record.name}` : "Lookup not done yet"}
        </h3>

        <div className="field-grid">
          <Field label="Name on Jersey" value={record?.jerseyName || "—"} />
          <Field label="Number on Jersey" value={record?.jerseyNumber || "—"} />
        </div>

        <div className="field-grid">
          <Labeled>
            <label className="label">Jersey Size</label>
            <select className="select" value={upperSize} onChange={(e) => setUpperSize(e.target.value)}>
              <option value="">Select…</option>
              {["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Labeled>

        <Labeled>
            <label className="label">Shorts Size</label>
            <select className="select" value={shortsSize} onChange={(e) => setShortsSize(e.target.value)}>
              <option value="">Select…</option>
              {["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Labeled>
        </div>

        <div className="actions">
          <button className="btn btn-accent" onClick={copyUpi}>
            Copy UPI ID ({UPI_ID})
          </button>
        </div>

        <div className="confirm">
          <label className="checkbox">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            <span>Payment Made</span>
          </label>
        </div>

        <div className="actions">
          <button className="btn btn-cta" disabled={!canSubmit || submitted} onClick={handleSubmit}>
            {submitted ? "Submitted ✔" : "Submit Details"}
          </button>
        </div>
      </section>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
function Labeled({ children }) {
  return <div className="field">{children}</div>;
}
