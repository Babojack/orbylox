import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, Users, 
  Maximize2, Minimize2, X, Send, MessageSquare, Minus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function VideoCall({ isOpen, onClose, currentUser, projectMembers }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [callMessages, setCallMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Start video stream when modal opens
  useEffect(() => {
    if (isOpen && isVideoOn) {
      startVideo();
    }
    return () => {
      stopVideo();
    };
  }, [isOpen]);

  const startVideo = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Kamera/Mikrofon konnte nicht gestartet werden. Bitte Berechtigungen prüfen.');
    }
  };

  const stopVideo = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleEndCall = () => {
    stopVideo();
    onClose();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Scroll to bottom when new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [callMessages]);

  // Send chat message
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      content: chatInput,
      sender: currentUser?.email || 'Du',
      timestamp: new Date().toISOString()
    };
    setCallMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  if (!isOpen) return null;

  // Minimized view
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-4 right-4 z-50 bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700"
        style={{ width: 280 }}
      >
        <div className="relative">
          {/* Mini video preview */}
          <div className="w-full h-40 bg-slate-800 flex items-center justify-center">
            {isVideoOn && stream ? (
              <video
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                ref={(el) => {
                  if (el && stream) el.srcObject = stream;
                }}
              />
            ) : (
              <Avatar className="w-16 h-16 border-2 border-slate-700">
                <AvatarFallback className="bg-indigo-600 text-white text-xl">
                  {currentUser?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          
          {/* Call indicator */}
          <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white text-xs">Video Call</span>
          </div>

          {/* Expand button */}
          <Button
            onClick={() => setIsMinimized(false)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-700/80 hover:bg-slate-600 p-0"
          >
            <Maximize2 className="w-4 h-4 text-white" />
          </Button>
        </div>

        {/* Mini controls */}
        <div className="p-3 bg-slate-800/50 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className={`w-10 h-10 rounded-full ${
              isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full ${
              !isVideoOn ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white'
            }`}
          >
            {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </Button>

          <Button
            onClick={handleEndCall}
            className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white p-0"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col ${
            isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-4xl aspect-video'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-white font-medium">Video Call</span>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">Beta</span>
              <span className="text-slate-400 text-sm">
                • {projectMembers.length + 1} Teilnehmer möglich
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
                title="Minimieren"
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEndCall}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 relative bg-slate-800 flex">
            {/* Main Video Section */}
            <div className={`${showChat ? 'flex-1' : 'w-full'} relative flex items-center justify-center`}>
              {error ? (
                <div className="text-center p-8">
                  <VideoOff className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">{error}</p>
                  <Button 
                    onClick={startVideo}
                    className="mt-4"
                    variant="outline"
                  >
                    Erneut versuchen
                  </Button>
                </div>
              ) : (
                <>
                  {/* Main video (self) */}
                  <div className="w-full h-full flex items-center justify-center">
                    {isVideoOn && stream ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <Avatar className="w-32 h-32 border-4 border-slate-700">
                          <AvatarFallback className="bg-indigo-600 text-white text-4xl">
                            {currentUser?.email?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-slate-400 mt-4">Kamera ausgeschaltet</p>
                      </div>
                    )}
                  </div>

                  {/* Participants preview */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <div className="text-xs text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Warte auf Teilnehmer...
                    </div>
                  </div>

                  {/* Self preview when video is on */}
                  {isVideoOn && stream && (
                    <div className={`absolute bottom-4 ${showChat ? 'right-4' : 'right-4'} w-32 h-24 bg-slate-700 rounded-lg overflow-hidden border-2 border-slate-600 shadow-lg`}>
                      <video
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        ref={(el) => {
                          if (el && stream) el.srcObject = stream;
                        }}
                      />
                      <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1 rounded">
                        Du
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* In-Call Chat Panel */}
            <AnimatePresence>
              {showChat && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 300, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="h-full bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-white text-sm font-medium">Chat im Anruf</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowChat(false)}
                      className="h-6 w-6 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-3">
                      {callMessages.length === 0 ? (
                        <p className="text-slate-500 text-xs text-center py-4">
                          Noch keine Nachrichten
                        </p>
                      ) : (
                        callMessages.map((msg) => {
                          const isMe = msg.sender === currentUser?.email || msg.sender === 'Du';
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                                isMe 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-slate-700 text-slate-200'
                              }`}>
                                {!isMe && (
                                  <p className="text-xs text-slate-400 mb-1">
                                    {msg.sender.split('@')[0]}
                                  </p>
                                )}
                                <p>{msg.content}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>
                  
                  <form onSubmit={sendChatMessage} className="p-3 border-t border-slate-700 flex gap-2">
                    <Input
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onFocus={(e) => e.stopPropagation()}
                      placeholder="Nachricht..."
                      className="flex-1 bg-slate-800 border-slate-600 text-white text-sm placeholder:text-slate-500"
                      autoComplete="off"
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      disabled={!chatInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 h-9 w-9"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="p-4 bg-slate-800/50 flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full ${
                isMuted 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full ${
                !isVideoOn 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChat(!showChat)}
              className={`w-12 h-12 rounded-full relative ${
                showChat 
                  ? 'bg-indigo-500/30 text-indigo-400 hover:bg-indigo-500/40' 
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {callMessages.length > 0 && !showChat && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {callMessages.length > 9 ? '9+' : callMessages.length}
                </span>
              )}
            </Button>

            <Button
              onClick={handleEndCall}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>

          {/* Info Banner */}
          <div className="px-4 pb-3 bg-slate-800/50">
            <p className="text-xs text-slate-500 text-center">
              💡 Teile diesen Chat mit Teammitgliedern, damit sie dem Anruf beitreten können
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}