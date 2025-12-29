import { CameraControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { degToRad, MathUtils } from "three/src/math/MathUtils.js";

export const CameraManager = () => {
  const controls = useThree((state) => state.controls);
  const locked = useRef(false);

  useEffect(() => {
    if (!controls) return;

    controls.setLookAt(0, 2.5, 15, 0, 2, 0);

    const onStart = () => {
      locked.current = true;
    };

    const onEnd = () => {
      locked.current = false;
    };
    controls.addEventListener("controlstart", onStart);
    controls.addEventListener("controlend", onEnd);

    return () => {
      if (!controls) return;
      controls.removeEventListener("controlstart", onStart);
      controls.removeEventListener("controlend", onEnd);
    };
  }, [controls]);

  useFrame((state, delta) => {
    const lockedDelta = Math.max(Math.min(delta, 0.5), 0); // Prevent jump when resuming from tab switch
    const t = state.clock.elapsedTime;
    if (locked.current) return;
    if (!controls) return;
    controls.polarAngle = MathUtils.lerp(
      controls.polarAngle,
      Math.PI / 2 + Math.sin(t / 3) * degToRad(1),
      lockedDelta
    );
    controls.azimuthAngle = MathUtils.lerp(
      controls.azimuthAngle,
      Math.cos(t / 4) * degToRad(2),
      lockedDelta
    );
  });

  return (
    <CameraControls
      makeDefault
      maxAzimuthAngle={degToRad(8)}
      minAzimuthAngle={degToRad(-16)}
      minPolarAngle={degToRad(90)}
      maxPolarAngle={degToRad(100)}
      maxDistance={20}
      minDistance={5}
    />
  );
};