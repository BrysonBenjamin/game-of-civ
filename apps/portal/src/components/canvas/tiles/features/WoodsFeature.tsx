"use client";

interface WoodsFeatureProps {
  elevation: number;
}

export default function WoodsFeature({ elevation }: WoodsFeatureProps) {
  return (
    <mesh position={[0, elevation + 0.15, 0]}>
      <coneGeometry args={[0.15, 0.3, 4]} />
      <meshStandardMaterial color="#1a5c1a" flatShading />
    </mesh>
  );
}
