import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ZoomIn, ZoomOut, RotateCcw, GitBranch, Lightbulb, X, Check, Diamond, StickyNote, MessageSquare, ListTodo, Maximize2, Minimize2, Move, AlignVerticalJustifyStart, Pencil, Paperclip, FileText, GripHorizontal, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TaskDetailDialog from "@/components/kanban/TaskDetailDialog";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const clampZoom = (z) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);

/** Wheel deltas arrive in pixels, lines or pages depending on device. */
function wheelDeltaToPixels(delta, deltaMode) {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * 400;
  return delta;
}

function isTypingTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

const NODE_COLORS = [
  { bg: '#6366f1', text: '#ffffff' },
  { bg: '#8b5cf6', text: '#ffffff' },
  { bg: '#ec4899', text: '#ffffff' },
  { bg: '#ef4444', text: '#ffffff' },
  { bg: '#22c55e', text: '#ffffff' },
  { bg: '#3b82f6', text: '#ffffff' },
];

// Paper-like tones for sticky notes; text stays dark so handwriting-style notes stay readable.
const STICKY_COLORS = [
  { bg: '#fde68a', text: '#1f2937' },
  { bg: '#bbf7d0', text: '#1f2937' },
  { bg: '#fbcfe8', text: '#1f2937' },
  { bg: '#bfdbfe', text: '#1f2937' },
  { bg: '#fed7aa', text: '#1f2937' },
  { bg: '#e9d5ff', text: '#1f2937' },
];

const STICKY_DEFAULT_SIZE = 180;
const STICKY_MIN_SIZE = 100;
const STICKY_MAX_SIZE = 520;
const TOOLBAR_STORAGE_PREFIX = 'orbylox_canvas_toolbar_';

/** Sticky text shrinks as it grows longer, like Miro's auto-fit. */
function stickyFontSize(text, size) {
  const length = Math.max((text || '').length, 1);
  const base = size / 7;
  return Math.max(11, Math.min(28, base * (12 / Math.max(length, 12)) + 8));
}

export default function MindMap() {
  const queryClient = useQueryClient();
  const canvasRef = useRef(null);
  const projectId = new URLSearchParams(window.location.search).get('project');

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Viewport is mirrored in a ref: wheel/keyboard handlers need the current value
  // synchronously, and rendering only once per frame keeps zooming smooth.
  const viewRef = useRef({ offset: { x: 0, y: 0 }, zoom: 1 });
  const rafRef = useRef(null);
  const [isSpacePan, setIsSpacePan] = useState(false);
  const spacePanRef = useRef(false);
  const fitToViewRef = useRef(null);
  // Active touch pointers for two-finger pinch/pan.
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  // State (not just a ref) so the wheel effect re-runs once the canvas is mounted.
  const [canvasEl, setCanvasEl] = useState(null);
  const attachCanvasRef = useCallback((el) => {
    canvasRef.current = el;
    setCanvasEl(el);
  }, []);

  /* ------------------------------------------------- movable toolbar */
  const toolbarRef = useRef(null);
  const toolbarDragRef = useRef(null);
  const [toolbarPos, setToolbarPos] = useState(null); // null = default position
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const toolbarStorageKey = `${TOOLBAR_STORAGE_PREFIX}${projectId || 'default'}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(toolbarStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.pos && typeof saved.pos.x === 'number') setToolbarPos(saved.pos);
      setToolbarCollapsed(!!saved?.collapsed);
    } catch {
      /* ignore malformed prefs */
    }
  }, [toolbarStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        toolbarStorageKey,
        JSON.stringify({ pos: toolbarPos, collapsed: toolbarCollapsed }),
      );
    } catch {
      /* storage full or blocked — position just won't persist */
    }
  }, [toolbarPos, toolbarCollapsed, toolbarStorageKey]);

  const handleToolbarPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    toolbarDragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const handleToolbarPointerMove = useCallback((e) => {
    const drag = toolbarDragRef.current;
    if (!drag) return;
    const rect = toolbarRef.current?.getBoundingClientRect();
    const width = rect?.width || 240;
    const height = rect?.height || 48;
    const maxX = Math.max(4, window.innerWidth - width - 4);
    const maxY = Math.max(4, window.innerHeight - height - 4);
    setToolbarPos({
      x: Math.min(Math.max(e.clientX - drag.dx, 4), maxX),
      y: Math.min(Math.max(e.clientY - drag.dy, 4), maxY),
    });
  }, []);

  const handleToolbarPointerUp = useCallback((e) => {
    toolbarDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);
  
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editText, setEditText] = useState('');
  const [notePanel, setNotePanel] = useState(null); // { nodeId, note }
  const [commentPanel, setCommentPanel] = useState(null); // { nodeId }
  const [newComment, setNewComment] = useState('');
  const resizingRef = useRef(null); // { id, startX, startY, width, height }
  const saveEditRef = useRef(null); // set below; lets pointer handlers commit an open editor
  const [taskLinkPanel, setTaskLinkPanel] = useState(null); // { nodeId, taskId }
  const [fileHubPanel, setFileHubPanel] = useState(null); // { nodeId }
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

  const { data: projectFiles = [] } = useQuery({
    queryKey: ['canvasFileHubList', projectId],
    queryFn: async () => {
      const all = await api.entities.FileRecord.list('-created_date', 500);
      return all.filter((f) => f.project_id === projectId);
    },
    staleTime: 30000,
    enabled: !!projectId,
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

  /* --------------------------------------------------- node comment threads */

  const { data: comments = [] } = useQuery({
    queryKey: ['canvasComments', projectId],
    queryFn: async () => {
      const all = await api.entities.CanvasComment.list('-created_date', 500);
      return all.filter(c => c.project_id === projectId);
    },
    staleTime: 30000,
    enabled: !!projectId,
  });

  const commentsByNode = React.useMemo(() => {
    const map = new Map();
    for (const comment of comments) {
      const list = map.get(comment.item_id) || [];
      list.push(comment);
      map.set(comment.item_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
    }
    return map;
  }, [comments]);

  const addComment = useMutation({
    mutationFn: ({ nodeId, content }) => api.entities.CanvasComment.create({
      item_id: nodeId,
      project_id: projectId,
      content,
      author_email: currentUser?.email || null,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canvasComments', projectId] }),
  });

  const deleteComment = useMutation({
    mutationFn: (id) => api.entities.CanvasComment.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['canvasComments', projectId] });
      const previous = queryClient.getQueryData(['canvasComments', projectId]);
      queryClient.setQueryData(['canvasComments', projectId], old => (old || []).filter(c => c.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['canvasComments', projectId], context?.previous ?? []);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['canvasComments', projectId] }),
  });

  const submitComment = useCallback(() => {
    const text = newComment.trim();
    if (!text || !commentPanel) return;
    addComment.mutate({ nodeId: commentPanel.nodeId, content: text });
    setNewComment('');
  }, [newComment, commentPanel, addComment]);

  // Helpers — works for mouse, touch, and pen (PointerEvent)
  const getClientXY = useCallback((e) => {
    if (e && typeof e.clientX === "number" && !Number.isNaN(e.clientX)) {
      return { clientX: e.clientX, clientY: e.clientY };
    }
    const te = e?.nativeEvent?.touches?.[0] || e?.nativeEvent?.changedTouches?.[0];
    if (te) return { clientX: te.clientX, clientY: te.clientY };
    return { clientX: 0, clientY: 0 };
  }, []);

  // Keep the mirror in sync when the viewport is changed outside the handlers below.
  useEffect(() => {
    viewRef.current = { offset, zoom };
  }, [offset, zoom]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const setView = useCallback((next) => {
    viewRef.current = next;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setOffset(viewRef.current.offset);
      setZoom(viewRef.current.zoom);
    });
  }, []);

  /** Zoom while keeping the point under the cursor fixed — the Miro/Figma behaviour. */
  const zoomAtClientPoint = useCallback(
    (factor, clientX, clientY) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { offset: o, zoom: z } = viewRef.current;
      const nextZoom = clampZoom(z * factor);
      if (nextZoom === z) return;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const ratio = nextZoom / z;
      setView({
        zoom: nextZoom,
        offset: { x: mx - (mx - o.x) * ratio, y: my - (my - o.y) * ratio },
      });
    },
    [setView],
  );

  const zoomAtViewportCenter = useCallback(
    (factor) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAtClientPoint(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAtClientPoint],
  );

  const resetZoomKeepingCenter = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { zoom: z } = viewRef.current;
    zoomAtClientPoint(1 / z, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [zoomAtClientPoint]);

  // Native listener with passive:false — React attaches onWheel passively, so
  // preventDefault() there is ignored and the browser zooms the whole page instead.
  useEffect(() => {
    const el = canvasEl;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();

      // Trackpad pinch arrives as ctrlKey+wheel; cmd/ctrl+wheel is the mouse equivalent.
      if (e.ctrlKey || e.metaKey) {
        const dy = wheelDeltaToPixels(e.deltaY, e.deltaMode);
        zoomAtClientPoint(Math.exp(-dy * 0.01), e.clientX, e.clientY);
        return;
      }

      let dx = wheelDeltaToPixels(e.deltaX, e.deltaMode);
      let dy = wheelDeltaToPixels(e.deltaY, e.deltaMode);
      if (e.shiftKey && dx === 0) {
        dx = dy;
        dy = 0;
      }
      if (dx === 0 && dy === 0) return;

      const { offset: o, zoom: z } = viewRef.current;
      setView({ zoom: z, offset: { x: o.x - dx, y: o.y - dy } });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [canvasEl, zoomAtClientPoint, setView]);

  // Space = temporary hand tool, plus the usual zoom shortcuts.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;

      if (e.code === "Space" && !spacePanRef.current) {
        e.preventDefault();
        spacePanRef.current = true;
        setIsSpacePan(true);
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomAtViewportCenter(1.2);
      } else if (mod && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        zoomAtViewportCenter(1 / 1.2);
      } else if (mod && e.key === "0") {
        e.preventDefault();
        resetZoomKeepingCenter();
      } else if (e.shiftKey && e.key === "1") {
        e.preventDefault();
        fitToViewRef.current?.();
      }
    };

    const onKeyUp = (e) => {
      if (e.code === "Space") {
        spacePanRef.current = false;
        setIsSpacePan(false);
      }
    };

    const onBlur = () => {
      spacePanRef.current = false;
      setIsSpacePan(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [zoomAtViewportCenter, resetZoomKeepingCenter]);

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
      setView({ offset: { x: 20, y: 20 }, zoom: 1 });
    }
  }, [nodes, connections, isMobileVertical, originalPositions, setView]);

  // Add node
  const addNode = (type = 'node', parentId = null, label = null, atPos = null) => {
    const parent = parentId ? nodes.find(n => n.id === parentId) : null;
    const color = type === 'decision'
      ? { bg: '#f97316', text: '#ffffff' }
      : type === 'sticky'
        ? STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]
        : NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];

    let x, y;
    if (atPos) {
      const size = type === 'sticky' ? STICKY_DEFAULT_SIZE : type === 'decision' ? 140 : 160;
      x = atPos.x - size / 2;
      y = atPos.y - (type === 'sticky' ? size / 2 : 25);
    } else if (parent) {
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
      content: type === 'decision' ? 'Ja / Nein?' : type === 'sticky' ? 'Notiz' : 'Neue Idee',
      color: color.bg,
      borderColor: color.text,
      width: type === 'decision' ? 140 : type === 'sticky' ? STICKY_DEFAULT_SIZE : 160,
      height: type === 'decision' ? 70 : type === 'sticky' ? STICKY_DEFAULT_SIZE : 50,
      is_done: false
    };

    createNode.mutate(newNode, {
      onSuccess: (data) => {
        if (data?.id) {
          if (parentId) {
            createConnection.mutate({ from_item_id: parentId, to_item_id: data.id, label: label || null });
          }
          setSelectedNodeId(data.id);
          if (shouldAutoEditNewNode()) {
            setTimeout(() => {
              setEditingNodeId(data.id);
              // Empty, so the first keystroke replaces the placeholder text.
              setEditText("");
            }, 50);
          }
        }
      }
    });
  };

  const beginPinch = useCallback(() => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return;
    const [a, b] = points;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    pinchRef.current = {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      centerX: (a.x + b.x) / 2 - rect.left,
      centerY: (a.y + b.y) / 2 - rect.top,
      zoom: viewRef.current.zoom,
      offset: { ...viewRef.current.offset },
    };
  }, []);

  const handleCanvasPointerDown = useCallback(
    (e) => {
      // Clicking the canvas commits an open editor — preventDefault below would
      // otherwise swallow the blur and leave the text field active.
      saveEditRef.current?.();
      if (e.pointerType === "touch") {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size >= 2) {
          setIsPanning(false);
          draggingRef.current = null;
          beginPinch();
          return;
        }
      }
      const isMiddleButton = e.pointerType === "mouse" && e.button === 1;
      const isHandTool = isMiddleButton || spacePanRef.current;
      if (e.pointerType === "mouse" && e.button !== 0 && !isMiddleButton) return;
      // Hand tool pans from anywhere, including on top of a node.
      if (!isHandTool && e.target.closest?.("[data-mindmap-node]")) return;
      e.preventDefault();
      try {
        canvasRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      setIsPanning(true);
      const { clientX, clientY } = getClientXY(e);
      panStartRef.current = { x: clientX - offset.x, y: clientY - offset.y };
      if (!isHandTool) {
        setSelectedNodeId(null);
        setNotePanel(null);
        setFileHubPanel(null);
      }
    },
    [offset, getClientXY, beginPinch],
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (e.pointerType === "touch" && pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Two fingers: zoom around the midpoint and follow it, like Miro.
      const pinch = pinchRef.current;
      if (pinch && pointersRef.current.size >= 2) {
        const [a, b] = [...pointersRef.current.values()];
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const centerX = (a.x + b.x) / 2 - rect.left;
        const centerY = (a.y + b.y) / 2 - rect.top;
        const nextZoom = clampZoom(pinch.zoom * (distance / pinch.distance));
        const ratio = nextZoom / pinch.zoom;
        setView({
          zoom: nextZoom,
          offset: {
            x: centerX - (pinch.centerX - pinch.offset.x) * ratio,
            y: centerY - (pinch.centerY - pinch.offset.y) * ratio,
          },
        });
        return;
      }

      // Sticky note resize: deltas are in screen pixels, so divide by zoom.
      const resize = resizingRef.current;
      if (resize) {
        const { clientX, clientY } = getClientXY(e);
        const z = viewRef.current.zoom || 1;
        const size = Math.round(
          Math.min(
            STICKY_MAX_SIZE,
            Math.max(
              STICKY_MIN_SIZE,
              Math.max(
                resize.width + (clientX - resize.startX) / z,
                resize.height + (clientY - resize.startY) / z,
              ),
            ),
          ),
        );
        setNodes((prev) => prev.map((n) => (n.id === resize.id ? { ...n, width: size, height: size } : n)));
        return;
      }

      const pos = getCanvasPos(e);
      mousePosRef.current = pos;

      if (isPanning) {
        const { clientX, clientY } = getClientXY(e);
        setView({
          zoom: viewRef.current.zoom,
          offset: { x: clientX - panStartRef.current.x, y: clientY - panStartRef.current.y },
        });
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
    [isPanning, getCanvasPos, connectingFrom, getClientXY, setView],
  );

  const handlePointerUp = useCallback(
    (e) => {
      try {
        canvasRef.current?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      if (e.pointerType === "touch") {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) pinchRef.current = null;
      }
      setIsPanning(false);

      const resize = resizingRef.current;
      if (resize) {
        resizingRef.current = null;
        const node = nodes.find((n) => n.id === resize.id);
        if (node && !String(node.id).startsWith("temp_")) {
          updateNode.mutate({ id: node.id, data: { width: node.width, height: node.height } });
        }
        return;
      }

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
      // Hand tool active: let the event bubble so the canvas pans instead of dragging the node.
      if (spacePanRef.current) return;
      // Switching to another node closes and saves the current editor.
      if (editingNodeIdRef.current && editingNodeIdRef.current !== node.id) {
        saveEditRef.current?.();
      }
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

  const editingNodeIdRef = useRef(null);
  useEffect(() => {
    editingNodeIdRef.current = editingNodeId;
    saveEditRef.current = editingNodeId ? saveEdit : null;
  }, [editingNodeId, saveEdit]);

  // Keyboard on the board itself: delete, edit, deselect — no toolbar detour.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (editingNodeId) return;

      if (e.key === "Escape") {
        setSelectedNodeId(null);
        return;
      }
      if (!selectedNodeId) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteNode.mutate(selectedNodeId);
        setSelectedNodeId(null);
        setNotePanel(null);
        setCommentPanel(null);
        setFileHubPanel(null);
        return;
      }

      if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        const node = nodes.find((n) => n.id === selectedNodeId);
        setEditingNodeId(selectedNodeId);
        setEditText(node?.content || "");
        return;
      }

      // Typing on a selected node starts editing and replaces the text, like Miro.
      if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setEditingNodeId(selectedNodeId);
        setEditText(e.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, editingNodeId, nodes, deleteNode]);

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

  const attachFileHubToNode = (file) => {
    if (!fileHubPanel || !file?.id) return;
    const node = nodes.find((n) => n.id === fileHubPanel.nodeId);
    const prev = Array.isArray(node?.file_hub_refs) ? node.file_hub_refs : [];
    if (prev.some((r) => String(r.id) === String(file.id))) return;
    const next = [
      ...prev,
      { id: file.id, name: file.name || "Datei", url: file.url || "" },
    ];
    updateNode.mutate({ id: fileHubPanel.nodeId, data: { file_hub_refs: next } });
  };

  const removeFileHubRef = (fileId) => {
    if (!fileHubPanel) return;
    const node = nodes.find((n) => n.id === fileHubPanel.nodeId);
    const next = (Array.isArray(node?.file_hub_refs) ? node.file_hub_refs : []).filter(
      (r) => String(r.id) !== String(fileId),
    );
    updateNode.mutate({ id: fileHubPanel.nodeId, data: { file_hub_refs: next } });
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
  const fitToView = useCallback(() => {
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
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), MIN_ZOOM), 1.5);

    // Calculate offset to center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const newOffsetX = rect.width / 2 - centerX * newZoom;
    const newOffsetY = rect.height / 2 - centerY * newZoom;

    setView({ zoom: newZoom, offset: { x: newOffsetX, y: newOffsetY } });
  }, [nodes, setView]);

  useEffect(() => {
    fitToViewRef.current = fitToView;
  }, [fitToView]);

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
      
      {/* Floating toolbar: draggable by its grip, collapsible, position remembered per project */}
      <div
        ref={toolbarRef}
        className={
          toolbarPos
            ? "fixed z-[70]"
            : `fixed z-[70] ${isFullscreen ? 'top-2 sm:top-3' : 'top-[4.5rem] sm:top-3'} left-2 sm:left-1/2 sm:-translate-x-1/2`
        }
        style={toolbarPos ? { left: toolbarPos.x, top: toolbarPos.y } : undefined}
      >
        {toolbarCollapsed && (
          <div className="bg-white/95 backdrop-blur-xl shadow-2xl border border-slate-200/80 rounded-full p-1 flex items-center gap-0.5">
            <button
              type="button"
              onPointerDown={handleToolbarPointerDown}
              onPointerMove={handleToolbarPointerMove}
              onPointerUp={handleToolbarPointerUp}
              onPointerCancel={handleToolbarPointerUp}
              className="h-8 w-6 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 cursor-grab active:cursor-grabbing touch-none"
              title="Leiste verschieben"
            >
              <GripHorizontal className="w-4 h-4" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setToolbarCollapsed(false)}
              className="h-8 w-8 rounded-full text-indigo-600 hover:bg-indigo-50"
              title="Werkzeuge einblenden"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className={`bg-white/95 backdrop-blur-xl shadow-2xl border border-slate-200/80 rounded-xl sm:rounded-2xl p-1.5 flex-col sm:flex-row items-center gap-1.5 sm:gap-1 ${toolbarCollapsed ? 'hidden' : 'flex'}`}>
          {/* Drag grip + collapse */}
          <div className="flex sm:flex-row flex-col items-center gap-0.5">
            <button
              type="button"
              onPointerDown={handleToolbarPointerDown}
              onPointerMove={handleToolbarPointerMove}
              onPointerUp={handleToolbarPointerUp}
              onPointerCancel={handleToolbarPointerUp}
              className="h-9 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-grab active:cursor-grabbing touch-none"
              title="Leiste verschieben"
            >
              <GripHorizontal className="w-4 h-4" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setToolbarCollapsed(true)}
              className="h-7 w-6 rounded-lg text-slate-400 hover:bg-slate-100"
              title="Leiste einklappen"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-full h-px sm:w-px sm:h-7 bg-slate-200" />

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
            <Button onClick={() => addNode('sticky')} size="sm" variant="outline" className="border-amber-300 text-amber-600 hover:bg-amber-50 h-9 w-9 sm:w-auto sm:px-3 rounded-xl" title="Post-it">
              <StickyNote className="w-4 h-4" />
              <span className="text-xs font-medium hidden md:inline ml-1.5">Post-it</span>
            </Button>
          </div>

          <div className="w-full h-px sm:w-px sm:h-7 bg-slate-200" />

          {/* Zoom Controls */}
          <div className="flex sm:flex-row flex-col items-center bg-slate-100 rounded-xl p-0.5 gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => zoomAtViewportCenter(1 / 1.2)} className="h-8 w-8 rounded-lg hover:bg-white" title="Verkleinern (Cmd/Strg + -)">
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </Button>
            <button
              type="button"
              onClick={resetZoomKeepingCenter}
              title="Auf 100 % zuruecksetzen (Cmd/Strg + 0)"
              className="text-xs font-semibold text-slate-600 w-10 text-center tabular-nums hover:text-indigo-600"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button variant="ghost" size="icon" onClick={() => zoomAtViewportCenter(1.2)} className="h-8 w-8 rounded-lg hover:bg-white" title="Vergroessern (Cmd/Strg + +)">
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </Button>
          </div>

          <div className="w-full h-px sm:w-px sm:h-7 bg-slate-200" />

          {/* View Controls */}
          <div className="flex sm:flex-row flex-col items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => setView({ offset: { x: 0, y: 0 }, zoom: 1 })} className="h-8 w-8 rounded-lg" title="Zurücksetzen">
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
              title="Notiz"
            >
              <StickyNote className="w-3 h-3" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => { setCommentPanel({ nodeId: selectedNodeId }); setNewComment(''); }}
              className="h-7 px-1.5 sm:px-2 border-amber-300 text-amber-600 hover:bg-amber-50"
              title="Kommentare"
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

            <Button
              size="sm"
              variant="outline"
              onClick={() => setFileHubPanel({ nodeId: selectedNodeId })}
              className="h-7 px-1.5 sm:px-2 border-violet-300 text-violet-600 hover:bg-violet-50"
              title="Datei aus File Hub"
            >
              <Paperclip className="w-3 h-3" />
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

      {/* Comment thread for a single node */}
      {commentPanel && (
        <div className="absolute top-28 sm:top-32 left-2 right-2 sm:left-auto sm:right-4 z-[60] sm:w-80">
          <div className="bg-white shadow-xl border border-slate-200 rounded-xl flex flex-col max-h-[60vh]">
            <div className="flex justify-between items-center px-3 py-2 border-b border-slate-100">
              <span className="font-medium text-slate-700 flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                Kommentare
                <span className="text-xs text-slate-400">
                  {(commentsByNode.get(commentPanel.nodeId) || []).length}
                </span>
              </span>
              <button onClick={() => setCommentPanel(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {(commentsByNode.get(commentPanel.nodeId) || []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Noch keine Kommentare</p>
              ) : (
                (commentsByNode.get(commentPanel.nodeId) || []).map((comment) => (
                  <div key={comment.id} className="group bg-slate-50 rounded-lg px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600 truncate">
                        {(comment.author_email || 'Unbekannt').split('@')[0]}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400">
                          {comment.created_date
                            ? new Date(comment.created_date).toLocaleString('de-DE', {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                              })
                            : ''}
                        </span>
                        {comment.author_email === currentUser?.email && (
                          <button
                            onClick={() => deleteComment.mutate(comment.id)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Kommentar löschen"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-0.5">
                      {comment.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 p-2 border-t border-slate-100">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                placeholder="Kommentar schreiben..."
                className="flex-1 min-w-0 h-9"
              />
              <Button
                size="sm"
                onClick={submitComment}
                disabled={!newComment.trim() || addComment.isPending}
                className="bg-amber-500 hover:bg-amber-600 h-9"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
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

      {/* File Hub attachments */}
      {fileHubPanel && (
        <div className="absolute top-28 sm:top-32 left-2 right-2 sm:left-auto sm:right-4 z-30 sm:w-80 max-h-[min(70vh,420px)] flex flex-col">
          <div className="bg-white shadow-xl border border-slate-200 rounded-xl p-3 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2 shrink-0">
              <span className="font-medium text-slate-700 flex items-center gap-2 text-sm">
                <Paperclip className="w-4 h-4" /> Dateien (File Hub)
              </span>
              <button onClick={() => setFileHubPanel(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {projectFiles.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Keine Dateien im Projekt. Zuerst im File Hub hochladen.</p>
            ) : (
              <Select
                onValueChange={(fileId) => {
                  const f = projectFiles.find((x) => String(x.id) === String(fileId));
                  if (f) attachFileHubToNode(f);
                }}
              >
                <SelectTrigger className="mb-3">
                  <SelectValue placeholder="Datei anhängen…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {projectFiles.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      <span className="truncate max-w-[220px]">{f.name || f.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="text-xs font-medium text-slate-600 mb-1 shrink-0">Angehängt</div>
            <ul className="space-y-1 overflow-y-auto min-h-0 flex-1 max-h-40 pr-0.5">
              {(nodes.find((n) => n.id === fileHubPanel.nodeId)?.file_hub_refs || []).length === 0 ? (
                <li className="text-xs text-slate-400">Noch keine Dateien.</li>
              ) : (
                (nodes.find((n) => n.id === fileHubPanel.nodeId)?.file_hub_refs || []).map((ref) => (
                  <li
                    key={ref.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 group min-w-0"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-indigo-600 hover:underline truncate"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {ref.name}
                    </a>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-500 p-0.5 shrink-0"
                      onClick={() => removeFileHubRef(ref.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={attachCanvasRef}
        className={`w-full h-full canvas-bg touch-none ${
          isPanning ? "cursor-grabbing" : isSpacePan ? "cursor-grab" : "cursor-default"
        }`}
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
        onAuxClick={(e) => e.preventDefault()}
        onDoubleClick={(e) => {
          if (e.target.closest?.("[data-mindmap-node]")) return;
          addNode("node", null, null, getCanvasPos(e));
        }}
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
            const isSticky = node.type === 'sticky';
            const isDone = node.is_done;
            const hasNote = !!node.note;
            const hasLinkedTask = !!node.linked_task_id;
            const linkedTask = hasLinkedTask ? tasks.find(t => t.id === node.linked_task_id) : null;
            const fileHubCount = Array.isArray(node.file_hub_refs) ? node.file_hub_refs.length : 0;
            const commentCount = (commentsByNode.get(node.id) || []).length;
            const stickySize = node.width || STICKY_DEFAULT_SIZE;

            const openComments = (e) => {
              e.stopPropagation();
              setSelectedNodeId(node.id);
              setCommentPanel({ nodeId: node.id });
              setNewComment('');
            };
            const openFiles = (e) => {
              e.stopPropagation();
              setSelectedNodeId(node.id);
              setFileHubPanel({ nodeId: node.id });
            };
            const stopPointer = (e) => e.stopPropagation();

            /** Round, clickable badges — the Miro pattern: icon on the node opens the content. */
            const badges = (
              <>
                {commentCount > 0 && (
                  <button
                    type="button"
                    onClick={openComments}
                    onPointerDown={stopPointer}
                    onMouseDown={stopPointer}
                    className="absolute -top-2 -left-2 min-w-[22px] h-[22px] px-1 bg-amber-400 text-slate-900 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md hover:bg-amber-300 hover:scale-110 transition-transform"
                    title={`${commentCount} Kommentar(e) öffnen`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    {commentCount > 1 ? <span>{commentCount}</span> : null}
                  </button>
                )}
                {fileHubCount > 0 && (
                  <button
                    type="button"
                    onClick={openFiles}
                    onPointerDown={stopPointer}
                    onMouseDown={stopPointer}
                    className="absolute -bottom-2 -left-2 min-w-[22px] h-[22px] px-1 bg-violet-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md hover:bg-violet-500 hover:scale-110 transition-transform"
                    title={`${fileHubCount} Datei(en) öffnen`}
                  >
                    <Paperclip className="w-3 h-3" />
                    {fileHubCount > 1 ? <span>{fileHubCount}</span> : null}
                  </button>
                )}
                {hasNote && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                      setNotePanel({ nodeId: node.id, note: node.note || '' });
                    }}
                    onPointerDown={stopPointer}
                    onMouseDown={stopPointer}
                    className="absolute -bottom-2 -right-2 w-[22px] h-[22px] bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    title="Notiz öffnen"
                  >
                    <StickyNote className="w-3 h-3" />
                  </button>
                )}
                {hasLinkedTask && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenTaskId(node.linked_task_id);
                    }}
                    onPointerDown={stopPointer}
                    onMouseDown={stopPointer}
                    className="absolute -bottom-2 left-6 w-[22px] h-[22px] bg-blue-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-600 hover:scale-110 transition-transform"
                    title={linkedTask?.title || 'Ticket öffnen'}
                  >
                    <ListTodo className="w-3 h-3" />
                  </button>
                )}
              </>
            );

            return (
              <div
                key={node.id}
                data-mindmap-node
                className={`pointer-events-auto absolute select-none touch-manipulation ${isSelected ? "z-50" : "z-10"}`}
                style={{ left: node.x, top: node.y, width: isSticky ? stickySize : node.width || 160 }}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onDoubleClick={() => {
                  setEditingNodeId(node.id);
                  setEditText(node.content || "");
                }}
              >
                {/* Sticky note */}
                {isSticky ? (
                  <div
                    className={`relative cursor-grab active:cursor-grabbing rounded-sm ${
                      isSelected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''
                    }`}
                    style={{
                      width: stickySize,
                      height: node.height || stickySize,
                      backgroundColor: node.color || STICKY_COLORS[0].bg,
                      color: node.borderColor || '#1f2937',
                      boxShadow: '0 10px 20px -8px rgba(15, 23, 42, 0.35), 0 2px 4px rgba(15, 23, 42, 0.15)',
                    }}
                  >
                    <div className="absolute inset-0 p-3 flex items-center justify-center overflow-hidden">
                      {isEditing ? (
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' && !e.shiftKey) {
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
                          onClick={stopPointer}
                          onMouseDown={stopPointer}
                          onPointerDown={stopPointer}
                          className="w-full h-full resize-none bg-white/60 border-0 text-slate-900 text-center focus-visible:ring-1"
                          style={{ fontSize: stickyFontSize(editText, stickySize) }}
                        />
                      ) : (
                        <span
                          className="w-full text-center font-medium leading-snug break-words [overflow-wrap:anywhere] whitespace-pre-wrap"
                          style={{ fontSize: stickyFontSize(node.content, stickySize) }}
                        >
                          {node.content || 'Doppelklick zum Schreiben'}
                        </span>
                      )}
                    </div>

                    {badges}

                    {/* Resize handle */}
                    <button
                      type="button"
                      title="Groesse aendern"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const { clientX, clientY } = getClientXY(e);
                        resizingRef.current = {
                          id: node.id,
                          startX: clientX,
                          startY: clientY,
                          width: stickySize,
                          height: node.height || stickySize,
                        };
                      }}
                      className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize touch-none"
                    >
                      <span className="block w-2.5 h-2.5 border-b-2 border-r-2 border-slate-500/60 absolute bottom-1 right-1" />
                    </button>
                  </div>
                ) : isDecision ? (
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
                    {badges}
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
                    
                    {badges}
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
        <span className="hidden sm:inline">
          Doppelklick = Neuer Knoten • Tippen oder Enter = Text • Backspace = Löschen • Scrollen = Bewegen • Cmd/Strg+Scroll = Zoom • Leertaste = Hand
        </span>
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