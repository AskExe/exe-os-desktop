import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TabKey } from "../components/Sidebar";
import { fetchEmployees, type Employee } from "../services/exeOsData.js";
import {
  AGENT_ACCENTS,
  FOREGROUND_SLICES,
  formatAgentName,
  NAV_EDGES,
  NAV_NODES,
  nearestNodeId,
  OFFICE_DOCK_TABS,
  PATROL_ROUTES,
  SCENE_ASSET,
  SCENE_RATIO,
  shortestPath,
  type OfficeEmployee,
  type OfficeStatus,
  type ScenePoint,
} from "./officeScene.js";

interface OfficeViewProps {
  activeTab: TabKey;
  onNavigate: (tab: TabKey) => void;
  onOpenAgentChat: (employeeName: string) => void;
}

interface SceneAgent extends OfficeEmployee {
  accent: string;
  bobPhase: number;
  currentNodeId: string;
  path: string[];
  patrolNodes: string[];
  pauseMs: number;
  speed: number;
  x: number;
  y: number;
}

interface DragState {
  agentName: string;
  pointerId: number;
  scenePoint: ScenePoint;
  started: boolean;
  startX: number;
  startY: number;
}

const STATUS_INTERVAL_MS = 5_000;
const DRAG_THRESHOLD_PX = 8;

const STATUS_COLORS: Record<OfficeStatus, string> = {
  active: "#8dfff0",
  working: "#f5d76e",
  idle: "#ffb86d",
  offline: "#7c768d",
};

const STATUS_LABELS: Record<OfficeStatus, string> = {
  active: "Active",
  working: "Working",
  idle: "Idle",
  offline: "Offline",
};

const SPEED_BY_STATUS: Record<OfficeStatus, number> = {
  active: 9.4,
  working: 7.6,
  idle: 4.1,
  offline: 0,
};

const DEFAULT_PATROL = ["tableNorth", "tableSouth", "consoleWest", "holoRing"];

const FOUNDER_MARKER = { x: 10, y: 88 };

function toOfficeEmployee(emp: Employee): OfficeEmployee {
  return { name: emp.name, role: emp.role, status: emp.status };
}

function pauseForStatus(status: OfficeStatus): number {
  switch (status) {
    case "active":
      return 450 + Math.random() * 800;
    case "working":
      return 950 + Math.random() * 1200;
    case "idle":
      return 1800 + Math.random() * 2200;
    case "offline":
      return 999_999;
  }
}

function polygon(points: ScenePoint[]): string {
  return `polygon(${points.map((point) => `${point.x}% ${point.y}%`).join(", ")})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pickPatrol(name: string, index: number): string[] {
  return PATROL_ROUTES[name] ?? [...DEFAULT_PATROL.slice(index % DEFAULT_PATROL.length), ...DEFAULT_PATROL].slice(0, 4);
}

function chooseDestination(agent: SceneAgent): string {
  const candidates = agent.patrolNodes.filter((nodeId) => nodeId !== agent.currentNodeId);
  if (candidates.length === 0) return agent.currentNodeId;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? agent.currentNodeId;
}

function buildAgent(employee: OfficeEmployee, index: number): SceneAgent {
  const patrolNodes = pickPatrol(employee.name, index);
  const currentNodeId = patrolNodes[0] ?? "tableSouth";
  const node = NAV_NODES[currentNodeId] ?? NAV_NODES.tableSouth;

  return {
    ...employee,
    accent: AGENT_ACCENTS[employee.name] ?? "#d2c6ff",
    bobPhase: index * 0.8,
    currentNodeId,
    path: [],
    patrolNodes,
    pauseMs: 400 + index * 260,
    speed: SPEED_BY_STATUS[employee.status],
    x: node.x,
    y: node.y,
  };
}

function syncAgents(prev: SceneAgent[], employees: OfficeEmployee[]): SceneAgent[] {
  const byName = new Map(prev.map((agent) => [agent.name, agent]));

  return employees.map((employee, index) => {
    const existing = byName.get(employee.name);
    if (!existing) return buildAgent(employee, index);

    return {
      ...existing,
      role: employee.role,
      status: employee.status,
      speed: SPEED_BY_STATUS[employee.status],
      accent: AGENT_ACCENTS[employee.name] ?? existing.accent,
      patrolNodes: pickPatrol(employee.name, index),
      path: employee.status === "offline" ? [] : existing.path,
    };
  });
}

function tickAgents(prev: SceneAgent[], elapsedMs: number): SceneAgent[] {
  return prev.map((agent) => {
    const bobPhase = agent.bobPhase + elapsedMs * (agent.speed > 0 ? 0.008 : 0.0022);

    if (agent.status === "offline") {
      return {
        ...agent,
        bobPhase,
        pauseMs: pauseForStatus("offline"),
        path: [],
        speed: 0,
      };
    }

    let currentNodeId = agent.currentNodeId;
    let path = [...agent.path];
    let pauseMs = Math.max(0, agent.pauseMs - elapsedMs);
    let x = agent.x;
    let y = agent.y;
    let remainingDistance = (elapsedMs / 1000) * agent.speed;

    if (path.length === 0 && pauseMs === 0) {
      const destinationId = chooseDestination(agent);
      path = shortestPath(currentNodeId, destinationId).slice(1);
      if (path.length === 0) pauseMs = pauseForStatus(agent.status);
    }

    while (remainingDistance > 0 && path.length > 0) {
      const targetId = path[0];
      const target = targetId ? NAV_NODES[targetId] : null;
      if (!target) {
        path.shift();
        continue;
      }

      const dx = target.x - x;
      const dy = target.y - y;
      const distance = Math.hypot(dx, dy);

      if (distance <= remainingDistance || distance < 0.001) {
        x = target.x;
        y = target.y;
        currentNodeId = target.id;
        path.shift();
        remainingDistance -= distance;

        if (path.length === 0) {
          pauseMs = pauseForStatus(agent.status);
        }
      } else {
        const step = remainingDistance / distance;
        x += dx * step;
        y += dy * step;
        remainingDistance = 0;
      }
    }

    return {
      ...agent,
      bobPhase,
      currentNodeId,
      path,
      pauseMs,
      x,
      y,
    };
  });
}

function routePoints(agent: SceneAgent | null): ScenePoint[] {
  if (!agent) return [];
  return [{ x: agent.x, y: agent.y }, ...agent.path.map((nodeId) => NAV_NODES[nodeId]).filter(Boolean)];
}

function getAgentHeading(agent: SceneAgent): number {
  const nextNodeId = agent.path[0];
  if (!nextNodeId) return 0;
  const nextNode = NAV_NODES[nextNodeId];
  if (!nextNode) return 0;
  return Math.atan2(nextNode.y - agent.y, nextNode.x - agent.x);
}

function AgentSprite({
  accent,
  highlighted,
  moving,
  opacity = 1,
  phase,
  heading,
  status,
}: {
  accent: string;
  highlighted: boolean;
  moving: boolean;
  opacity?: number;
  phase: number;
  heading: number;
  status: OfficeStatus;
}) {
  const stride = moving ? Math.sin(phase * 1.9) * 3.6 : 0;
  const lift = moving ? Math.max(0, Math.cos(phase * 1.9)) * 1.8 : 0;
  const sway = moving ? Math.sin(phase * 1.9) * 1.6 : 0;
  const turn = clamp((heading * 180 / Math.PI) * 0.17, -14, 14);
  const lean = moving ? clamp(Math.cos(heading) * 3.8, -3.8, 3.8) : 0;
  const skin = status === "offline" ? "#b5a28f" : "#e5c3a0";
  const hair = status === "offline" ? "#42352f" : "#2f2421";
  const suit = status === "offline" ? "#1a2028" : "#1a2433";
  const suitShadow = status === "offline" ? "#10151d" : "#111924";
  const trim = status === "offline" ? "rgba(180, 190, 205, 0.12)" : "rgba(173, 219, 255, 0.2)";

  return (
    <svg
      aria-hidden
      viewBox="0 0 72 96"
      style={{
        width: 46,
        height: 62,
        opacity,
        overflow: "visible",
        filter: highlighted
          ? `drop-shadow(0 0 14px ${accent}44) drop-shadow(0 12px 24px rgba(0, 0, 0, 0.42))`
          : "drop-shadow(0 10px 18px rgba(0, 0, 0, 0.32))",
      }}
    >
      <ellipse cx="36" cy="87" rx="14" ry="5.5" fill="rgba(0, 0, 0, 0.34)" />
      <g transform={`translate(36 54) rotate(${turn}) translate(-36 -54)`}>
        <g transform={`translate(0 ${sway * 0.35})`}>
          <path d="M24 66 L48 66 L52 85 L20 85 Z" fill={suitShadow} />
          <g transform={`translate(${-stride * 0.12} ${lift})`}>
            <path d="M29 60 L36 60 L34 87 L25 87 Z" fill={suit} />
            <path d="M24 84 L35 84 L35 89 L23 89 Z" fill="#090d14" />
          </g>
          <g transform={`translate(${stride * 0.12} ${Math.max(0, -stride * 0.08)})`}>
            <path d="M37 60 L44 60 L47 87 L38 87 Z" fill={suit} />
            <path d="M37 84 L49 84 L49 89 L37 89 Z" fill="#090d14" />
          </g>
          <g transform={`translate(0 ${lean * 0.2})`}>
            <g transform={`translate(${-stride * 0.08} ${Math.max(0, stride * 0.04)})`}>
              <path
                d="M20 33 C18 40 18 49 21 58 L26 57 C25 49 25 41 27 35 Z"
                fill={suitShadow}
              />
            </g>
            <g transform={`translate(${stride * 0.08} ${Math.max(0, -stride * 0.04)})`}>
              <path
                d="M52 33 C54 40 54 49 51 58 L46 57 C47 49 47 41 45 35 Z"
                fill={suitShadow}
              />
            </g>
            <path d="M22 31 L50 31 L54 58 L36 71 L18 58 Z" fill={suit} />
            <path d="M27 35 L45 35 L47 55 L36 65 L25 55 Z" fill={trim} />
            <path d="M31 35 L41 35 L43 60 L29 60 Z" fill={accent} opacity={0.28} />
            <path d="M31 28 L41 28 L39 34 L33 34 Z" fill="#ece8df" />
            <rect x="30" y="36" width="12" height="3" fill={accent} opacity={0.75} />
            <rect x="26" y="28" width="20" height="2.5" fill="rgba(255,255,255,0.12)" />
          </g>
          <rect x="33" y="22" width="6" height="7" fill={skin} />
          <ellipse cx="36" cy="18.5" rx="10" ry="10.5" fill={skin} />
          <path
            d="M26 20 C26 10, 32 7, 37 7 C43 7, 47 10, 46 21 C43 16, 39 15, 35 15 C31 15, 28 16, 26 20 Z"
            fill={hair}
          />
          <path
            d="M29 12 C31 10, 34 9, 38 9 C41 9, 43 10, 45 13"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect x="30" y="17" width="12" height="4.5" fill="rgba(134, 194, 255, 0.22)" />
          <rect x="28" y="22.5" width="16" height="1.4" fill="rgba(0,0,0,0.18)" />
          <circle cx="46.5" cy="19" r="1.6" fill={accent} opacity={0.82} />
        </g>
      </g>
    </svg>
  );
}

export function OfficeView({ activeTab, onNavigate, onOpenAgentChat }: OfficeViewProps) {
  const [employees, setEmployees] = useState<OfficeEmployee[]>([]);
  const [agents, setAgents] = useState<SceneAgent[]>([]);
  const [focusedAgentName, setFocusedAgentName] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showGraph, setShowGraph] = useState(true);
  const [sceneBounds, setSceneBounds] = useState({ width: 0, height: 0 });
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refreshEmployees = async () => {
      try {
        const { employees: raw } = await fetchEmployees();
        if (cancelled) return;
        setEmployees(raw.map(toOfficeEmployee));
      } catch {
        if (cancelled) return;
      }
    };

    void refreshEmployees();
    const intervalId = window.setInterval(() => {
      void refreshEmployees();
    }, STATUS_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setAgents((prev) => syncAgents(prev, employees));
  }, [employees]);

  useEffect(() => {
    if (!selectedAgentName) return;
    if (agents.some((agent) => agent.name === selectedAgentName)) return;
    setSelectedAgentName(null);
  }, [agents, selectedAgentName]);

  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;

    const updateBounds = (width: number, height: number) => {
      const nextWidth = Math.round(width);
      const nextHeight = Math.round(height);
      setSceneBounds((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev;
        return { width: nextWidth, height: nextHeight };
      });
    };

    const rect = node.getBoundingClientRect();
    updateBounds(rect.width, rect.height);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateBounds(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const lastTick = lastTickRef.current ?? timestamp;
      const elapsed = Math.min(34, timestamp - lastTick);
      lastTickRef.current = timestamp;
      setAgents((prev) => tickAgents(prev, elapsed));
      animationRef.current = window.requestAnimationFrame(tick);
    };

    animationRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
      lastTickRef.current = null;
    };
  }, []);

  const activeAgentName = dragState?.agentName ?? selectedAgentName ?? focusedAgentName;

  const inspectedAgent = useMemo(
    () => agents.find((agent) => agent.name === activeAgentName) ?? null,
    [activeAgentName, agents],
  );

  const dragTargetId = useMemo(
    () => (dragState?.started ? nearestNodeId(dragState.scenePoint) : null),
    [dragState],
  );

  const dragTargetNode = dragTargetId ? NAV_NODES[dragTargetId] : null;

  const sortedAgents = useMemo(
    () => [...agents].sort((left, right) => left.y - right.y),
    [agents],
  );

  const visibleEmployees = useMemo(
    () => employees.filter((employee) => employee.status !== "offline").length,
    [employees],
  );

  const movingAgents = useMemo(
    () => agents.filter((agent) => agent.path.length > 0).length,
    [agents],
  );

  const focusRoute = useMemo(() => routePoints(inspectedAgent), [inspectedAgent]);
  const sceneWidth = sceneBounds.width || 1280;
  const uiScale = clamp(sceneWidth / 1440, 0.58, 1);
  const sceneInset = clamp(sceneWidth * 0.018, 12, 26);
  const panelPadding = clamp(20 * uiScale, 12, 20);
  const headerPanelWidth = clamp(sceneWidth * 0.275, 220, 344);
  const sidePanelWidth = clamp(sceneWidth * 0.205, 188, 282);
  const panelTitleSize = clamp(26 * uiScale, 18, 26);
  const panelBodySize = clamp(18 * uiScale, 13, 18);
  const panelLabelSize = clamp(10 * uiScale, 8.5, 10);
  const panelHeadlineSize = clamp(24 * uiScale, 16, 24);
  const panelHeadlineBox = clamp(46 * uiScale, 30, 46);
  const chipPaddingY = clamp(6 * uiScale, 4, 6);
  const chipPaddingX = clamp(9 * uiScale, 6, 9);
  const compactScene = sceneWidth < 1080;
  const veryCompactScene = sceneWidth < 920;
  const sceneTags = veryCompactScene
    ? ["Scene Layer"]
    : compactScene
      ? ["Scene Layer", "Movement Overlay"]
      : ["Scene Layer", "Movement Overlay", "Foreground Occlusion"];
  const metricsColumns = compactScene ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))";
  const dockGap = clamp(8 * uiScale, 4, 8);
  const dockPaddingY = clamp(12 * uiScale, 8, 12);
  const dockPaddingX = clamp(14 * uiScale, 8, 14);
  const dockButtonMinWidth = clamp(sceneWidth * 0.075, 82, 126);
  const founderGap = clamp(12 * uiScale, 8, 12);
  const founderPadding = `${clamp(12 * uiScale, 8, 12)}px ${clamp(14 * uiScale, 10, 14)}px`;

  const clientToScenePoint = (clientX: number, clientY: number): ScenePoint | null => {
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  const moveAgentToPoint = (agentName: string, point: ScenePoint) => {
    const targetNodeId = nearestNodeId(point);
    const targetNode = NAV_NODES[targetNodeId];
    if (!targetNode) return;

    setSelectedAgentName(agentName);
    setFocusedAgentName(agentName);
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.name !== agentName) return agent;

        const startNodeId = nearestNodeId({ x: agent.x, y: agent.y });
        const manualPath = shortestPath(startNodeId, targetNodeId).slice(1);
        if (agent.status === "offline") {
          return {
            ...agent,
            currentNodeId: targetNodeId,
            path: [],
            pauseMs: pauseForStatus("offline"),
            x: targetNode.x,
            y: targetNode.y,
          };
        }

        return {
          ...agent,
          currentNodeId: startNodeId,
          path: manualPath,
          pauseMs: manualPath.length > 0 ? 0 : pauseForStatus(agent.status),
        };
      }),
    );
  };

  const handleAgentPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    agentName: string,
  ) => {
    if (event.button !== 0) return;
    const scenePoint = clientToScenePoint(event.clientX, event.clientY);
    if (!scenePoint) return;

    setSelectedAgentName(agentName);
    setFocusedAgentName(agentName);
    dragRef.current = {
      agentName,
      pointerId: event.pointerId,
      scenePoint,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;

      const scenePoint = clientToScenePoint(event.clientX, event.clientY);
      if (!scenePoint) return;

      const started = current.started
        || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= DRAG_THRESHOLD_PX;

      const nextState: DragState = {
        ...current,
        scenePoint,
        started,
      };

      dragRef.current = nextState;
      if (started) {
        setDragState(nextState);
      }
    };

    const clearDrag = () => {
      dragRef.current = null;
      setDragState(null);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;

      const scenePoint = clientToScenePoint(event.clientX, event.clientY) ?? current.scenePoint;
      if (current.started) {
        moveAgentToPoint(current.agentName, scenePoint);
      } else {
        onOpenAgentChat(current.agentName);
      }

      clearDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", clearDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", clearDrag);
    };
  });

  return (
    <div
      style={{
        margin: -32,
        padding: 24,
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 16%, rgba(70, 94, 154, 0.12), transparent 28%), linear-gradient(180deg, #13121e, #0d0d16 38%, #10111a)",
      }}
    >
      <style>
        {`
          @keyframes office-sweep {
            0% { transform: translateX(-34%) skewX(-14deg); opacity: 0; }
            12% { opacity: 0.28; }
            50% { opacity: 0.08; }
            100% { transform: translateX(144%) skewX(-14deg); opacity: 0; }
          }

          @keyframes office-node-pulse {
            0%, 100% { opacity: 0.42; }
            50% { opacity: 0.95; }
          }

          @keyframes office-route-flow {
            from { stroke-dashoffset: 18; }
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>
      <div
        style={{
          width: "100%",
          maxWidth: 1500,
          minHeight: "calc(100vh - 112px)",
          display: "flex",
        }}
      >
        <div
          ref={sceneRef}
          style={{
            position: "relative",
            width: "100%",
            overflow: "hidden",
            border: "1px solid rgba(255, 244, 220, 0.16)",
            background: "#090a0f",
            boxShadow: "0 34px 80px rgba(0, 0, 0, 0.42)",
            aspectRatio: `${SCENE_RATIO}`,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${SCENE_ASSET})`,
              backgroundPosition: "center",
              backgroundSize: "100% 100%",
              filter: "saturate(0.92) contrast(1.02) brightness(0.92)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(4, 7, 14, 0.14), rgba(4, 7, 14, 0.22) 38%, rgba(4, 7, 14, 0.42) 100%)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 50% 44%, rgba(135, 176, 255, 0.12), transparent 30%), radial-gradient(circle at 50% 52%, transparent 38%, rgba(2, 6, 12, 0.76) 100%)",
              mixBlendMode: "screen",
              opacity: 0.85,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(100deg, transparent 0%, rgba(109, 162, 255, 0.08) 46%, rgba(109, 162, 255, 0.22) 49%, rgba(109, 162, 255, 0.08) 52%, transparent 100%)",
              animation: "office-sweep 9.5s linear infinite",
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0, transparent 1px, transparent 24px)",
              backgroundSize: "100% 25px",
              opacity: 0.08,
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              opacity: showGraph ? 1 : 0.32,
              transition: "opacity 180ms ease",
            }}
          >
            {NAV_EDGES.map(([fromId, toId]) => {
              const from = NAV_NODES[fromId];
              const to = NAV_NODES[toId];
              if (!from || !to) return null;

              return (
                <line
                  key={`${fromId}:${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(117, 188, 255, 0.22)"
                  strokeWidth={0.32}
                  strokeLinecap="round"
                  strokeDasharray="1.8 2.2"
                  style={{
                    animation: "office-route-flow 3.6s linear infinite",
                  }}
                />
              );
            })}

            {showGraph && Object.values(NAV_NODES).map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={0.44}
                fill="rgba(173, 211, 255, 0.7)"
                style={{ animation: "office-node-pulse 2.6s ease-in-out infinite" }}
              />
            ))}

            {focusRoute.length > 1 && (
              <polyline
                points={focusRoute.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke={inspectedAgent?.accent ?? "#9bd0ff"}
                strokeWidth={0.34}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1.2 1.6"
                style={{ animation: "office-route-flow 1.8s linear infinite" }}
              />
            )}

            {dragTargetNode && (
              <>
                <circle
                  cx={dragTargetNode.x}
                  cy={dragTargetNode.y}
                  r={1.5}
                  fill="rgba(155, 208, 255, 0.1)"
                  stroke="rgba(155, 208, 255, 0.9)"
                  strokeWidth={0.32}
                />
                <circle
                  cx={dragTargetNode.x}
                  cy={dragTargetNode.y}
                  r={0.55}
                  fill="rgba(155, 208, 255, 0.95)"
                />
              </>
            )}
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
            }}
          >
            {sortedAgents.map((agent) => {
              const moving = agent.path.length > 0;
              const focused = agent.name === activeAgentName;
              const dragging = dragState?.started && dragState.agentName === agent.name;
              const bob = moving ? Math.sin(agent.bobPhase) * 2.1 : Math.sin(agent.bobPhase) * 0.6;
              const heading = getAgentHeading(agent);

              return (
                <div
                  key={agent.name}
                  style={{
                    position: "absolute",
                    left: `${agent.x}%`,
                    top: `${agent.y}%`,
                    transform: `translate(-50%, calc(-100% + ${bob}px)) scale(${focused ? 1.03 : 1})`,
                    zIndex: Math.round(agent.y * 10),
                    transition: "transform 160ms ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={(event) => event.preventDefault()}
                    onPointerDown={(event) => handleAgentPointerDown(event, agent.name)}
                    onMouseEnter={() => setFocusedAgentName(agent.name)}
                    onMouseLeave={() => setFocusedAgentName((prev) => (prev === agent.name ? null : prev))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAgentName(agent.name);
                        onOpenAgentChat(agent.name);
                      }
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: dragging ? "grabbing" : "grab",
                      position: "relative",
                      padding: 0,
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        bottom: "100%",
                        transform: "translate(-50%, -12px)",
                        minWidth: 124,
                        padding: "8px 10px 9px",
                        background: "rgba(5, 7, 12, 0.88)",
                        border: `1px solid ${focused ? agent.accent : "rgba(255, 244, 220, 0.12)"}`,
                        boxShadow: focused
                          ? `0 0 0 1px ${agent.accent}28, 0 14px 24px rgba(0, 0, 0, 0.36)`
                          : "0 14px 24px rgba(0, 0, 0, 0.28)",
                        textAlign: "left",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 5,
                          fontFamily: "var(--font-label)",
                          fontSize: 10,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: STATUS_COLORS[agent.status],
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            background: STATUS_COLORS[agent.status],
                            boxShadow: `0 0 10px ${STATUS_COLORS[agent.status]}80`,
                          }}
                        />
                        {STATUS_LABELS[agent.status]}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-headline)",
                          fontSize: 16,
                          lineHeight: 1,
                          color: "#fff4dc",
                        }}
                      >
                        {formatAgentName(agent.name)}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "rgba(228, 224, 242, 0.82)",
                        }}
                      >
                        {agent.role}
                      </div>
                    </div>

                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: "50%",
                        bottom: -3,
                        transform: "translateX(-50%)",
                        width: 20,
                        height: 6,
                        background: "rgba(0, 0, 0, 0.42)",
                        filter: "blur(1px)",
                      }}
                    />

                    <AgentSprite
                      accent={agent.accent}
                      heading={heading}
                      highlighted={focused}
                      moving={moving}
                      opacity={dragging ? 0.2 : 1}
                      phase={agent.bobPhase}
                      status={agent.status}
                    />
                  </button>
                </div>
              );
            })}

            {dragState?.started && inspectedAgent && (
              <div
                style={{
                  position: "absolute",
                  left: `${dragState.scenePoint.x}%`,
                  top: `${dragState.scenePoint.y}%`,
                  transform: "translate(-50%, -100%)",
                  zIndex: 999,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: "100%",
                    transform: "translate(-50%, -14px)",
                    padding: "8px 10px",
                    background: "rgba(5, 7, 12, 0.9)",
                    border: `1px solid ${inspectedAgent.accent}`,
                    boxShadow: `0 0 0 1px ${inspectedAgent.accent}24, 0 18px 28px rgba(0, 0, 0, 0.38)`,
                    fontFamily: "var(--font-label)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#fff4dc",
                    whiteSpace: "nowrap",
                  }}
                >
                  Drop to Re-route
                </div>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -4,
                    transform: "translateX(-50%)",
                    width: 24,
                    height: 8,
                    background: "rgba(0, 0, 0, 0.42)",
                    filter: "blur(2px)",
                  }}
                />
                <AgentSprite
                  accent={inspectedAgent.accent}
                  heading={getAgentHeading(inspectedAgent)}
                  highlighted={true}
                  moving={true}
                  opacity={0.96}
                  phase={inspectedAgent.bobPhase}
                  status={inspectedAgent.status}
                />
              </div>
            )}
          </div>

          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            {FOREGROUND_SLICES.map((slice) => (
              <div
                key={slice.id}
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${SCENE_ASSET})`,
                  backgroundPosition: "center",
                  backgroundSize: "100% 100%",
                  clipPath: polygon(slice.points),
                  opacity: slice.opacity ?? 1,
                }}
              />
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              top: sceneInset,
              left: sceneInset,
              zIndex: 6,
              width: headerPanelWidth,
              padding: `${clamp(18 * uiScale, 12, 18)}px ${panelPadding}px ${panelPadding}px`,
              background: "linear-gradient(180deg, rgba(5, 7, 12, 0.92), rgba(5, 7, 12, 0.78))",
              border: "1px solid rgba(255, 244, 220, 0.16)",
              boxShadow: "0 18px 40px rgba(0, 0, 0, 0.3)",
              backdropFilter: "blur(5px)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: panelHeadlineBox,
                height: panelHeadlineBox,
                marginBottom: clamp(10 * uiScale, 8, 16),
                border: "1px solid rgba(245, 215, 110, 0.4)",
                color: "#f5d76e",
                fontFamily: "var(--font-headline)",
                fontSize: panelHeadlineSize,
                fontWeight: 700,
              }}
            >
              2
            </div>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: panelTitleSize,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff4dc",
                lineHeight: 1.04,
              }}
            >
              Mission Control Floor
            </div>
            <div
              style={{
                marginTop: clamp(10 * uiScale, 8, 12),
                maxWidth: headerPanelWidth * 0.76,
                fontFamily: "var(--font-body)",
                fontSize: panelBodySize,
                lineHeight: 1.45,
                color: "rgba(228, 224, 242, 0.88)",
              }}
            >
              Dense operational cockpit. Structured, focused, always-on.
            </div>
            <div
              style={{
                marginTop: clamp(14 * uiScale, 10, 18),
                display: "flex",
                gap: clamp(6 * uiScale, 4, 8),
                flexWrap: "wrap",
              }}
            >
              {sceneTags.map((label) => (
                <span
                  key={label}
                  style={{
                    padding: `${chipPaddingY}px ${chipPaddingX}px`,
                    fontFamily: "var(--font-label)",
                    fontSize: panelLabelSize,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#cfc6b1",
                    border: "1px solid rgba(255, 244, 220, 0.12)",
                    background: "rgba(255, 255, 255, 0.02)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              top: sceneInset,
              right: sceneInset,
              zIndex: 6,
              width: sidePanelWidth,
              padding: `${clamp(18 * uiScale, 12, 18)}px ${panelPadding}px ${panelPadding}px`,
              background: "linear-gradient(180deg, rgba(5, 7, 12, 0.9), rgba(5, 7, 12, 0.76))",
              border: "1px solid rgba(255, 244, 220, 0.14)",
              boxShadow: "0 18px 40px rgba(0, 0, 0, 0.26)",
              backdropFilter: "blur(5px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: clamp(12 * uiScale, 8, 16),
                fontFamily: "var(--font-label)",
                fontSize: clamp(11 * uiScale, 9, 11),
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#98907d",
              }}
            >
              <span>Live Overlay</span>
              <button
                type="button"
                onClick={() => setShowGraph((prev) => !prev)}
                style={{
                  padding: `${clamp(6 * uiScale, 4, 6)}px ${clamp(8 * uiScale, 6, 8)}px`,
                  background: showGraph ? "rgba(117, 188, 255, 0.16)" : "rgba(255, 255, 255, 0.04)",
                  border: `1px solid ${showGraph ? "rgba(117, 188, 255, 0.34)" : "rgba(255, 244, 220, 0.12)"}`,
                  color: showGraph ? "#9bd0ff" : "#cfc6b1",
                  fontFamily: "var(--font-label)",
                  fontSize: panelLabelSize,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {showGraph ? "Graph On" : "Graph Off"}
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: metricsColumns,
                gap: clamp(10 * uiScale, 6, 10),
              }}
            >
              {[
                { label: "Visible", value: `${visibleEmployees}` },
                { label: "Moving", value: `${movingAgents}` },
                { label: "Waypoints", value: `${Object.keys(NAV_NODES).length}` },
                { label: "Occluders", value: `${FOREGROUND_SLICES.length}` },
              ].map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    padding: `${clamp(12 * uiScale, 8, 12)}px ${clamp(12 * uiScale, 8, 12)}px ${clamp(13 * uiScale, 9, 13)}px`,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 244, 220, 0.08)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: panelLabelSize,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#98907d",
                      marginBottom: clamp(6 * uiScale, 4, 6),
                    }}
                  >
                    {metric.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-headline)",
                      fontSize: clamp(24 * uiScale, 16, 24),
                      color: "#fff4dc",
                    }}
                  >
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
            {inspectedAgent && (
              <div
                style={{
                  marginTop: clamp(14 * uiScale, 10, 16),
                  paddingTop: clamp(12 * uiScale, 8, 15),
                  borderTop: "1px solid rgba(255, 244, 220, 0.08)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: panelLabelSize,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#98907d",
                    marginBottom: clamp(8 * uiScale, 6, 8),
                  }}
                >
                  {dragState?.started ? "Dragging Agent" : selectedAgentName ? "Selected Agent" : "Focused Agent"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-headline)",
                    fontSize: clamp(20 * uiScale, 16, 20),
                    color: "#fff4dc",
                  }}
                >
                  {formatAgentName(inspectedAgent.name)}
                </div>
                <div
                  style={{
                    marginTop: clamp(4 * uiScale, 3, 4),
                    fontFamily: "var(--font-body)",
                    fontSize: clamp(13 * uiScale, 11, 13),
                    color: "rgba(228, 224, 242, 0.82)",
                  }}
                >
                  {inspectedAgent.role} · {STATUS_LABELS[inspectedAgent.status]}
                </div>
                <div
                  style={{
                    marginTop: clamp(10 * uiScale, 6, 10),
                    fontFamily: "var(--font-body)",
                    fontSize: clamp(12 * uiScale, 10.5, 12),
                    lineHeight: 1.55,
                    color: "rgba(207, 198, 177, 0.92)",
                  }}
                >
                  Click to open chat. Drag to move across the mission-control graph.
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              left: `${FOUNDER_MARKER.x}%`,
              top: `${FOUNDER_MARKER.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 6,
              display: "flex",
              alignItems: "center",
              gap: founderGap,
              padding: founderPadding,
              background: "rgba(5, 7, 12, 0.9)",
              border: "1px solid rgba(245, 215, 110, 0.2)",
              boxShadow: "0 14px 24px rgba(0, 0, 0, 0.26)",
              backdropFilter: "blur(5px)",
            }}
          >
            <div
              style={{
                width: clamp(34 * uiScale, 24, 34),
                height: clamp(34 * uiScale, 24, 34),
                background: "linear-gradient(180deg, #f5d76e, #d4a953)",
                color: "#231b00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-headline)",
                fontSize: clamp(16 * uiScale, 11, 16),
                fontWeight: 700,
              }}
            >
              Y
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: clamp(16 * uiScale, 12, 16),
                  color: "#fff4dc",
                  lineHeight: 1,
                }}
              >
                You
              </div>
              <div
                style={{
                  marginTop: clamp(4 * uiScale, 2, 4),
                  fontFamily: "var(--font-label)",
                  fontSize: panelLabelSize,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#98907d",
                }}
              >
                Founder
              </div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: sceneInset,
              transform: "translateX(-50%)",
              zIndex: 6,
              display: "flex",
              alignItems: "center",
              gap: dockGap,
              padding: `${dockPaddingY}px ${dockPaddingX}px`,
              background: "rgba(5, 7, 12, 0.9)",
              border: "1px solid rgba(255, 244, 220, 0.14)",
              boxShadow: "0 18px 40px rgba(0, 0, 0, 0.28)",
              backdropFilter: "blur(5px)",
              maxWidth: `calc(100% - ${sceneInset * 2}px)`,
            }}
          >
            {OFFICE_DOCK_TABS.map((tab) => {
              const selected = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onNavigate(tab.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: clamp(10 * uiScale, 6, 10),
                    minWidth: dockButtonMinWidth,
                    padding: `${clamp(10 * uiScale, 7, 10)}px ${clamp(14 * uiScale, 8, 14)}px`,
                    background: selected ? "rgba(245, 215, 110, 0.12)" : "transparent",
                    border: `1px solid ${selected ? "rgba(245, 215, 110, 0.32)" : "transparent"}`,
                    color: selected ? "#fff4dc" : "#98907d",
                    cursor: "pointer",
                    fontFamily: "var(--font-label)",
                    fontSize: clamp(11 * uiScale, 9, 11),
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: clamp(18 * uiScale, 14, 18) }}>
                    {tab.icon}
                  </span>
                  {!veryCompactScene && <span>{tab.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
