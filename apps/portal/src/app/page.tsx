import { Gamepad2, ChevronRight, Compass, Globe, Server } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden flex flex-col items-center justify-center selection:bg-blue-500/30">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-blue-900/20 rounded-full blur-[100px] md:blur-[150px] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-[400px] md:w-[500px] h-[400px] md:h-[500px] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none"></div>

      <main className="relative z-10 w-full max-w-6xl mx-auto px-6 py-24 flex flex-col items-center text-center">
        {/* Alpha Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 text-sm text-slate-300 font-medium mb-12 shadow-lg backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Alpha Engine Live
        </div>

        {/* Hero Title */}
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-8 font-[family-name:var(--font-cinzel)] text-transparent bg-clip-text bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 drop-shadow-sm">
          Game of Civ
        </h1>
        
        {/* Hero Description */}
        <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mb-14 font-sans leading-relaxed">
          Experience the next generation of 4X strategy. Build empires, forge alliances, and conquer the world in a stunning, high-performance WebGPU simulation.
        </p>

        {/* CTA */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-500 group-hover:duration-200"></div>
          <a 
            href="http://localhost:5173"
            className="relative inline-flex items-center gap-4 px-10 py-5 bg-slate-50 text-slate-950 rounded-2xl font-bold text-[1.1rem] hover:bg-white transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
          >
            <Gamepad2 className="w-7 h-7 transition-transform group-hover:-rotate-12 text-blue-600" />
            <span>Launch Engine</span>
            <ChevronRight className="w-6 h-6 ml-2 opacity-50 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
          </a>
        </div>

        {/* Features Grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 p-8 rounded-3xl hover:bg-slate-800/60 transition-colors group">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Globe className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-slate-200 font-sans tracking-tight">Infinite Worlds</h3>
            <p className="text-slate-400 leading-relaxed font-sans">Procedurally generated hex maps featuring rich biomes, dynamic resources, and strategic elevation layers.</p>
          </div>
          
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 p-8 rounded-3xl hover:bg-slate-800/60 transition-colors group">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <Server className="w-7 h-7 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-slate-200 font-sans tracking-tight">Deterministic Core</h3>
            <p className="text-slate-400 leading-relaxed font-sans">Headless simulation architecture ensuring seamless replayability, synchronized multiplayer, and pure logic fidelity.</p>
          </div>
          
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 p-8 rounded-3xl hover:bg-slate-800/60 transition-colors group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-slate-200 font-sans tracking-tight">Next-Gen Engine</h3>
            <p className="text-slate-400 leading-relaxed font-sans">Powered by WebGPU, our rendering pipeline seamlessly handles tens of thousands of dynamic entities at 60+ FPS.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
