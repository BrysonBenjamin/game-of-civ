'use client';

import dynamic from 'next/dynamic';

const Scene = dynamic(() => import('@/components/Scene').then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="block w-full flex-1 bg-[#001F3F]" />,
});

export function GameCanvas() {
  return <Scene />;
}
