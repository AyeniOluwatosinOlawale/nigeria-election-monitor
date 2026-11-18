"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface QueueJob {
  id: string;
  file_name: string | null;
  state_code: string | null;
  lga_name: string | null;
  election_id: string | null;
  status: "pending" | "processing" | "done" | "failed" | "flagged";
  over_voted: boolean;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

function StatusPill({ status }: { status: QueueJob["status"] }) {
  const styles: Record<QueueJob["status"], string> = {
    pending:    "bg-gray-100 text-gray-600",
    processing: "bg-blue-100 text-blue-700",
    done:       "bg-green-100 text-green-700",
    failed:     "bg-red-100 text-red-700",
    flagged:    "bg-orange-100 text-orange-700",
  };
  const labels: Record<QueueJob["status"], string> = {
    pending:    "Pending",
    processing: "Processing",
    done:       "Done",
    failed:     "Failed",
    flagged:    "Over-voted",
  };
  const dots: Record<QueueJob["status"], string> = {
    pending:    "bg-gray-400",
    processing: "bg-blue-500 animate-pulse",
    done:       "bg-green-500",
    failed:     "bg-red-500",
    flagged:    "bg-orange-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dots[status]}`} />
      {labels[status]}
    </span>
  );
}

export default function QueueMonitor() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Load recent jobs
  useEffect(() => {
    supabase
      .from("ocr_queue")
      .select("id,file_name,state_code,lga_name,election_id,status,over_voted,error,created_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setJobs((data as QueueJob[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("ocr_queue_monitor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ocr_queue" },
        (payload) => {
          const row = payload.new as QueueJob;
          if (!row?.id) return;
          setJobs((prev) => {
            const exists = prev.some((j) => j.id === row.id);
            if (exists) return prev.map((j) => (j.id === row.id ? row : j));
            return [row, ...prev].slice(0, 100);
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const stats = useMemo(() => ({
    pending:    jobs.filter((j) => j.status === "pending").length,
    processing: jobs.filter((j) => j.status === "processing").length,
    done:       jobs.filter((j) => j.status === "done").length,
    failed:     jobs.filter((j) => j.status === "failed").length,
    flagged:    jobs.filter((j) => j.status === "flagged").length,
  }), [jobs]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-center min-h-[120px]">
        <span className="text-gray-400 text-sm">Loading queue…</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-nigeria-green/5 border-b border-nigeria-green/10 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-nigeria-dark font-bold text-lg">OCR Processing Queue</h2>
          <p className="text-gray-500 text-sm">Live status of uploaded result sheets</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100">
        {[
          { label: "Pending",    count: stats.pending,    color: "text-gray-700" },
          { label: "Processing", count: stats.processing, color: "text-blue-700" },
          { label: "Done",       count: stats.done,       color: "text-green-700" },
          { label: "Flagged",    count: stats.flagged,    color: "text-orange-700" },
          { label: "Failed",     count: stats.failed,     color: "text-red-700" },
        ].map(({ label, count, color }) => (
          <div key={label} className="px-4 py-3 text-center">
            <div className={`text-xl font-black ${color}`}>{count}</div>
            <div className="text-xs text-gray-400 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Job list */}
      {jobs.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm font-medium">No sheets uploaded yet</p>
          <p className="text-xs mt-1">Result sheets are sourced from the INEC portal — inecelectionresults.ng</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wide">File</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-500 uppercase tracking-wide">State / LGA</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-500 uppercase tracking-wide">Election</th>
                <th className="text-center px-3 py-2.5 font-bold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wide">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className={job.status === "flagged" ? "bg-orange-50" : job.status === "failed" ? "bg-red-50" : "hover:bg-gray-50"}
                >
                  <td className="px-4 py-2.5 font-mono text-gray-700 max-w-[180px] truncate">
                    {job.file_name ?? job.id.slice(0, 8)}
                    {job.over_voted && (
                      <span className="ml-1 text-orange-600 font-bold" title="Over-voted">⚠</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {job.state_code ?? "—"}
                    {job.lga_name && <span className="text-gray-400"> / {job.lga_name}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {job.election_id?.replace(/_/g, " ") ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusPill status={job.status} />
                    {job.error && (
                      <div className="text-red-500 text-[10px] mt-0.5 max-w-[160px] truncate" title={job.error}>
                        {job.error}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">
                    {new Date(job.created_at).toLocaleTimeString("en-NG", {
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
