import React, { useEffect } from 'react';

export default function VoiceAgent() {
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
  const widgetScriptSrc = import.meta.env.VITE_ELEVENLABS_WIDGET_SRC;

  useEffect(() => {
    if (!agentId || !widgetScriptSrc) return;

    // Load ElevenLabs script once
    if (!document.querySelector(`script[src="${widgetScriptSrc}"]`)) {
      const script = document.createElement('script');
      script.src = widgetScriptSrc;
      script.async = true;
      document.body.appendChild(script);
    }

    // Hide "Powered by ElevenLabs" footer
    const style = document.createElement('style');
    style.textContent = `
      elevenlabs-convai::part(powered-by),
      elevenlabs-convai [class*="powered"],
      elevenlabs-convai [class*="footer"],
      elevenlabs-convai a[href*="elevenlabs"] {
        display: none !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (style.parentNode) style.parentNode.removeChild(style);
    };
  }, [agentId, widgetScriptSrc]);

  if (!agentId || !widgetScriptSrc) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <elevenlabs-convai agent-id={agentId}></elevenlabs-convai>
    </div>
  );
}