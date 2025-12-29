
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame, useGraph } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshPhysicalMaterial } from "three";
import { lerp } from "three/src/math/MathUtils.js";
import { SkeletonUtils } from "three-stdlib";
import useChatbot from "../hooks/useChatbot";

// Rhubarb mouth shapes mapped to Ready Player Me visemes
const corresponding = {
    A: "viseme_PP",
    B: "viseme_kk",
    C: "viseme_I",
    D: "viseme_aa",
    E: "viseme_O",
    F: "viseme_U",
    G: "viseme_FF",
    H: "viseme_TH",
    X: "viseme_sil",
};

// Avatar configurations
const AVATAR_CONFIG = {
    male: {
        modelPath: "/models/Detective.glb",
        animations: {
            idle: "animations/Idle.fbx",
            offensiveIdle: "animations/Offensive Idle.fbx",
            armStretching: "animations/Arm Stretching.fbx",
            neckStretching: "animations/Neck Stretching.fbx",
            talking: "animations/Talking.fbx",
            talking2: "animations/Talking2.fbx",
        },
    },
    female: {
        modelPath: "/models/Avatar.glb",
        // Will use same animations for now - can be customized later
        animations: {
            idle: "animations/Idle.fbx",
            offensiveIdle: "animations/Offensive Idle.fbx",
            armStretching: "animations/Arm Stretching.fbx",
            neckStretching: "animations/Neck Stretching.fbx",
            talking: "animations/Talking.fbx",
            talking2: "animations/Talking2.fbx",
        },
    },
};

// Animation helpers
const talkingAnimations = ["Talking", "Talking2"];
const idleAnimations = [
    { name: "Idle", weight: 70 },
    { name: "Offensive Idle", weight: 10 },
    { name: "Arm Stretching", weight: 15 },
    { name: "Neck Stretching", weight: 15 },
];

const getRandomAnimation = (anims) => anims[Math.floor(Math.random() * anims.length)];
const getWeightedRandomAnimation = (weighted) => {
    const total = weighted.reduce((sum, a) => sum + a.weight, 0);
    let random = Math.random() * total;
    for (const a of weighted) {
        random -= a.weight;
        if (random <= 0) return a.name;
    }
    return weighted[0].name;
};

/**
 * Generic Avatar component for Male/Female Ready Player Me models.
 * Supports Rhubarb lipsync and configurable animations.
 */
export const GenericAvatar = ({ gender = "male", ...props }) => {
    const config = AVATAR_CONFIG[gender] || AVATAR_CONFIG.male;

    const { scene } = useGLTF(config.modelPath);
    const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
    const { nodes, materials } = useGraph(clone);

    // Load animations
    const { animations: idleAnimation } = useFBX(config.animations.idle);
    const { animations: offensiveIdleAnimation } = useFBX(config.animations.offensiveIdle);
    const { animations: armStretchingAnimation } = useFBX(config.animations.armStretching);
    const { animations: neckStretchingAnimation } = useFBX(config.animations.neckStretching);
    const { animations: talkingAnimation } = useFBX(config.animations.talking);
    const { animations: talkingAnimation2 } = useFBX(config.animations.talking2);

    const animations = useMemo(() => {
        idleAnimation[0].name = "Idle";
        offensiveIdleAnimation[0].name = "Offensive Idle";
        armStretchingAnimation[0].name = "Arm Stretching";
        neckStretchingAnimation[0].name = "Neck Stretching";
        talkingAnimation[0].name = "Talking";
        talkingAnimation2[0].name = "Talking2";
        return [
            idleAnimation[0],
            offensiveIdleAnimation[0],
            armStretchingAnimation[0],
            neckStretchingAnimation[0],
            talkingAnimation[0],
            talkingAnimation2[0],
        ];
    }, [idleAnimation, offensiveIdleAnimation, armStretchingAnimation, neckStretchingAnimation, talkingAnimation, talkingAnimation2]);

    const group = useRef();
    const { actions, mixer } = useAnimations(animations, group);
    const previousAction = useRef();

    // Global state
    const currentAudioUrl = useChatbot((state) => state.currentAudio);
    const currentLipsync = useChatbot((state) => state.currentLipsync);
    const setStatus = useChatbot((state) => state.setStatus);
    const status = useChatbot((state) => state.status);
    const isSpeaking = useChatbot((state) => state.isSpeaking);
    const currentAnimation = useChatbot((state) => state.currentAnimation);
    const animationRunId = useChatbot((state) => state.animationRunId);
    const setAnimation = useChatbot((state) => state.setAnimation);

    const audio = useMemo(() => new Audio(), []);

    // Apply materials
    useEffect(() => {
        scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = false;
                child.frustumCulled = false;
                child.material = new MeshPhysicalMaterial({
                    ...child.material,
                    roughness: 1,
                    ior: 2.2,
                    iridescence: 0.7,
                    iridescenceIOR: 1.3,
                    reflectivity: 1,
                });
            }
        });
    }, [scene]);

    // Audio management
    useEffect(() => {
        if (currentAudioUrl) {
            audio.src = currentAudioUrl;
            audio.onplay = () => setStatus("speaking");
            audio.onended = () => setStatus("idle");
            audio.play().catch(() => setStatus("idle"));
            return () => {
                audio.pause();
                audio.onplay = null;
                audio.onended = null;
            };
        } else {
            audio.pause();
            setStatus("idle");
        }
    }, [currentAudioUrl, audio, setStatus]);

    // Update animation based on status
    const lastStatusRef = useRef(status);
    useEffect(() => {
        if (lastStatusRef.current === status) return;
        lastStatusRef.current = status;

        let nextAnim;
        if (status === "speaking" || isSpeaking) {
            nextAnim = getRandomAnimation(talkingAnimations);
        } else if (status === "idle") {
            nextAnim = getWeightedRandomAnimation(idleAnimations);
        } else if (status === "loading") {
            nextAnim = "Idle";
        }
        if (nextAnim) {
            setAnimation(nextAnim);
        }
    }, [status, isSpeaking, setAnimation]);

    // Play animation
    useEffect(() => {
        const action = actions[currentAnimation];
        if (!action) return;

        const onFinished = () => {
            let nextAnimName;
            if (status === "speaking" || isSpeaking) {
                nextAnimName = getRandomAnimation(talkingAnimations);
            } else if (status === "idle") {
                nextAnimName = getWeightedRandomAnimation(idleAnimations);
            }
            if (nextAnimName) {
                setAnimation(nextAnimName);
            }
        };

        mixer.addEventListener("finished", onFinished);

        if (previousAction.current !== action) {
            if (previousAction.current) previousAction.current.fadeOut(0.5);
            action.reset().fadeIn(0.5).play();
        } else if (!action.isRunning()) {
            action.reset().play();
        }

        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        previousAction.current = action;

        return () => mixer.removeEventListener("finished", onFinished);
    }, [currentAnimation, animationRunId, actions, mixer, status, isSpeaking, setAnimation]);

    // Cache skinned meshes for lipsync
    const skinnedMeshes = useMemo(() => {
        const meshes = [];
        clone.traverse((child) => {
            if (child.isSkinnedMesh && child.morphTargetDictionary) {
                meshes.push(child);
            }
        });
        return meshes;
    }, [clone]);

    // Lipsync frame loop (Rhubarb compatible)
    useFrame(() => {
        const lerpMorphTarget = (target, value, speed = 0.1) => {
            skinnedMeshes.forEach((child) => {
                const index = child.morphTargetDictionary[target];
                if (index !== undefined && child.morphTargetInfluences[index] !== undefined) {
                    child.morphTargetInfluences[index] = lerp(child.morphTargetInfluences[index], value, speed);
                }
            });
        };

        let activeViseme = "viseme_sil";
        if (status === "speaking" || isSpeaking) {
            if (currentLipsync?.mouthCues) {
                // Rhubarb lipsync data
                const currentTime = audio.currentTime;
                for (const cue of currentLipsync.mouthCues) {
                    if (currentTime >= cue.start && currentTime <= cue.end) {
                        activeViseme = corresponding[cue.value];
                        break;
                    }
                }
            } else {
                // Simulate talking when no lipsync data
                const visemes = ["A", "B", "C", "D", "E", "F", "G", "H"];
                activeViseme = corresponding[visemes[Math.floor(Date.now() / 150) % visemes.length]];
            }
        }

        Object.values(corresponding).forEach((viseme) => {
            lerpMorphTarget(viseme, viseme === activeViseme ? 1 : 0, 0.2);
        });
    });

    // Dynamic mesh rendering
    const renderMeshes = useMemo(() => {
        const meshList = [];
        Object.entries(nodes).forEach(([name, node]) => {
            if (node.isSkinnedMesh) {
                meshList.push(
                    <skinnedMesh
                        key={name}
                        name={name}
                        geometry={node.geometry}
                        material={node.material}
                        skeleton={node.skeleton}
                        morphTargetDictionary={node.morphTargetDictionary}
                        morphTargetInfluences={node.morphTargetInfluences}
                    />
                );
            }
        });
        return meshList;
    }, [nodes]);

    const rootBone = nodes.Hips || Object.values(nodes).find((n) => n.isBone);

    return (
        <group {...props} ref={group} dispose={null}>
            {rootBone && <primitive object={rootBone} />}
            {renderMeshes}
        </group>
    );
};

// Convenience exports
export const MaleAvatar = (props) => <GenericAvatar gender="male" {...props} />;
export const FemaleAvatar = (props) => <GenericAvatar gender="female" {...props} />;

// Backward compatibility
export const Detective = MaleAvatar;
export const Avatar = FemaleAvatar;

// Preload models
useGLTF.preload("/models/Detective.glb");
useGLTF.preload("/models/Avatar.glb");
