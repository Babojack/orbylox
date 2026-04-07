import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ZoomIn, ZoomOut, RotateCcw, GitBranch, Lightbulb, X, Check, Diamond, StickyNote, MessageSquare, ListTodo, Maximize2, Minimize2, Move, AlignVerticalJustifyStart, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TaskDetailDialog from "@/components/kanban/TaskDetailDialog";

const NODE_COLORS = [
  { bg: '#6366f1', text: '#ffffff' },
  { bg: '#8b5cf6', text: '#ffffff' },
  { bg: '#ec4899', text: '#ffffff' },
  { bg: '#ef4444', text: '#ffffff' },
  { bg: '#22c55e', text: '#ffffff' },
  { bg: '#3b82f6', text: '#ffffff' },
];

export default function MindMap() {
  const queryClient = useQueryClient();
  const canvasRef = useRef(null);
  const projectId = new URLSearchParams(window.location.search).get('project');

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editText, setEditText] = useState('');
  const [notePanel, setNotePanel] = useState(null); // { nodeId, note }
  const [taskLinkPanel, setTaskLinkPanel] = useState(null); // { nodeId, taskId }
  const [openTaskId, setOpenTaskId] = useState(null); // Task ID für Dialog
  
  const draggingRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [connectLabel, setConnectLabel] = useState(null); // 'yes' | 'no' | null
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [, forceRender] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileVertical, setIsMobileVertical] = useState(false); // Track if currently in vertical mode
  const [originalPositions, setOriginalPositions] = useState(null); // Store original positions for restore

  const shouldAutoEditNewNode = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
    const touchCapable = (navigator?.maxTouchPoints || 0) > 0;
    // On touch/tablet devices auto-focus opens keyboard and shifts viewport.
    return !coarsePointer && !touchCapable;
  }, []);

  // ESC-Taste zum Beenden des Vollbild-Modus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Флаг первой загрузки - после неё локальное состояние главное
  const initialLoadDoneRef = useRef(false);

  // Fetch data - только один раз при загрузке
  const { data: serverNodes = [], isLoading: isLoadingNodes } = useQuery({
    queryKey: ['mindmapNodes', projectId],
    queryFn: async () => {
      const all = await api.entities.CanvasItem.list('-created_date', 200);
      return all.filter(i => i.project_id === projectId);
    },
    staleTime: Infinity, // Никогда не перезагружать автоматически
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!projectId
  });

  const { data: serverConnections = [], isLoading: isLoadingConnections } = useQuery({
    queryKey: ['mindmapConnections', projectId],
    queryFn: async () => {
      const all = await api.entities.CanvasConnection.list('-created_date', 200);
      return all.filter(c => c.project_id === projectId);
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!projectId
  });
  
  // Fetch tasks for linking
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const all = await api.entities.Task.list('-updated_date', 200);
      return all.filter(t => t.project_id === projectId);
    },
    staleTime: 60000,
    enabled: !!projectId
  });

  // Current user for task dialog
  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (userError || (!userLoading && !currentUser)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [currentUser, userLoading, userError]);

  // Project for assignees
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await api.entities.Project.list();
      return projects.find(p => p.id === projectId);
    },
    enabled: !!projectId
  });

  const projectMembers = Array.isArray(project?.members) ? project.members : [];
  const allAssignees = React.useMemo(() => {
    const assignees = new Set();
    if (currentUser?.email) assignees.add(currentUser.email);
    projectMembers.forEach(email => assignees.add(email));
    return Array.from(assignees);
  }, [currentUser?.email, projectMembers]);

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => api.entities.Task.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      setOpenTaskId(null);
    }
  });

  const openTask = tasks.find(t => t.id === openTaskId);

  // Загружаем данные ТОЛЬКО ОДИН РАЗ при первой загрузке
    useEffect(() => {
      if (!initialLoadDoneRef.current && !isLoadingNodes && serverNodes) {
        setNodes(serverNodes);
        if (!isLoadingConnections && serverConnections) {
          setConnections(serverConnections);
          initialLoadDoneRef.current = true;


        }
      }
    }, [serverNodes, serverConnections, isLoadingNodes, isLoadingConnections]);

  // Mutations - БЕЗ invalidateQueries чтобы не перезаписывать локальные данные
  const createNode = useMutation({
    mutationFn: (node) => api.entities.CanvasItem.create({ ...node, project_id: projectId }),
    onSuccess: (data) => {
      setNodes(prev => {
        // Заменяем temp узел на реальный
        const withoutTemp = prev.filter(n => !String(n.id).startsWith('temp_'));
        const exists = withoutTemp.some(n => n.id === data.id);
        if (exists) return withoutTemp;
        return [...withoutTemp, data];
      });
    }
    // НЕ делаем invalidateQueries - локальные данные главные
  });

  const updateNode = useMutation({
    mutationFn: ({ id, data }) => {
      if (String(id).startsWith('temp_')) return Promise.resolve();
      return api.entities.CanvasItem.update(id, data);
    },
    onMutate: ({ id, data }) => {
      // Мгновенное обновление UI
      setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
    }
    // НЕ делаем invalidateQueries
  });

  const deleteNode = useMutation({
    mutationFn: async (id) => {
      const conns = connections.filter(c => c.from_item_id === id || c.to_item_id === id);
      await Promise.all(conns.map(c => api.entities.CanvasConnection.delete(c.id).catch(() => {})));
      return api.entities.CanvasItem.delete(id);
    },
    onMutate: (id) => {
      setNodes(prev => prev.filter(n => n.id !== id));
      setConnections(prev => prev.filter(c => c.from_item_id !== id && c.to_item_id !== id));
      if (selectedNodeId === id) setSelectedNodeId(null);
    }
    // НЕ делаем invalidateQueries
  });

  const createConnection = useMutation({
    mutationFn: (conn) => api.entities.CanvasConnection.create({ ...conn, project_id: projectId }),
    onSuccess: (data) => {
      setConnections(prev => {
        const exists = prev.some(c => c.id === data.id);
        if (exists) return prev;
        return [...prev, data];
      });
    }
    // НЕ делаем invalidateQueries
  });

  const deleteConnection = useMutation({
    mutationFn: (id) => api.entities.CanvasConnection.delete(id),
    onMutate: (id) => setConnections(prev => prev.filter(c => c.id !== id))
    // НЕ делаем invalidateQueries
  });

  // Helpers — works for mouse, touch, and pen (PointerEvent)
  const getClientXY = useCallback((e) => {
    if (e && typeof e.clientX === "number" && !Number.isNaN(e.clientX)) {
      return { clientX: e.clientX, clientY: e.clientY };
    }
    const te = e?.nativeEvent?.touches?.[0] || e?.nativeEvent?.changedTouches?.[0];
    if (te) return { clientX: te.clientX, clientY: te.clientY };
    return { clientX: 0, clientY: 0 };
  }, []);

  const getCanvasPos = useCallback(
    (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const { clientX, clientY } = getClientXY(e);
      return {
        x: (clientX - rect.left - offset.x) / zoom,
        y: (clientY - rect.top - offset.y) / zoom,
      };
    },
    [offset, zoom, getClientXY],
  );

  const getCenter = (node) => ({
    x: node.x + (node.width || 160) / 2,
    y: node.y + (node.height || 50) / 2
  });

  // Toggle between vertical and original layout
  const toggleVerticalLayout = useCallback(() => {
    if (nodes.length === 0) return;

    if (isMobileVertical && originalPositions) {
      // Restore original positions
      setNodes(prev => prev.map(n => {
        const orig = originalPositions.find(o => o.id === n.id);
        return orig ? { ...n, x: orig.x, y: orig.y } : n;
      }));
      setIsMobileVertical(false);
      setOriginalPositions(null);
      fitToView();
    } else {
      // Save current positions and arrange vertically
      setOriginalPositions(nodes.map(n => ({ id: n.id, x: n.x, y: n.y })));

      // Find root nodes (nodes without incoming connections)
      const hasIncoming = new Set(connections.map(c => c.to_item_id));
      const rootNodes = nodes.filter(n => !hasIncoming.has(n.id));

      // BFS to arrange
      const visited = new Set();
      const updates = [];
      let currentY = 50;
      const centerX = 100;

      const queue = rootNodes.length > 0 ? [...rootNodes] : [nodes[0]];

      while (queue.length > 0) {
        const node = queue.shift();
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        updates.push({ id: node.id, x: centerX, y: currentY });
        currentY += (node.height || 60) + 50;

        // Find children
        const children = connections
          .filter(c => c.from_item_id === node.id)
          .map(c => nodes.find(n => n.id === c.to_item_id))
          .filter(Boolean);

        queue.push(...children);
      }

      // Add any unvisited nodes
      nodes.forEach(n => {
        if (!visited.has(n.id)) {
          updates.push({ id: n.id, x: centerX, y: currentY });
          currentY += (n.height || 60) + 50;
        }
      });

      // Apply updates (local only, don't save to server)
      setNodes(prev => prev.map(n => {
        const update = updates.find(u => u.id === n.id);
        return update ? { ...n, x: update.x, y: update.y } : n;
      }));

      setIsMobileVertical(true);
      setOffset({ x: 20, y: 20 });
      setZoom(1);
    }
  }, [nodes, connections, isMobileVertical, originalPositions]);

  // Add node
  const addNode = (type = 'node', parentId = null, label = null) => {
    const parent = parentId ? nodes.find(n => n.id === parentId) : null;
    const color = type === 'decision' 
      ? { bg: '#f97316', text: '#ffffff' }
      : NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];

    let x, y;
    if (parent) {
      const siblings = connections.filter(c => c.from_item_id === parentId).length;
      // Horizontal layout (default)
      x = parent.x + 220;
      y = parent.y + (siblings * 70) - 35;
    } else {
      const rect = canvasRef.current?.getBoundingClientRect();
      x = rect ? (rect.width / 2 - offset.x) / zoom : 400;
      y = rect ? (rect.height / 2 - offset.y) / zoom : 300;
    }

    const newNode = {
      type,
      x, y,
      content: type === 'decision' ? 'Ja / Nein?' : 'Neue Idee',
      color: color.bg,
      borderColor: color.text,
      width: type === 'decision' ? 140 : 160,
      height: type === 'decision' ? 70 : 50,
      is_done: false
    };

    createNode.mutate(newNode, {
      onSuccess: (data) => {
        if (data?.id) {
          if (parentId) {
            createConnection.mutate({ from_item_id: parentId, to_item_id: data.id, label: label || null });
          }
          if (shouldAutoEditNewNode()) {
            setTimeout(() => {
              setEditingNodeId(data.id);
              setEditText(newNode.content);
            }, 50);
          }
        }
      }
    });
  };

  const handleCanvasPointerDown = useCallback(
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest?.("[data-mindmap-node]")) return;
      e.preventDefault();
      try {
        canvasRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      setIsPanning(true);
      const { clientX, clientY } = getClientXY(e);
      panStartRef.current = { x: clientX - offset.x, y: clientY - offset.y };
      setSelectedNodeId(null);
      setNotePanel(null);
    },
    [offset, getClientXY],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const pos = getCanvasPos(e);
      mousePosRef.current = pos;

      if (isPanning) {
        const { clientX, clientY } = getClientXY(e);
        setOffset({ x: clientX - panStartRef.current.x, y: clientY - panStartRef.current.y });
        return;
      }

      const dragNode = draggingRef.current;
      if (dragNode) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragNode.id ? { ...n, x: pos.x - dragOffsetRef.current.x, y: pos.y - dragOffsetRef.current.y } : n,
          ),
        );
      }

      if (connectingFrom) forceRender((n) => n + 1);
    },
    [isPanning, getCanvasPos, connectingFrom, getClientXY],
  );

  const handlePointerUp = useCallback(
    (e) => {
      try {
        canvasRef.current?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      setIsPanning(false);

      const dragNode = draggingRef.current;
      if (dragNode) {
        const node = nodes.find((n) => n.id === dragNode.id);
        if (node && !String(dragNode.id).startsWith("temp_")) {
          updateNode.mutate({ id: dragNode.id, data: { x: node.x, y: node.y } });
        }
        draggingRef.current = null;
      }

      if (connectingFrom) {
        setConnectingFrom(null);
        setConnectLabel(null);
      }
    },
    [nodes, connectingFrom, updateNode],
  );

  const handleNodePointerDown = useCallback(
    (e, node) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      if (connectingFrom) {
        if (connectingFrom.id !== node.id) {
          const exists = connections.some(
            (c) =>
              (c.from_item_id === connectingFrom.id && c.to_item_id === node.id) ||
              (c.from_item_id === node.id && c.to_item_id === connectingFrom.id),
          );
          if (!exists) {
            createConnection.mutate({ from_item_id: connectingFrom.id, to_item_id: node.id, label: connectLabel });
          }
        }
        setConnectingFrom(null);
        setConnectLabel(null);
        return;
      }

      const pos = getCanvasPos(e);
      draggingRef.current = node;
      dragOffsetRef.current = { x: pos.x - node.x, y: pos.y - node.y };
      setSelectedNodeId(node.id);
    },
    [connectingFrom, connectLabel, connections, getCanvasPos, createConnection],
  );

  const handleWheel = useCallback((e) => {
    // Only handle if it's NOT a pinch-to-zoom (ctrlKey is true for pinch on macOS)
    if (e.ctrlKey) {
      // Pinch-to-zoom - prevent default browser zoom
      e.preventDefault();
      e.stopPropagation();
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      // Zoom with pinch
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.min(Math.max(0.3, zoom * delta), 2);
      
      setOffset({
        x: mx - (mx - offset.x) * (newZoom / zoom),
        y: my - (my - offset.y) * (newZoom / zoom)
      });
      setZoom(newZoom);
    } else {
      // Regular scroll - zoom canvas
      e.preventDefault();
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.min(Math.max(0.3, zoom * delta), 2);
      
      setOffset({
        x: mx - (mx - offset.x) * (newZoom / zoom),
        y: my - (my - offset.y) * (newZoom / zoom)
      });
      setZoom(newZoom);
    }
  }, [zoom, offset]);

  const saveEdit = useCallback(() => {
    const nodeId = editingNodeId;
    const text = editText.trim();
    
    // Сначала сбрасываем состояние редактирования
    setEditingNodeId(null);
    setEditText('');
    
    // Затем сохраняем если есть что сохранять
    if (nodeId && text) {
      updateNode.mutate({ id: nodeId, data: { content: text } });
    }
  }, [editingNodeId, editText, updateNode]);

  const toggleDone = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) updateNode.mutate({ id: nodeId, data: { is_done: !node.is_done } });
  };

  const saveNote = () => {
    if (notePanel) {
      updateNode.mutate({ id: notePanel.nodeId, data: { note: notePanel.note } });
      setNotePanel(null);
    }
  };

  const linkTask = (taskId) => {
    if (taskLinkPanel) {
      updateNode.mutate({ id: taskLinkPanel.nodeId, data: { linked_task_id: taskId || null } });
      setTaskLinkPanel(null);
    }
  };

  const clearAll = async () => {
    if (!confirm('Alle Knoten löschen?')) return;
    // Сначала очищаем UI
    setNodes([]);
    setConnections([]);
    // Затем удаляем на сервере
    await Promise.all([
      ...nodes.map(n => api.entities.CanvasItem.delete(n.id).catch(() => {})),
      ...connections.map(c => api.entities.CanvasConnection.delete(c.id).catch(() => {}))
    ]);
  };

  // Fit all nodes to view
  const fitToView = () => {
    if (nodes.length === 0) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Find bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      const w = node.width || 160;
      const h = node.height || 50;
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x + w > maxX) maxX = node.x + w;
      if (node.y + h > maxY) maxY = node.y + h;
    });
    
    // Add padding
    const padding = 80;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Calculate zoom to fit
    const zoomX = rect.width / contentWidth;
    const zoomY = rect.height / contentHeight;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.3), 1.5);
    
    // Calculate offset to center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const newOffsetX = rect.width / 2 - centerX * newZoom;
    const newOffsetY = rect.height / 2 - centerY * newZoom;
    
    setZoom(newZoom);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  if (userLoading || !currentUser) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400">Laden...</div>;
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50 ${
        isFullscreen
          ? "fixed inset-0 z-[9999] rounded-none w-screen h-screen"
          : "h-[calc(100dvh-80px)] min-h-[320px] sm:h-[calc(100vh-100px)] rounded-xl sm:rounded-2xl"
      }`}
    >
      
      {/* Floating toolbar: always visible while panning/zooming */}
      <div
        className={`fixed z-[70] ${isFullscreen ? 'top-2 sm:top-3' : 'top-[4.5rem] sm:top-3'} left-2 sm:left-1/2 sm:-translate-x-1/2`}
      >
        <div className="bg-white/95 backdrop-blur-xl shadow-2xl border border-slate-200/80 rounded-xl sm:rounded-2xl p-1.5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-1">
          {/* Add Buttons */}
          <div className="flex sm:flex-row flex-col items-center gap-1">
            <Button onClick={() => addNode('node')} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-9 w-9 sm:w-auto sm:px-3 rounded-xl shadow-lg shadow-indigo-200">
              <Plus className="w-4 h-4" />
              <span className="text-xs font-medium hidden md:inline ml-1.5">Knoten</span>
            </Button>
            <Button onClick={() => addNode('decision')} size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50 h-9 w-9 sm:w-auto sm:px-3 rounded-xl">
              <Diamond className="w-4 h-4" />
              <span className="text-xs font-medium hidden md:inline ml-1.5">Frage</span>
            </Button>
          </div>

          <div className="w-full h-px sm:w-px sm:h-7 bg-slate-200" />

          {/* Zoom Controls */}
          <div className="flex sm:flex-row flex-col items-center bg-slate-100 rounded-xl p-0.5 gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))} className="h-8 w-8 rounded-lg hover:bg-white">
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </Button>
            <span className="text-xs font-semibold text-slate-600 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(z * 1.2, 2))} className="h-8 w-8 rounded-lg hover:bg-white">
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </Button>
          </div>

          <div className="w-full h-px sm:w-px sm:h-7 bg-slate-200" />

          {/* View Controls */}
          <div className="flex sm:flex-row flex-col items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(1); }} className="h-8 w-8 rounded-lg" title="Zurücksetzen">
              <RotateCcw className="w-4 h-4 text-slate-500" />
            </Button>
            <Button 
              variant={isMobileVertical ? "default" : "ghost"}
              size="icon" 
              onClick={toggleVerticalLayout} 
              className={`h-8 w-8 rounded-lg sm:hidden ${isMobileVertical ? 'bg-green-600 text-white hover:bg-green-700' : 'text-green-600 hover:bg-green-50'}`}
              title={isMobileVertical ? "Original wiederherstellen" : "Vertikal anordnen"}
            >
              <AlignVerticalJustifyStart className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={fitToView} className="h-8 w-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Alle Knoten anzeigen">
              <Move className="w-4 h-4" />
            </Button>
            <Button 
              variant={isFullscreen ? "default" : "ghost"}
              size="icon" 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              className={`h-8 w-8 rounded-lg ${isFullscreen ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'hover:bg-slate-100'}`}
              title={isFullscreen ? "Vollbild beenden (ESC)" : "Vollbild"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={clearAll} className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50" title="Alles löschen">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Selected Node Panel - Mobile optimized */}
      {selectedNodeId && !editingNodeId && selectedNode && (
        <div className={`fixed ${isFullscreen ? 'top-14 sm:top-16' : 'top-[8.5rem] sm:top-16'} left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[70] sm:w-auto`}>
          <div className="bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-xl p-1 sm:p-2 flex items-center justify-center gap-0.5 sm:gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => addNode('node', selectedNodeId)} className="gap-1 h-7 px-1.5 sm:px-2 text-xs">
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingNodeId(selectedNodeId);
                setEditText(selectedNode.content || "");
              }}
              className="inline-flex h-7 px-1.5 sm:px-2 text-xs"
              title="Text bearbeiten"
            >
              <Pencil className="w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Text</span>
            </Button>
            
            {selectedNode.type === 'decision' && (
              <>
                <Button size="sm" variant="outline" onClick={() => { setConnectingFrom(selectedNode); setConnectLabel('yes'); }} className="h-7 px-1.5 sm:px-2 text-xs border-green-300 text-green-600 hover:bg-green-50">
                  ✓
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setConnectingFrom(selectedNode); setConnectLabel('no'); }} className="h-7 px-1.5 sm:px-2 text-xs border-red-300 text-red-600 hover:bg-red-50">
                  ✗
                </Button>
              </>
            )}
            
            <Button size="sm" variant="outline" onClick={() => setConnectingFrom(selectedNode)} className="h-7 px-1.5 sm:px-2">
              <GitBranch className="w-3 h-3" />
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setNotePanel({ nodeId: selectedNodeId, note: selectedNode.note || '' })} 
              className="h-7 px-1.5 sm:px-2"
            >
              <MessageSquare className="w-3 h-3" />
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setTaskLinkPanel({ nodeId: selectedNodeId, taskId: selectedNode.linked_task_id || '' })} 
              className="h-7 px-1.5 sm:px-2 border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              <ListTodo className="w-3 h-3" />
            </Button>
            
            <div className="flex gap-0.5">
              {NODE_COLORS.slice(0, 4).map(c => (
                <button
                  key={c.bg}
                  className="w-5 h-5 rounded-full border border-white shadow hover:scale-110 active:scale-95"
                  style={{ backgroundColor: c.bg }}
                  onClick={() => updateNode.mutate({ id: selectedNodeId, data: { color: c.bg, borderColor: c.text } })}
                />
              ))}
            </div>
            
            <Button size="sm" variant="ghost" onClick={() => deleteNode.mutate(selectedNodeId)} className="text-red-500 hover:bg-red-50 h-7 px-1.5 sm:px-2">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Connection Mode */}
      {connectingFrom && (
        <div className="absolute top-14 sm:top-16 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30">
          <div className={`px-3 py-1.5 rounded-full shadow-lg flex items-center justify-center gap-2 text-white text-xs ${
            connectLabel === 'yes' ? 'bg-green-500' : connectLabel === 'no' ? 'bg-red-500' : 'bg-indigo-500'
          }`}>
            <GitBranch className="w-3 h-3" />
            <span>Ziel wählen</span>
            <button onClick={() => { setConnectingFrom(null); setConnectLabel(null); }} className="hover:bg-white/20 rounded-full p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Note Panel - Mobile optimized */}
      {notePanel && (
        <div className="absolute top-28 sm:top-32 left-2 right-2 sm:left-auto sm:right-4 z-30 sm:w-72">
          <div className="bg-white shadow-xl border border-slate-200 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-slate-700 flex items-center gap-2 text-sm">
                <StickyNote className="w-4 h-4" /> Notiz
              </span>
              <button onClick={() => setNotePanel(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              value={notePanel.note}
              onChange={(e) => setNotePanel({ ...notePanel, note: e.target.value })}
              placeholder="Notiz hinzufügen..."
              className="min-h-[80px] mb-2 text-sm"
            />
            <Button size="sm" onClick={saveNote} className="w-full">Speichern</Button>
          </div>
        </div>
      )}

      {/* Task Link Panel - Mobile optimized */}
      {taskLinkPanel && (
        <div className="absolute top-28 sm:top-32 left-2 right-2 sm:left-auto sm:right-4 z-30 sm:w-72">
          <div className="bg-white shadow-xl border border-slate-200 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-slate-700 flex items-center gap-2 text-sm">
                <ListTodo className="w-4 h-4" /> Mit Ticket verknüpfen
              </span>
              <button onClick={() => setTaskLinkPanel(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Select 
              value={taskLinkPanel.taskId || "none"} 
              onValueChange={(v) => setTaskLinkPanel({ ...taskLinkPanel, taskId: v === "none" ? null : v })}
            >
              <SelectTrigger className="mb-2">
                <SelectValue placeholder="Ticket auswählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Verknüpfung</SelectItem>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => linkTask(taskLinkPanel.taskId)} className="w-full">Verknüpfen</Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`w-full h-full canvas-bg touch-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          touchAction: "none",
          backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* SVG for connections */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="50%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
            {connections.map(conn => {
              const from = nodes.find(n => n.id === conn.from_item_id);
              const to = nodes.find(n => n.id === conn.to_item_id);
              if (!from || !to) return null;

              // Get edge points (not centers)
              const fromW = from.width || 160;
              const fromH = from.height || 50;
              const toW = to.width || 160;
              const toH = to.height || 50;

              const fromCx = from.x + fromW / 2;
              const fromCy = from.y + fromH / 2;
              const toCx = to.x + toW / 2;
              const toCy = to.y + toH / 2;

              const dx = toCx - fromCx;
              const dy = toCy - fromCy;

              // Determine best exit/entry points
              let f, t;

              if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal connection
                if (dx > 0) {
                  f = { x: from.x + fromW, y: fromCy };
                  t = { x: to.x, y: toCy };
                } else {
                  f = { x: from.x, y: fromCy };
                  t = { x: to.x + toW, y: toCy };
                }
              } else {
                // Vertical connection
                if (dy > 0) {
                  f = { x: fromCx, y: from.y + fromH };
                  t = { x: toCx, y: to.y };
                } else {
                  f = { x: fromCx, y: from.y };
                  t = { x: toCx, y: to.y + toH };
                }
              }

              const midX = (f.x + t.x) / 2;
              const midY = (f.y + t.y) / 2;

              // Smart bezier curves
              let path;
              const isHorizontal = Math.abs(dx) > Math.abs(dy);

              if (isHorizontal) {
                const tension = Math.min(Math.abs(dx) * 0.4, 80);
                path = `M ${f.x} ${f.y} C ${f.x + (dx > 0 ? tension : -tension)} ${f.y}, ${t.x + (dx > 0 ? -tension : tension)} ${t.y}, ${t.x} ${t.y}`;
              } else {
                const tension = Math.min(Math.abs(dy) * 0.4, 80);
                path = `M ${f.x} ${f.y} C ${f.x} ${f.y + (dy > 0 ? tension : -tension)}, ${t.x} ${t.y + (dy > 0 ? -tension : tension)}, ${t.x} ${t.y}`;
              }

              const strokeColor = conn.label === 'yes' ? '#22c55e' : conn.label === 'no' ? '#ef4444' : '#94a3b8';

              return (
                <g key={conn.id}>
                  {/* Shadow for depth */}
                  <path
                    d={path}
                    fill="none"
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    style={{ filter: 'blur(2px)' }}
                  />
                  {/* Main line */}
                  <path
                    d={path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    style={{ 
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))'
                    }}
                  />
                  {/* Animated gradient overlay for "flow" effect */}
                  <path
                    d={path}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.3"
                  />
                  {conn.label && (
                    <g>
                      <rect 
                        x={midX - 20} 
                        y={midY - 12} 
                        width="40" 
                        height="18" 
                        rx="9" 
                        fill="white" 
                        stroke={conn.label === 'yes' ? '#22c55e' : '#ef4444'}
                        strokeWidth="1.5"
                      />
                      <text x={midX} y={midY + 3} textAnchor="middle" fontSize="10" fontWeight="600"
                        fill={conn.label === 'yes' ? '#16a34a' : '#dc2626'}>
                        {conn.label === 'yes' ? 'Ja' : 'Nein'}
                      </text>
                    </g>
                  )}
                  {/* Delete button on hover */}
                  <circle cx={midX} cy={midY + (conn.label ? 20 : 0)} r="10" fill="white" stroke="#ef4444" strokeWidth="2"
                    className="opacity-0 hover:opacity-100 cursor-pointer pointer-events-auto transition-opacity"
                    onClick={() => deleteConnection.mutate(conn.id)} />
                  <text x={midX} y={midY + (conn.label ? 24 : 4)} textAnchor="middle" fontSize="12" fill="#ef4444"
                    className="opacity-0 hover:opacity-100 pointer-events-none">×</text>
                </g>
              );
            })}

            {connectingFrom && (
              <path
                d={`M ${getCenter(connectingFrom).x} ${getCenter(connectingFrom).y} L ${mousePosRef.current.x} ${mousePosRef.current.y}`}
                fill="none"
                stroke={connectLabel === 'yes' ? '#22c55e' : connectLabel === 'no' ? '#ef4444' : '#6366f1'}
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
            )}
          </g>
        </svg>

        {/* Nodes: layer ignores hits except on nodes (pointer-events) so pan works on empty canvas */}
        <div
          className="pointer-events-none absolute left-0 top-0 z-[1]"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {nodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const isEditing = editingNodeId === node.id;
            const isDecision = node.type === 'decision';
            const isDone = node.is_done;
            const hasNote = !!node.note;
            const hasLinkedTask = !!node.linked_task_id;
            const linkedTask = hasLinkedTask ? tasks.find(t => t.id === node.linked_task_id) : null;

            return (
              <div
                key={node.id}
                data-mindmap-node
                className={`pointer-events-auto absolute select-none touch-manipulation ${isSelected ? "z-50" : "z-10"}`}
                style={{ left: node.x, top: node.y, width: node.width || 160 }}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onDoubleClick={() => {
                  setEditingNodeId(node.id);
                  setEditText(node.content || "");
                }}
              >
                {/* Decision diamond shape */}
                {isDecision ? (
                  <div
                    className={`relative cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
                    style={{ width: node.width || 140, height: node.height || 70 }}
                  >
                    <svg viewBox="0 0 100 70" className="w-full h-full" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>
                      <polygon
                        points="50,2 98,35 50,68 2,35"
                        fill={isDone ? '#22c55e' : (node.color || '#f97316')}
                        stroke={isSelected ? '#6366f1' : 'white'}
                        strokeWidth="2"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden">
                      {isEditing ? (
                        <Input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { 
                            e.stopPropagation();
                            if (e.key === 'Enter') { 
                              e.preventDefault(); 
                              saveEdit(); 
                            } 
                            if (e.key === 'Escape') { 
                              setEditingNodeId(null); 
                              setEditText(''); 
                            } 
                          }}
                          onBlur={saveEdit}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="text-xs text-center bg-white/90 border-0 h-6 w-20 max-w-[90%]"
                        />
                      ) : (
                        <span 
                          className="font-semibold text-white text-center leading-tight break-words overflow-hidden"
                          style={{ 
                            fontSize: `${Math.max(8, Math.min(12, 120 / Math.max(node.content?.length || 1, 10)))}px`,
                            wordBreak: 'break-word',
                            maxWidth: '90%'
                          }}
                        >
                          {node.content}
                        </span>
                      )}
                    </div>
                    {isDone && <Check className="absolute -top-1 -right-1 w-5 h-5 text-white bg-green-500 rounded-full p-0.5" />}
                    {hasNote && <MessageSquare className="absolute -bottom-1 -right-1 w-4 h-4 text-indigo-600 bg-white rounded-full p-0.5" />}
                    {hasLinkedTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTaskId(node.linked_task_id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute -bottom-1 -left-1 w-5 h-5 bg-blue-500 text-white rounded-full p-0.5 flex items-center justify-center hover:bg-blue-600"
                        title={linkedTask?.title || 'Ticket öffnen'}
                      >
                        <ListTodo className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  /* Regular node */
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-lg cursor-grab active:cursor-grabbing relative ${
                      isSelected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''
                    }`}
                    style={{ backgroundColor: isDone ? '#22c55e' : (node.color || '#6366f1'), color: node.borderColor || '#fff', minWidth: 80, maxWidth: 200 }}
                  >
                    {isEditing ? (
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { 
                          e.stopPropagation();
                          if (e.key === 'Enter') { 
                            e.preventDefault(); 
                            saveEdit(); 
                          } 
                          if (e.key === 'Escape') { 
                            setEditingNodeId(null); 
                            setEditText(''); 
                          } 
                        }}
                        onBlur={saveEdit}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="bg-white/20 border-white/30 text-inherit h-7 text-sm max-w-full min-w-0"
                      />
                    ) : (
                      <div
                        className={`font-semibold text-center break-words [overflow-wrap:anywhere] whitespace-pre-wrap max-w-full px-0.5 ${isDone ? "line-through opacity-80" : ""}`}
                        style={{
                          fontSize: `${Math.max(10, Math.min(14, 180 / Math.max(node.content?.length || 1, 12)))}px`,
                          wordBreak: "break-word",
                        }}
                      >
                        {node.content || "Doppelklick / Stift"}
                      </div>
                    )}
                    
                    {/* Checkbox в правом верхнем углу */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDone(node.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-md ${
                        isDone 
                          ? 'bg-white' 
                          : 'bg-white/90 hover:bg-white'
                      }`}
                    >
                      {isDone && <Check className="w-4 h-4 text-green-600" />}
                    </button>
                    
                    {hasNote && <MessageSquare className="absolute -bottom-2 -left-2 w-5 h-5 text-indigo-600 bg-white rounded-full p-0.5 shadow" />}
                    {hasLinkedTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTaskId(node.linked_task_id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute -bottom-2 right-6 w-5 h-5 bg-blue-500 text-white rounded-full p-0.5 flex items-center justify-center hover:bg-blue-600 shadow"
                        title={linkedTask?.title || 'Ticket öffnen'}
                      >
                        <ListTodo className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                
                {/* Quick add button */}
                {isSelected && !isEditing && (
                  <button
                    type="button"
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-indigo-600 hover:scale-110 pointer-events-auto"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      addNode("node", node.id);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
          <div className="text-center">
            <Lightbulb className="w-12 h-12 sm:w-16 sm:h-16 text-indigo-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-slate-600 mb-1 sm:mb-2">Mind Map erstellen</h3>
            <p className="text-slate-400 mb-3 sm:mb-4 text-sm">Fügen Sie Knoten hinzu</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pointer-events-auto">
              <Button onClick={() => addNode('node')} className="bg-indigo-600 hover:bg-indigo-700" size="sm">
                <Plus className="w-4 h-4 mr-2" /> Knoten
              </Button>
              <Button onClick={() => addNode('decision')} variant="outline" className="border-orange-300 text-orange-600" size="sm">
                <Diamond className="w-4 h-4 mr-2" /> Entscheidung
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-auto text-[10px] sm:text-xs text-slate-500 bg-white/90 backdrop-blur px-2 sm:px-3 py-1.5 rounded-lg pointer-events-none max-w-[calc(100vw-1rem)]">
        <span className="sm:hidden">Tipp: Knoten antippen → Stift (oben) zum Schreiben • Ziehen verschiebt • 2 Finger zoomen</span>
        <span className="hidden sm:inline">Doppelklick = Bearbeiten • Ziehen = Verschieben • Scroll = Zoom</span>
      </div>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={openTask}
        isOpen={!!openTask}
        onClose={() => setOpenTaskId(null)}
        allAssignees={allAssignees}
        currentUser={currentUser}
        projectId={projectId}
        onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
      />
    </div>
  );
}