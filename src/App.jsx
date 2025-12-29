import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";
import useCases from "./hooks/useCases";
import useChatbot from "./hooks/useChatbot";

function App() {
  const { caseId } = useParams();
  const [levaHidden, setLevaHidden] = useState(true);

  const initializeCaseFromUrl = useCases((state) => state.initializeCaseFromUrl);
  const activeCase = useCases((state) => state.activeCase);
  const getCaseMessages = useCases((state) => state.getCaseMessages);
  const setMessages = useChatbot((state) => state.setMessages);

  // Initialize case from URL on mount (only if we have a caseId)
  useEffect(() => {
    if (caseId) {
      initializeCaseFromUrl(caseId);
    } else {
      // On root path, clear any active case and messages
      setMessages([]);
    }
  }, [caseId, initializeCaseFromUrl, setMessages]);

  // Sync messages when active case changes
  useEffect(() => {
    if (activeCase) {
      const messages = getCaseMessages(activeCase);
      setMessages(messages);
    }
  }, [activeCase, getCaseMessages, setMessages]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && (e.key === "L" || e.key === "l")) {
        setLevaHidden((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Leva hidden={levaHidden} />
      <UI />
      <Canvas shadows camera={{ position: [0, 1, 10], fov: 20 }}>
        <color attach="background" args={["#242424"]} />
        <Experience />
      </Canvas>
    </>
  );
}

export default App;

