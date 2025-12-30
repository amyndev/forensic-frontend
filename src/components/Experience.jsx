import { Suspense } from "react";
import { Gltf, Environment, OrbitControls } from "@react-three/drei";
import { Male as MaleAvatar } from "./Male";
import { Female as FemaleAvatar } from "./Female";
import { CameraManager } from "./CameraManager";
import { degToRad } from "three/src/math/MathUtils.js";
import { useControls, folder, button } from "leva";
import lightSettings from "../config/lightSettings.json";
import useChatbot from "../hooks/useChatbot";



// Separate Lights component - only this re-renders when controls change
const Lights = () => {
  // Ambient Light Controls
  const ambient = useControls("Ambient", {
    intensity: { value: lightSettings.ambient.intensity, min: 0, max: 2, step: 0.05 },
    color: lightSettings.ambient.color,
  });

  // Window Light Controls
  const windowLight = useControls("Window Light", {
    intensity: { value: lightSettings.windowLight.intensity, min: 0, max: 5, step: 0.1 },
    color: lightSettings.windowLight.color,
    position: folder({
      x: { value: lightSettings.windowLight.position.x, min: -10, max: 10, step: 0.5 },
      y: { value: lightSettings.windowLight.position.y, min: -10, max: 10, step: 0.5 },
      z: { value: lightSettings.windowLight.position.z, min: -10, max: 15, step: 0.5 },
    }),
  });

  // Lamp Light Controls
  const lampLight = useControls("Lamp Light", {
    intensity: { value: lightSettings.lampLight.intensity, min: 0, max: 10, step: 0.1 },
    color: lightSettings.lampLight.color,
    distance: { value: lightSettings.lampLight.distance, min: 1, max: 30, step: 1 },
    position: folder({
      x: { value: lightSettings.lampLight.position.x, min: -10, max: 10, step: 0.5 },
      y: { value: lightSettings.lampLight.position.y, min: -10, max: 10, step: 0.5 },
      z: { value: lightSettings.lampLight.position.z, min: -10, max: 15, step: 0.5 },
    }),
  });

  // Ceiling Bounce Controls
  const ceilingLight = useControls("Ceiling Bounce", {
    intensity: { value: lightSettings.ceilingLight.intensity, min: 0, max: 3, step: 0.1 },
    color: lightSettings.ceilingLight.color,
    position: folder({
      x: { value: lightSettings.ceilingLight.position.x, min: -10, max: 10, step: 0.5 },
      y: { value: lightSettings.ceilingLight.position.y, min: -10, max: 10, step: 0.5 },
      z: { value: lightSettings.ceilingLight.position.z, min: -10, max: 15, step: 0.5 },
    }),
  });

  // Rim Light Controls
  const rimLight = useControls("Rim Light", {
    intensity: { value: lightSettings.rimLight.intensity, min: 0, max: 5, step: 0.1 },
    color: lightSettings.rimLight.color,
    position: folder({
      x: { value: lightSettings.rimLight.position.x, min: -10, max: 10, step: 0.5 },
      y: { value: lightSettings.rimLight.position.y, min: -10, max: 10, step: 0.5 },
      z: { value: lightSettings.rimLight.position.z, min: -10, max: 15, step: 0.5 },
    }),
  });

  // Export Settings Button
  useControls("Export", {
    "Copy to Clipboard": button(() => {
      const currentSettings = {
        ambient: {
          intensity: ambient.intensity,
          color: ambient.color,
        },
        windowLight: {
          intensity: windowLight.intensity,
          color: windowLight.color,
          position: { x: windowLight.x, y: windowLight.y, z: windowLight.z },
          shadow: lightSettings.windowLight.shadow, // Keep shadow settings
        },
        lampLight: {
          intensity: lampLight.intensity,
          color: lampLight.color,
          distance: lampLight.distance,
          decay: 2,
          position: { x: lampLight.x, y: lampLight.y, z: lampLight.z },
        },
        ceilingLight: {
          intensity: ceilingLight.intensity,
          color: ceilingLight.color,
          position: { x: ceilingLight.x, y: ceilingLight.y, z: ceilingLight.z },
        },
        rimLight: {
          intensity: rimLight.intensity,
          color: rimLight.color,
          position: { x: rimLight.x, y: rimLight.y, z: rimLight.z },
        },
      };
      navigator.clipboard.writeText(JSON.stringify(currentSettings, null, 2));
      alert("Settings copied to clipboard! Paste into lightSettings.json");
    }),
  });

  return (
    <>
      {/* Ambient */}
      <ambientLight intensity={ambient.intensity} color={ambient.color} />

      {/* Window light */}
      <directionalLight
        position={[windowLight.x, windowLight.y, windowLight.z]}
        intensity={windowLight.intensity}
        color={windowLight.color}
        castShadow
        shadow-bias={0.005}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-camera-top={25}
        shadow-camera-right={15}
        shadow-camera-bottom={-25}
        shadow-camera-left={-15}
      />

      {/* Lamp light */}
      <pointLight
        position={[lampLight.x, lampLight.y, lampLight.z]}
        intensity={lampLight.intensity}
        color={lampLight.color}
        distance={lampLight.distance}
        decay={2}
      />

      {/* Ceiling bounce */}
      <directionalLight
        position={[ceilingLight.x, ceilingLight.y, ceilingLight.z]}
        intensity={ceilingLight.intensity}
        color={ceilingLight.color}
      />

      {/* Rim light */}
      <directionalLight
        position={[rimLight.x, rimLight.y, rimLight.z]}
        intensity={rimLight.intensity}
        color={rimLight.color}
      />
    </>
  );
};

export const Experience = () => {
  const currentAvatar = useChatbot((state) => state.currentAvatar);

  return (
    <>
      <CameraManager />
      <OrbitControls />

      {/* Render avatar based on gender selection */}
      <Suspense fallback={null}>
        {currentAvatar === "male" ? (
          <MaleAvatar position={[0, -2, 5]} scale={2} />
        ) : (
          <FemaleAvatar position={[0, -2, 5]} scale={2} />
        )}
      </Suspense>

      <Lights />

      <mesh
        position-z={-5}
        position-y={0.05}
        receiveShadow
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[10, 10]} />
        <shadowMaterial color="#21282a" opacity={0.6} />
      </mesh>

      <Gltf
        position={[0.6, -2.25, 5]}
        rotation={[degToRad(0), degToRad(-30), degToRad(0)]}
        flipSided
        // scale={0.025}
        scale={65}
        src="/models/Office.glb"
      />
    </>
  );
};
