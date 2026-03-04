import React, { useEffect } from 'react';

export default function VoiceAgent() {
  useEffect(() => {
    // Load ElevenLabs script once
    if (!document.querySelector('script[src*="elevenlabs"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed@beta';
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
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <elevenlabs-convai agent-id="agent_2401kdmc23bfe2981zcyjzjge11t"></elevenlabs-convai>
    </div>
  );
}