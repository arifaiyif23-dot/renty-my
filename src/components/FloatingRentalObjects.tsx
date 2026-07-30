import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial, Environment, ContactShadows } from "@react-three/drei";
import { type Group } from "three";

function CameraLens({ mouse }: { mouse: { x: number; y: number } }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x = mouse.y * 0.1;
      ref.current.rotation.y = mouse.x * 0.1;
    }
  });
  return (
    <group ref={ref}>
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.6, 0.8, 0.4, 32]} />
          <MeshTransmissionMaterial
            backside
            thickness={0.3}
            chromaticAberration={0.1}
            roughness={0.1}
            metalness={0.3}
            ior={1.5}
            color="#5856D6"
          />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <torusGeometry args={[0.55, 0.05, 16, 32]} />
          <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} />
        </mesh>
      </Float>
    </group>
  );
}

function Smartphone({ mouse }: { mouse: { x: number; y: number } }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x = mouse.y * 0.08;
      ref.current.rotation.y = mouse.x * 0.08;
    }
  });
  return (
    <group ref={ref}>
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.5, 1.0, 0.08]} />
          <MeshTransmissionMaterial
            backside
            thickness={0.2}
            chromaticAberration={0.05}
            roughness={0.05}
            metalness={0.2}
            ior={1.5}
            color="#007AFF"
          />
        </mesh>
        <mesh position={[0, -0.4, 0.06]}>
          <circleGeometry args={[0.08, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </Float>
    </group>
  );
}

function CarKey({ mouse }: { mouse: { x: number; y: number } }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x = mouse.y * 0.12;
      ref.current.rotation.y = mouse.x * 0.12;
    }
  });
  return (
    <group ref={ref}>
      <Float speed={1.8} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.3, 0.5, 0.06]} />
          <MeshTransmissionMaterial
            backside
            thickness={0.15}
            chromaticAberration={0.08}
            roughness={0.15}
            metalness={0.4}
            ior={1.4}
            color="#34C759"
          />
        </mesh>
        <mesh position={[0, -0.3, 0.05]}>
          <torusGeometry args={[0.06, 0.02, 8, 16]} />
          <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} />
        </mesh>
      </Float>
    </group>
  );
}

function GamingConsole({ mouse }: { mouse: { x: number; y: number } }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x = mouse.y * 0.09;
      ref.current.rotation.y = mouse.x * 0.09;
    }
  });
  return (
    <group ref={ref}>
      <Float speed={1.3} rotationIntensity={0.25} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.8, 0.15, 0.5]} />
          <MeshTransmissionMaterial
            backside
            thickness={0.2}
            chromaticAberration={0.06}
            roughness={0.1}
            metalness={0.3}
            ior={1.45}
            color="#FF9500"
          />
        </mesh>
        <mesh position={[0.25, 0.08, 0.2]}>
          <boxGeometry args={[0.08, 0.04, 0.08]} />
          <meshStandardMaterial color="#ffffff" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[-0.25, 0.08, 0.2]}>
          <boxGeometry args={[0.08, 0.04, 0.08]} />
          <meshStandardMaterial color="#ffffff" metalness={0.7} roughness={0.3} />
        </mesh>
      </Float>
    </group>
  );
}

interface FloatingRentalObjectsProps {
  className?: string;
}

const FloatingRentalObjects = ({ className }: FloatingRentalObjectsProps) => {
  const mouse = useRef({ x: 0, y: 0 });

  return (
    <div
      className={className}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouse.current = {
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5,
        };
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={1} />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#5856D6" />
        <CameraLens mouse={mouse.current} />
        <Smartphone mouse={mouse.current} />
        <CarKey mouse={mouse.current} />
        <GamingConsole mouse={mouse.current} />
        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.3}
          scale={6}
          blur={2.5}
          far={2}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export { FloatingRentalObjects };
