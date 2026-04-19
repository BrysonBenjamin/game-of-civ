"use client";

import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@/store/useGameStore";
import { Terminal, Send } from "lucide-react";

export default function VibeConsole() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const log = useGameStore((s) => s.state.log);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // TODO: pipe to Vercel AI SDK for natural-language command parsing
    setInput("");
  };

  return (
    <div className="pointer-events-auto absolute bottom-20 right-4 z-20">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2 ml-auto flex items-center gap-2 rounded-lg bg-indigo-600/80 px-3 py-2 text-xs text-white backdrop-blur-md transition hover:bg-indigo-500"
      >
        <Terminal className="h-4 w-4" />
        {open ? "Close Console" : "Vibe Console"}
      </button>

      {/* Panel */}
      {open && (
        <div className="flex h-64 w-96 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/80 backdrop-blur-lg">
          {/* Log */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed text-green-400"
          >
            {log.map((entry, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {entry}
              </p>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex border-t border-white/10"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command…"
              className="flex-1 bg-transparent px-4 py-2 text-xs text-white outline-none placeholder:text-white/30"
            />
            <button
              type="submit"
              className="px-3 text-white/60 transition hover:text-white"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
