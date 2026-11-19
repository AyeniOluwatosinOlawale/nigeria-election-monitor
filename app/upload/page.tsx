"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

// ─── Static data ──────────────────────────────────────────────────────────────

const ELECTION_TYPES = [
  { id: "presidential",  label: "Presidential" },
  { id: "senate",        label: "Senate" },
  { id: "house_reps",    label: "House of Reps" },
  { id: "gubernatorial", label: "Gubernatorial" },
];

const YEARS = [2023, 2027] as const;

const STATES = [
  { code: "AB", name: "Abia" },        { code: "AD", name: "Adamawa" },
  { code: "AK", name: "Akwa Ibom" },   { code: "AN", name: "Anambra" },
  { code: "BA", name: "Bauchi" },      { code: "BY", name: "Bayelsa" },
  { code: "BE", name: "Benue" },       { code: "BO", name: "Borno" },
  { code: "CR", name: "Cross River" }, { code: "DL", name: "Delta" },
  { code: "EB", name: "Ebonyi" },      { code: "ED", name: "Edo" },
  { code: "EK", name: "Ekiti" },       { code: "EN", name: "Enugu" },
  { code: "FC", name: "FCT Abuja" },   { code: "GO", name: "Gombe" },
  { code: "IM", name: "Imo" },         { code: "JI", name: "Jigawa" },
  { code: "KD", name: "Kaduna" },      { code: "KN", name: "Kano" },
  { code: "KT", name: "Katsina" },     { code: "KB", name: "Kebbi" },
  { code: "KO", name: "Kogi" },        { code: "KW", name: "Kwara" },
  { code: "LA", name: "Lagos" },       { code: "NA", name: "Nasarawa" },
  { code: "NI", name: "Niger" },       { code: "OG", name: "Ogun" },
  { code: "ON", name: "Ondo" },        { code: "OS", name: "Osun" },
  { code: "OY", name: "Oyo" },         { code: "PL", name: "Plateau" },
  { code: "RV", name: "Rivers" },      { code: "SO", name: "Sokoto" },
  { code: "TA", name: "Taraba" },      { code: "YO", name: "Yobe" },
  { code: "ZA", name: "Zamfara" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadItem {
  file: File;
  id: string;
  status: "queued" | "uploading" | "done" | "error";
  jobId?: string;
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [electionType, setElectionType] = useState("presidential");
  const [year, setYear]                 = useState<2023 | 2027>(2023);
  const [stateCode, setStateCode]       = useState("");
  const [lgaName, setLgaName]           = useState("");
  const [wardName, setWardName]         = useState("");
  const [puCode, setPuCode]             = useState("");
  const [items, setItems]               = useState<UploadItem[]>([]);
  const [uploading, setUploading]       = useState(false);
  const [dragOver, setDragOver]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const electionId = `${electionType}_${year}`;

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...arr.map((file) => ({
        file,
        id: `${Date.now()}-${Math.random()}`,
        status: "queued" as const,
      })),
    ]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  async function uploadAll() {
    if (!stateCode) { alert("Select a state first"); return; }
    const queued = items.filter((i) => i.status === "queued");
    if (queued.length === 0) return;

    setUploading(true);

    for (const item of queued) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: "uploading" } : i));

      const fd = new FormData();
      fd.append("file",         item.file);
      fd.append("election_id",  electionId);
      fd.append("state_code",   stateCode);
      if (lgaName)  fd.append("lga_name",  lgaName);
      if (wardName) fd.append("ward_name", wardName);
      if (puCode)   fd.append("pu_code",   puCode);

      try {
        const res  = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        setItems((prev) => prev.map((i) => i.id === item.id
          ? { ...i, status: "done", jobId: json.job_id }
          : i
        ));
      } catch (err) {
        setItems((prev) => prev.map((i) => i.id === item.id
          ? { ...i, status: "error", error: (err as Error).message }
          : i
        ));
      }
    }

    setUploading(false);
  }

  const queuedCount   = items.filter((i) => i.status === "queued").length;
  const doneCount     = items.filter((i) => i.status === "done").length;
  const errorCount    = items.filter((i) => i.status === "error").length;

  return (
    <div className="min-h-screen bg-[#F0FAF4]">
      {/* Header */}
      <header className="bg-[#008751] shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-xl">Upload Result Sheets</h1>
            <p className="text-white/70 text-xs mt-0.5">INEC IREV image → OCR queue</p>
          </div>
          <Link href="/" className="text-white/80 hover:text-white text-sm font-semibold">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Metadata form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-bold text-gray-800 text-base">Sheet Metadata</h2>
          <p className="text-xs text-gray-500">Set these before uploading. All sheets in this batch share the same election and state.</p>

          {/* Election type + year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Election Type</label>
              <select
                value={electionType}
                onChange={(e) => setElectionType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {ELECTION_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value) as 2023 | 2027)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* State */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">State <span className="text-red-500">*</span></label>
            <select
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Select State —</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">LGA (optional)</label>
              <input
                type="text"
                value={lgaName}
                onChange={(e) => setLgaName(e.target.value)}
                placeholder="e.g. Ikeja"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ward (optional)</label>
              <input
                type="text"
                value={wardName}
                onChange={(e) => setWardName(e.target.value)}
                placeholder="e.g. Ward 01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">PU Code (optional)</label>
              <input
                type="text"
                value={puCode}
                onChange={(e) => setPuCode(e.target.value)}
                placeholder="e.g. PU-001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Election ID preview */}
          <div className="bg-gray-50 rounded-lg px-4 py-2 text-xs text-gray-500">
            Election ID: <span className="font-mono font-semibold text-gray-700">{electionId}</span>
            {stateCode && <> &nbsp;·&nbsp; State: <span className="font-mono font-semibold text-gray-700">{stateCode}</span></>}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={[
            "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors",
            dragOver ? "border-[#008751] bg-[#F0FAF4]" : "border-gray-300 bg-white hover:border-[#008751]/50",
          ].join(" ")}
        >
          <div className="text-4xl mb-3">📄</div>
          <p className="font-semibold text-gray-700 text-sm">
            Drop result sheet images here, or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP — up to 20 MB each — multiple files OK</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-bold text-gray-700">
                {items.length} file{items.length !== 1 ? "s" : ""}
                {doneCount > 0 && <span className="text-green-600 ml-2">· {doneCount} queued</span>}
                {errorCount > 0 && <span className="text-red-600 ml-2">· {errorCount} failed</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setItems([])}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2 py-1"
                >
                  Clear all
                </button>
                <button
                  onClick={uploadAll}
                  disabled={uploading || queuedCount === 0 || !stateCode}
                  className={[
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-colors",
                    uploading || queuedCount === 0 || !stateCode
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#008751] text-white hover:bg-[#006b40]",
                  ].join(" ")}
                >
                  {uploading ? "Uploading…" : `Upload ${queuedCount} sheet${queuedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="text-lg shrink-0">
                    {item.status === "done"      && "✅"}
                    {item.status === "error"     && "❌"}
                    {item.status === "uploading" && "⏳"}
                    {item.status === "queued"    && "📄"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{item.file.name}</div>
                    <div className="text-xs text-gray-400">
                      {(item.file.size / 1024).toFixed(0)} KB
                      {item.jobId  && <span className="text-green-600 ml-2">Job {item.jobId.slice(0, 8)}…</span>}
                      {item.error  && <span className="text-red-500 ml-2">{item.error}</span>}
                    </div>
                  </div>
                  <div className={[
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    item.status === "done"      ? "bg-green-100 text-green-700" :
                    item.status === "error"     ? "bg-red-100 text-red-700" :
                    item.status === "uploading" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-500",
                  ].join(" ")}>
                    {item.status === "done" ? "Queued" : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">How it works</p>
          <p>1. Select the election type, year, and state for this batch of sheets.</p>
          <p>2. Drop or browse for INEC IREV result sheet images (from inecelectionresults.ng).</p>
          <p>3. Click Upload — each image goes into the OCR queue.</p>
          <p>4. The Railway OCR worker picks them up, extracts vote counts, and writes results to the dashboard automatically.</p>
        </div>

      </main>
    </div>
  );
}
