import { useRef, Suspense, lazy } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, useGLTF, ContactShadows } from "@react-three/drei";
import { type Group } from "three";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useInView } from "framer-motion";

const MODELS = {
  camera: "/models/camera.glb",
  laptop: "/models/laptop.glb",
  gamepad: "/models/gamepad.glb",
} as const;

Object.values(MODELS).forEach((path) => useGLTF.preload(path));

function CameraModel() {
  const { scene } = useGLTF(MODELS.camera);
  return <primitive object={scene.clone()} />;
}

function LaptopModel() {
  const { scene } = useGLTF(MODELS.laptop);
  return <primitive object={scene.clone()} />;
}

function GamepadModel() {
  const { scene } = useGLTF(MODELS.gamepad);
  return <primitive object={scene.clone()} />;
}

function FloatingObject({
  children,
  position,
  scale = 1,
  rotation = [0, 0, 0],
}: {
  children: React.ReactNode;
  position: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
}) {
  const ref = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      ref.current.rotation.y = rotation[1] + Math.sin(t * 0.1) * 0.087;
    }
  });

  return (
    <Float
      speed={0.5}
      rotationIntensity={0.05}
      floatIntensity={0.3}
      floatingRange={[-0.05, 0.05]}
    >
      <group ref={ref} position={position} scale={scale} rotation={rotation}>
        {children}
      </group>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3, 3, 3]}
        intensity={1}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight args={["#ffffff", "#f0f0f0", 0.3]} />

      <FloatingObject
        position={[-1.2, 0.8, -0.5]}
        scale={0.6}
        rotation={[0, 0.3, 0]}
      >
        <CameraModel />
      </FloatingObject>

      <FloatingObject
        position={[0, 0, 0]}
        scale={0.8}
        rotation={[0, -0.1, 0]}
      >
        <LaptopModel />
      </FloatingObject>

      <FloatingObject
        position={[1.2, -0.8, -0.3]}
        scale={0.7}
        rotation={[0, 0.2, 0]}
      >
        <GamepadModel />
      </FloatingObject>

      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.15}
        scale={8}
        blur={3}
        far={3}
      />
    </>
  );
}

function SceneFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="grid grid-cols-2 gap-3 w-3/4 max-w-xs">
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
    </div>
  );
}

const LazyScene = lazy(() =>
  Promise.resolve({
    default: function SceneWrapper() {
      return (
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          style={{ background: "transparent" }}
          shadows
        >
          <Scene />
        </Canvas>
      );
    },
  })
);

interface FloatingRentalObjectsProps {
  className?: string;
}

const FloatingRentalObjects = ({ className }: FloatingRentalObjectsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { margin: "100px" });

  return (
    <div ref={containerRef} className={className}>
      <ErrorBoundary fallback={<SceneFallback />}>
        <Suspense fallback={<SceneFallback />}>
          {isInView && <LazyScene />}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export { FloatingRentalObjects };
