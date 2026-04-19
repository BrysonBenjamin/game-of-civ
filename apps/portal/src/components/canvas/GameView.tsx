"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/useGameStore";
import type { InitMapEvent } from "@civ/protocol";

export default function GameView() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const state = useGameStore((s) => s.state);

  // Initial Sync: Push the entire baseline hex array to WebGPU
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    
    const iframeWindow = iframeRef.current.contentWindow;
    
    // Simulate robust dispatch once iframe is locked via postMessage boundary
    const payload: InitMapEvent = {
      type: "INIT_MAP",
      width: state.mapSize.width,
      height: state.mapSize.height,
      mapData: state.map as any,
      // Pass the entire unit array for Entity layer binding
      units: state.units,
    };
    
    iframeWindow.postMessage(payload, "http://localhost:5174");
    console.log("Portal executing INIT_MAP handshake into WebGPU Engine...", payload);
  }, [state.map, state.units]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <iframe
        ref={iframeRef}
        src="http://localhost:5174"
        className="w-full h-full border-none"
        title="WebGPU Engine Core"
      />
    </div>
  );
}
