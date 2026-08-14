import React, { useState } from 'react';
import { Check, RotateCcw, GripVertical, X, Video, VideoOff, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mini Kanban Demo
function MiniKanban() {
  const [tasks, setTasks] = useState({
    todo: [{ id: 1, text: 'Design UI', color: 'bg-blue-100' }],
    progress: [{ id: 2, text: 'Build MVP', color: 'bg-amber-100' }],
    done: [{ id: 3, text: 'Research', color: 'bg-green-100' }]
  });
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [touchStart, setTouchStart] = useState(null);

  const handleDragStart = (task, source) => {
    setDraggedTask(task);
    setDragSource(source);
  };

  const handleDrop = (target) => {
    if (!draggedTask || !dragSource || dragSource === target) return;
    
    setTasks(prev => ({
      ...prev,
      [dragSource]: prev[dragSource].filter(t => t.id !== draggedTask.id),
      [target]: [...prev[target], draggedTask]
    }));
    setDraggedTask(null);
    setDragSource(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (task, source, e) => {
    setDraggedTask(task);
    setDragSource(source);
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e) => {
    if (!draggedTask || !dragSource || !touchStart) {
      setDraggedTask(null);
      setDragSource(null);
      setTouchStart(null);
      return;
    }

    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const column = element?.closest('[data-column]');
    
    if (column) {
      const target = column.getAttribute('data-column');
      if (target && target !== dragSource) {
        setTasks(prev => ({
          ...prev,
          [dragSource]: prev[dragSource].filter(t => t.id !== draggedTask.id),
          [target]: [...prev[target], draggedTask]
        }));
      }
    }
    
    setDraggedTask(null);
    setDragSource(null);
    setTouchStart(null);
  };

  const columns = [
    { key: 'todo', label: 'To Do', color: 'bg-slate-100' },
    { key: 'progress', label: 'In Progress', color: 'bg-blue-50' },
    { key: 'done', label: 'Done', color: 'bg-green-50' }
  ];

  return (
    <div className="flex gap-2 h-full p-2">
      {columns.map(col => (
        <div 
          key={col.key}
          data-column={col.key}
          className={`flex-1 ${col.color} rounded-lg p-2`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(col.key)}
        >
          <p className="text-[10px] font-semibold text-slate-600 mb-2">{col.label}</p>
          <div className="space-y-1.5">
            {tasks[col.key].map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={() => handleDragStart(task, col.key)}
                onTouchStart={(e) => handleTouchStart(task, col.key, e)}
                onTouchEnd={handleTouchEnd}
                className={`${task.color} p-1.5 rounded text-[9px] font-medium text-slate-700 cursor-grab active:cursor-grabbing flex items-center gap-1 shadow-sm hover:shadow transition-shadow touch-none`}
              >
                <GripVertical className="w-2.5 h-2.5 text-slate-400" />
                {task.text}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mini Canvas Demo
function MiniCanvas() {
  const [nodes, setNodes] = useState([
    { id: 1, x: 20, y: 20, text: 'Idea', color: 'bg-[#ef5a24]' },
    { id: 2, x: 100, y: 60, text: 'Plan', color: 'bg-[#ef5a24]' },
    { id: 3, x: 60, y: 110, text: 'Launch', color: 'bg-pink-400' }
  ]);
  const [dragging, setDragging] = useState(null);
  const containerRef = React.useRef(null);

  const handleMouseDown = (id, e) => {
    e.preventDefault();
    setDragging(id);
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - 25, rect.width - 50));
    const y = Math.max(0, Math.min(e.clientY - rect.top - 12, rect.height - 24));
    setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x, y } : n));
  };

  // Touch handlers for mobile
  const handleTouchStart = (id, e) => {
    e.preventDefault();
    setDragging(id);
  };

  const handleTouchMove = (e) => {
    if (!dragging || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(touch.clientX - rect.left - 25, rect.width - 50));
    const y = Math.max(0, Math.min(touch.clientY - rect.top - 12, rect.height - 24));
    setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x, y } : n));
  };

  const handleTouchEnd = () => {
    setDragging(null);
  };

  return (
    <div 
      ref={containerRef}
      className="h-full bg-slate-50 rounded-lg relative overflow-hidden touch-none"
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragging(null)}
      onMouseLeave={() => setDragging(null)}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <line x1={nodes[0].x + 25} y1={nodes[0].y + 12} x2={nodes[1].x + 25} y2={nodes[1].y + 12} stroke="#c7d2fe" strokeWidth="2" />
        <line x1={nodes[1].x + 25} y1={nodes[1].y + 12} x2={nodes[2].x + 25} y2={nodes[2].y + 12} stroke="#c7d2fe" strokeWidth="2" />
      </svg>
      
      {nodes.map(node => (
        <div
          key={node.id}
          onMouseDown={(e) => handleMouseDown(node.id, e)}
          onTouchStart={(e) => handleTouchStart(node.id, e)}
          className={`absolute ${node.color} text-white text-[9px] font-semibold px-2 py-1 rounded-full cursor-grab active:cursor-grabbing shadow-md hover:scale-105 transition-transform select-none touch-none`}
          style={{ left: node.x, top: node.y }}
        >
          {node.text}
        </div>
      ))}
      <p className="absolute bottom-1 right-2 text-[8px] text-slate-400">Drag nodes!</p>
    </div>
  );
}

// Mini FileHub Demo
function MiniFileHub() {
  const [files, setFiles] = useState([
    { id: 1, name: 'Proposal.pdf', type: 'pdf', size: '2.4 MB', color: 'bg-red-100', icon: '📄' },
    { id: 2, name: 'Design.png', type: 'image', size: '1.1 MB', color: 'bg-[#ef5a24]/10', icon: '🖼️' },
    { id: 3, name: 'Notes.txt', type: 'text', size: '45 KB', color: 'bg-blue-100', icon: '📝' }
  ]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folders, setFolders] = useState([
    { id: 1, name: 'Documents', count: 3, color: 'bg-[#ef5a24]/10' }
  ]);

  const fileTypes = [
    { type: 'pdf', icon: '📄', color: 'bg-red-100', name: 'Report.pdf' },
    { type: 'image', icon: '🖼️', color: 'bg-[#ef5a24]/10', name: 'Screenshot.png' },
    { type: 'doc', icon: '📎', color: 'bg-green-100', name: 'Notes.doc' },
    { type: 'sheet', icon: '📊', color: 'bg-emerald-100', name: 'Data.xlsx' }
  ];

  const addFile = () => {
    setUploading(true);
    const randomFile = fileTypes[Math.floor(Math.random() * fileTypes.length)];
    
    setTimeout(() => {
      const newFile = {
        id: Date.now(),
        name: randomFile.name,
        type: randomFile.type,
        size: `${Math.floor(Math.random() * 500 + 100)} KB`,
        color: randomFile.color,
        icon: randomFile.icon
      };
      setFiles(prev => [newFile, ...prev]);
      setUploading(false);
    }, 800);
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      {/* Upload area with animation */}
      <motion.div 
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer relative overflow-hidden transition-all ${
          isDragging ? 'border-[#ef5a24] bg-[#f5f5f5] scale-105' : 'border-slate-200 hover:border-[#ef5a24] hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFile(); }}
        onClick={addFile}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {uploading && (
          <motion.div
            className="absolute inset-0 bg-[#ef5a24]"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 0.8 }}
            style={{ opacity: 0.2 }}
          />
        )}
        <motion.div 
          className="text-2xl mb-1"
          animate={{ 
            y: isDragging ? [0, -5, 0] : 0,
            rotate: isDragging ? [0, 10, -10, 0] : 0
          }}
          transition={{ duration: 0.5, repeat: isDragging ? Infinity : 0 }}
        >
          ☁️
        </motion.div>
        <p className="text-[8px] text-slate-500 relative z-10">
          {uploading ? 'Uploading...' : 'Drop or click'}
        </p>
      </motion.div>

      {/* Folders row */}
      <div className="flex gap-1">
        {folders.map(folder => (
          <motion.div
            key={folder.id}
            className={`${folder.color} rounded-lg p-2 flex-1 cursor-pointer`}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="text-lg">📁</div>
            <p className="text-[7px] font-medium text-slate-700 truncate">{folder.name}</p>
            <p className="text-[6px] text-slate-500">{folder.count} files</p>
          </motion.div>
        ))}
      </div>

      {/* Files grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-1.5">
          <AnimatePresence>
            {files.slice(0, 4).map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ delay: index * 0.05 }}
                className={`${file.color} rounded-lg p-2 cursor-pointer`}
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div 
                  className="text-xl mb-1"
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                >
                  {file.icon}
                </motion.div>
                <p className="text-[7px] font-medium text-slate-700 truncate">{file.name}</p>
                <p className="text-[6px] text-slate-500">{file.size}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <p className="text-[7px] text-slate-400 text-center">Click to add files! 🎉</p>
    </div>
  );
}

// Mini Chat + Video Demo
function MiniChatVideo() {
  const [messages, setMessages] = useState([
    { id: 1, text: 'Hey team! 👋', sender: 'other', name: 'Max' },
    { id: 2, text: 'Ready for launch?', sender: 'me', name: 'You' }
  ]);
  const [input, setInput] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [callAnimation, setCallAnimation] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), text: input, sender: 'me', name: 'You' }]);
    setInput('');
  };

  const startCall = () => {
    setCallAnimation(true);
    setTimeout(() => {
      setIsInCall(true);
      setCallAnimation(false);
    }, 1500);
  };

  const endCall = () => {
    setIsInCall(false);
  };

  return (
    <div className="h-full flex flex-col p-2 relative">
      {/* Video Call Overlay */}
      <AnimatePresence>
        {callAnimation && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 bg-slate-900 rounded-lg flex items-center justify-center z-20"
          >
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-center"
            >
              <Phone className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-white text-[10px]">Connecting...</p>
            </motion.div>
          </motion.div>
        )}
        
        {isInCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg z-20 p-2"
          >
            {/* Video grid */}
            <div className="grid grid-cols-2 gap-1 h-[calc(100%-28px)]">
              <div className="bg-[#ef5a24] rounded-lg flex items-center justify-center relative overflow-hidden">
                <motion.div 
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-2xl"
                >
                  👨‍💻
                </motion.div>
                <span className="absolute bottom-1 left-1 text-[8px] text-white bg-black/30 px-1 rounded">You</span>
              </div>
              <div className="bg-[#ef5a24] rounded-lg flex items-center justify-center relative overflow-hidden">
                <motion.div 
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  className="text-2xl"
                >
                  👩‍💻
                </motion.div>
                <span className="absolute bottom-1 left-1 text-[8px] text-white bg-black/30 px-1 rounded">Lisa</span>
              </div>
              <div className="bg-emerald-600 rounded-lg flex items-center justify-center relative overflow-hidden">
                <motion.div 
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                  className="text-2xl"
                >
                  👨‍🎨
                </motion.div>
                <span className="absolute bottom-1 left-1 text-[8px] text-white bg-black/30 px-1 rounded">Max</span>
              </div>
              <div className="bg-amber-600 rounded-lg flex items-center justify-center relative overflow-hidden">
                <motion.div 
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
                  className="text-2xl"
                >
                  👩‍🔬
                </motion.div>
                <span className="absolute bottom-1 left-1 text-[8px] text-white bg-black/30 px-1 rounded">Anna</span>
              </div>
            </div>
            {/* Call controls */}
            <div className="flex justify-center gap-2 mt-1">
              <button 
                onClick={endCall}
                className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full transition-colors"
              >
                <VideoOff className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Header with Video Icon */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-semibold text-slate-600">Team Chat</span>
        <button 
          onClick={startCall}
          className="text-[#ef5a24] hover:text-[#ef5a24] hover:bg-[#f5f5f5] p-1.5 rounded-full transition-colors"
        >
          <Video className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1.5 mb-2">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-2 py-1 rounded-lg text-[9px] ${
              msg.sender === 'me' 
                ? 'bg-[#ef5a24] text-white' 
                : 'bg-slate-100 text-slate-700'
            }`}>
              {msg.sender === 'other' && <p className="font-semibold text-[8px] text-[#ef5a24]">{msg.name}</p>}
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type..."
          className="flex-1 text-[9px] px-2 py-1 border border-slate-200 rounded-full focus:outline-none focus:border-[#ef5a24]"
        />
        <button onClick={send} className="bg-[#ef5a24] text-white text-[9px] px-2 rounded-full hover:bg-black">
          Send
        </button>
      </div>
    </div>
  );
}

// Mini Social Feed Demo
function MiniSocialFeed() {
  const [posts, setPosts] = useState([
    { id: 1, author: 'Max', content: 'Just launched our MVP! 🚀', likes: 5, comments: 2, time: '2m', avatar: '👨‍💻', liked: false, image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80' },
    { id: 2, author: 'Lisa', content: 'Great meeting! ✨', likes: 3, comments: 1, time: '5m', avatar: '👩‍💼', liked: false }
  ]);
  const [newPost, setNewPost] = useState('');
  const [activePost, setActivePost] = useState(null);
  const [attachedImage, setAttachedImage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const sampleImages = [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80',
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=80',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&q=80'
  ];

  const attachImage = () => {
    const randomImg = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    setAttachedImage(randomImg);
  };

  const addPost = () => {
    if (!newPost.trim() && !attachedImage) return;
    const post = {
      id: Date.now(),
      author: 'You',
      content: newPost || '📸',
      likes: 0,
      comments: 0,
      time: 'now',
      avatar: '😊',
      liked: false,
      image: attachedImage
    };
    setPosts(prev => [post, ...prev]);
    setNewPost('');
    setAttachedImage(null);
  };

  const likePost = (id) => {
    setPosts(prev => prev.map(p => 
      p.id === id ? { ...p, likes: p.liked ? p.likes - 1 : p.likes + 1, liked: !p.liked } : p
    ));
  };

  const addComment = (id) => {
    setPosts(prev => prev.map(p => 
      p.id === id ? { ...p, comments: p.comments + 1 } : p
    ));
    setActivePost(null);
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-slate-50 rounded-lg relative">
      {/* New post input */}
      <motion.div 
        className="bg-white rounded-lg p-2 border border-slate-200 shadow-sm"
        whileHover={{ scale: 1.01 }}
      >
        <input
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !attachedImage && addPost()}
          placeholder="Share something... 💭"
          className="w-full text-[9px] px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#ef5a24] focus:ring-1 focus:ring-[#ef5a24]"
        />
        
        {/* Attached image preview */}
        <AnimatePresence>
          {attachedImage && (
            <motion.div 
              initial={{ opacity: 0, height: 0, scale: 0.8 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.8 }}
              className="mt-1.5 relative"
            >
              <img src={attachedImage} alt="Preview" className="w-full h-16 object-cover rounded-lg" />
              <motion.button
                onClick={() => setAttachedImage(null)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-lg"
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                ×
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex justify-between items-center mt-1.5">
          <div className="flex gap-1.5">
            <motion.button
              onClick={attachImage}
              className="text-sm"
              whileHover={{ scale: 1.3, rotate: 15 }}
              whileTap={{ scale: 0.9, rotate: -15 }}
            >
              📷
            </motion.button>
            <motion.span 
              className="text-sm cursor-pointer"
              whileHover={{ scale: 1.3, rotate: -15 }}
              whileTap={{ scale: 0.9 }}
            >
              🎬
            </motion.span>
          </div>
          <motion.button
            onClick={addPost}
            className="text-[8px] bg-[#ef5a24] text-white px-3 py-1 rounded-full"
            whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}
            whileTap={{ scale: 0.95 }}
          >
            Post ✨
          </motion.button>
        </div>
      </motion.div>

      {/* Posts feed */}
      <div className="flex-1 overflow-y-auto space-y-2">
        <AnimatePresence>
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white rounded-lg p-2.5 border border-slate-100 hover:shadow-lg transition-all"
            >
              {/* Header */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <motion.div 
                  className="text-base"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.2 }}
                  transition={{ duration: 0.5 }}
                >
                  {post.avatar}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-bold text-slate-800 truncate">{post.author}</p>
                  <p className="text-[7px] text-slate-400">{post.time}</p>
                </div>
              </div>

              {/* Content */}
              <p className="text-[9px] text-slate-700 mb-2 leading-relaxed">{post.content}</p>

              {/* Image */}
              {post.image && (
                <motion.div 
                  className="mb-2 cursor-pointer overflow-hidden rounded-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedImage(post.image)}
                >
                  <motion.img 
                    src={post.image} 
                    alt="Post" 
                    className="w-full h-20 object-cover"
                    whileHover={{ scale: 1.05 }}
                  />
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1.5 border-t border-slate-100">
                <motion.button
                  onClick={() => likePost(post.id)}
                  className={`flex items-center gap-1 text-[8px] ${post.liked ? 'text-red-500' : 'text-slate-500 hover:text-red-500'}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85, rotate: -15 }}
                >
                  <motion.span
                    className="text-sm"
                    animate={post.liked ? { scale: [1, 1.4, 1], rotate: [0, -15, 15, 0] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {post.liked ? '❤️' : '🤍'}
                  </motion.span>
                  <span className="font-medium">{post.likes}</span>
                </motion.button>
                <motion.button
                  onClick={() => setActivePost(activePost === post.id ? null : post.id)}
                  className="flex items-center gap-1 text-[8px] text-slate-500 hover:text-blue-500"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  💬 <span className="font-medium">{post.comments}</span>
                </motion.button>
              </div>

              {/* Comment input */}
              <AnimatePresence>
                {activePost === post.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 overflow-hidden"
                  >
                    <div className="flex gap-1">
                      <input
                        placeholder="Comment..."
                        className="flex-1 text-[8px] px-2 py-1 border border-slate-200 rounded-full focus:outline-none focus:border-blue-400"
                        onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)}
                      />
                      <motion.button
                        onClick={() => addComment(post.id)}
                        className="text-[8px] bg-blue-500 text-white px-2 rounded-full"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        →
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <p className="text-[7px] text-slate-400 text-center">Share & interact! 💬</p>

      {/* Image lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              className="relative max-w-[90%] max-h-[90%]"
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.8, rotate: 5 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img 
                src={selectedImage} 
                alt="Full" 
                className="rounded-lg shadow-2xl max-h-[30vh]"
                whileHover={{ scale: 1.05 }}
              />
              <motion.button
                className="absolute -top-2 -right-2 bg-white text-slate-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-xl"
                onClick={() => setSelectedImage(null)}
                whileHover={{ scale: 1.2, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                ×
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mini Startup Builder Demo
function MiniStartupBuilder() {
  const [steps, setSteps] = useState([
    { id: 1, title: 'Idea', status: 'done', color: 'bg-green-400' },
    { id: 2, title: 'Validate', status: 'active', color: 'bg-[#ef5a24]' },
    { id: 3, title: 'MVP', status: 'pending', color: 'bg-slate-300' },
    { id: 4, title: 'Launch', status: 'pending', color: 'bg-slate-300' }
  ]);

  const toggleStep = (id) => {
    setSteps(prev => prev.map(s => {
      if (s.id === id) {
        if (s.status === 'pending') return { ...s, status: 'active', color: 'bg-[#ef5a24]' };
        if (s.status === 'active') return { ...s, status: 'done', color: 'bg-green-400' };
        return { ...s, status: 'pending', color: 'bg-slate-300' };
      }
      return s;
    }));
  };

  const completedCount = steps.filter(s => s.status === 'done').length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="h-full p-2 flex flex-col">
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-semibold text-slate-600">Progress</span>
          <span className="text-[9px] font-bold text-[#ef5a24]">{completedCount}/{steps.length}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-[#ef5a24]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 space-y-1.5">
        {steps.map((step, i) => (
          <motion.button
            key={step.id}
            onClick={() => toggleStep(step.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left transition-all ${
              step.status === 'done' ? 'bg-green-50 border border-green-200' :
              step.status === 'active' ? 'bg-[#f5f5f5] border border-[#ef5a24]/30' :
              'bg-slate-50 border border-slate-200'
            }`}
          >
            <div className={`w-5 h-5 rounded-full ${step.color} flex items-center justify-center text-white text-[8px] font-bold`}>
              {step.status === 'done' ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] font-medium ${
              step.status === 'done' ? 'text-green-700' :
              step.status === 'active' ? 'text-[#ef5a24]' :
              'text-slate-500'
            }`}>
              {step.title}
            </span>
            {step.status === 'active' && (
              <span className="ml-auto text-[7px] bg-[#ef5a24] text-white px-1.5 py-0.5 rounded-full">Active</span>
            )}
          </motion.button>
        ))}
      </div>

      <p className="text-[8px] text-slate-400 text-center mt-1">Click steps to change status!</p>
    </div>
  );
}

// Main Interactive Card Component
export default function InteractiveFeatureCard({ title, description, features, image, index }) {
  const getDemoComponent = () => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('kanban')) return <MiniKanban />;
    if (lowerTitle.includes('canvas')) return <MiniCanvas />;
    if (lowerTitle.includes('file') || lowerTitle.includes('datei')) return <MiniFileHub />;
    if (lowerTitle.includes('social') || lowerTitle.includes('feed') || lowerTitle.includes('übersicht')) return <MiniSocialFeed />;
    return null;
  };

  const demo = getDemoComponent();

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-xl transition-all duration-300 h-auto flex flex-col">
      {/* Title */}
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      
      {/* Interactive Demo */}
      {demo && (
        <div className="bg-[#f5f5f5] rounded-xl border border-[#ef5a24]/30 p-3 mb-4 h-64 overflow-hidden">
          <div className="bg-white rounded-lg shadow-inner h-full overflow-hidden">
            {demo}
          </div>
        </div>
      )}
      
      {/* Description & Features */}
      <div className="flex-1">
        <p className="text-slate-600 mb-3 text-sm">{description}</p>
        <ul className="space-y-1.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}