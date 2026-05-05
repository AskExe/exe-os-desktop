import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TabKey } from "../components/Sidebar";
import { fetchEmployees, type Employee } from "../services/exeOsData.js";
import {
  AGENT_ACCENTS,
  AGENT_SPRITES,
  DEFAULT_AGENT_SPRITES,
  DEFAULT_PATROL_ROUTE,
  formatAgentName,
  NAV_EDGES,
  NAV_NODES,
  nearestNodeId,
  nearestReachableNodeId,
  PATROL_ROUTES,
  SCENE_ASSET,
  SCENE_ASSET_LINKED_OBJECT_COUNT,
  SCENE_FOREGROUND_ASSET,
  SCENE_OCCLUDER_COUNT,
  SCENE_OBJECT_COUNT,
  SCENE_OBJECTS,
  SCENE_RATIO,
  sameComponentNodeIds,
  shortestPath,
  WALKABLE_ZONES,
  pointInObstacle,
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
  directionX: number;
  directionY: number;
  facing: 1 | -1;
  path: string[];
  patrolNodes: string[];
  pauseMs: number;
  speed: number;
  spriteSrc: string;
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
  offline: 3.2,
};

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
      return 2400 + Math.random() * 2600;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pickPatrol(name: string): string[] {
  if (PATROL_ROUTES[name]?.length) return PATROL_ROUTES[name];
  if (DEFAULT_PATROL_ROUTE.length) return DEFAULT_PATROL_ROUTE;
  return [Object.keys(NAV_NODES)[0] ?? "nav-0-0"];
}

function chooseDestination(agent: SceneAgent): string {
  const candidates = sameComponentNodeIds(agent.currentNodeId, agent.patrolNodes)
    .filter((nodeId) => nodeId !== agent.currentNodeId);
  if (candidates.length === 0) return agent.currentNodeId;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? agent.currentNodeId;
}

function agentSpriteFor(name: string, index: number): string {
  return AGENT_SPRITES[name]
    ?? DEFAULT_AGENT_SPRITES[index % DEFAULT_AGENT_SPRITES.length]
    ?? DEFAULT_AGENT_SPRITES[0]
    ?? "";
}

function buildAgent(employee: OfficeEmployee, index: number): SceneAgent {
  const patrolNodes = pickPatrol(employee.name);
  const currentNodeId = patrolNodes[0] ?? Object.keys(NAV_NODES)[0] ?? "nav-0-0";
  const node = NAV_NODES[currentNodeId] ?? Object.values(NAV_NODES)[0] ?? { x: 50, y: 50 };

  return {
    ...employee,
    accent: AGENT_ACCENTS[employee.name] ?? "#d2c6ff",
    bobPhase: index * 0.8,
    currentNodeId,
    directionX: 0.42,
    directionY: 0.18,
    facing: index % 2 === 0 ? 1 : -1,
    path: [],
    patrolNodes,
    pauseMs: index * 220,
    speed: SPEED_BY_STATUS[employee.status],
    spriteSrc: agentSpriteFor(employee.name, index),
    x: node.x,
    y: node.y,
  };
}

function syncAgents(prev: SceneAgent[], employees: OfficeEmployee[]): SceneAgent[] {
  const byName = new Map(prev.map((agent) => [agent.name, agent]));

  return employees.map((employee, index) => {
    const existing = byName.get(employee.name);
    if (!existing) return buildAgent(employee, index);

    const patrolNodes = pickPatrol(employee.name);
    const fallbackNodeId = NAV_NODES[existing.currentNodeId]
      ? existing.currentNodeId
      : nearestNodeId({ x: existing.x, y: existing.y });
    const fallbackNode = NAV_NODES[fallbackNodeId] ?? Object.values(NAV_NODES)[0];
    const activePath = existing.path.filter((nodeId) => Boolean(NAV_NODES[nodeId]));

    return {
      ...existing,
      role: employee.role,
      status: employee.status,
      speed: SPEED_BY_STATUS[employee.status],
      accent: AGENT_ACCENTS[employee.name] ?? existing.accent,
      currentNodeId: fallbackNodeId,
      directionX: existing.directionX,
      directionY: existing.directionY,
      patrolNodes,
      path: activePath,
      spriteSrc: AGENT_SPRITES[employee.name] ?? existing.spriteSrc ?? agentSpriteFor(employee.name, index),
      x: NAV_NODES[existing.currentNodeId] ? existing.x : (fallbackNode?.x ?? existing.x),
      y: NAV_NODES[existing.currentNodeId] ? existing.y : (fallbackNode?.y ?? existing.y),
    };
  });
}

function tickAgents(prev: SceneAgent[], elapsedMs: number): SceneAgent[] {
  return prev.map((agent) => {
    let distanceMoved = 0;
    let currentNodeId = agent.currentNodeId;
    let directionX = agent.directionX;
    let directionY = agent.directionY;
    let facing = agent.facing;
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
      facing = dx < 0 ? -1 : 1;
      if (distance > 0.001) {
        directionX = dx / distance;
        directionY = dy / distance;
      }

      if (distance <= remainingDistance || distance < 0.001) {
        x = target.x;
        y = target.y;
        currentNodeId = target.id;
        path.shift();
        distanceMoved += distance;
        remainingDistance -= distance;

        if (path.length === 0) {
          pauseMs = pauseForStatus(agent.status);
        }
      } else {
        const step = remainingDistance / distance;
        x += dx * step;
        y += dy * step;
        distanceMoved += remainingDistance;
        remainingDistance = 0;
      }
    }

    const bobPhase = agent.bobPhase + (distanceMoved > 0.001 ? distanceMoved * 1.12 : elapsedMs * 0.0011);

    return {
      ...agent,
      bobPhase,
      currentNodeId,
      directionX,
      directionY,
      facing,
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

function AgentSprite({
  accent,
  directionX,
  directionY,
  facing,
  highlighted,
  moving,
  opacity = 1,
  phase,
  size,
  spriteSrc,
}: {
  accent: string;
  directionX: number;
  directionY: number;
  facing: 1 | -1;
  highlighted: boolean;
  moving: boolean;
  opacity?: number;
  phase: number;
  size: number;
  spriteSrc: string;
}) {
  const stride = Math.sin(phase * 0.94);
  const strideHeight = Math.max(0, Math.sin(phase + 0.42));
  const sway = moving
    ? stride * 0.26 + directionX * 0.18
    : Math.sin(phase * 0.2) * 0.05;
  const lift = moving ? strideHeight * 1.15 : Math.sin(phase * 0.35) * 0.06;
  const lean = moving ? directionX * 4.2 : 0;
  const pitch = moving ? -directionY * 6.4 : 0;
  const stretch = moving ? 1 + Math.abs(stride) * 0.018 : 1;
  const squash = moving ? 1 - Math.abs(stride) * 0.024 : 1;
  const shadowOffsetX = moving ? directionX * 2.6 : 0;
  const shadowScale = moving ? 0.94 + Math.abs(stride) * 0.05 : 1;
  const shadowWidth = size * 0.34;
  const spriteFilter = highlighted
    ? `drop-shadow(0 0 16px ${accent}42) drop-shadow(0 18px 26px rgba(0, 0, 0, 0.38))`
    : "drop-shadow(0 14px 22px rgba(0, 0, 0, 0.34))";
  const bodyTransform = `translateX(calc(-50% + ${sway}px)) translateY(${lift}px) perspective(260px) rotateX(${pitch}deg) rotateZ(${lean}deg) scaleX(${facing * squash}) scaleY(${stretch})`;
  const lowerBodySwing = moving ? stride * facing * size * 0.018 : 0;
  const lowerBodyTransform = `translateX(calc(-50% + ${sway + lowerBodySwing}px)) translateY(${lift}px) perspective(260px) rotateX(${pitch}deg) rotateZ(${lean + stride * facing * 2.4}deg) scaleX(${facing * squash}) scaleY(${stretch})`;
  const frontStep = moving ? stride * facing * size * 0.055 : 0;
  const rearStep = moving ? -stride * facing * size * 0.045 : 0;
  const footLift = moving ? Math.max(0, Math.abs(stride) - 0.25) * size * 0.012 : 0;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        width: size * 0.54,
        height: size,
        opacity,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          bottom: 4,
          width: shadowWidth,
          height: size * 0.08,
          background: "rgba(0, 0, 0, 0.36)",
          borderRadius: "999px",
          filter: "blur(2px)",
          transform: `translateX(calc(-50% + ${shadowOffsetX}px)) scale(${shadowScale})`,
        }}
      />
      {moving ? (
        <>
          <img
            alt=""
            aria-hidden
            draggable={false}
            src={spriteSrc}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 0,
              height: size,
              width: "auto",
              userSelect: "none",
              pointerEvents: "none",
              clipPath: "inset(0 0 38% 0)",
              transform: bodyTransform,
              transformOrigin: "50% 100%",
              filter: spriteFilter,
            }}
          />
          <img
            alt=""
            aria-hidden
            draggable={false}
            src={spriteSrc}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 0,
              height: size,
              width: "auto",
              userSelect: "none",
              pointerEvents: "none",
              clipPath: "inset(58% 0 0 0)",
              transform: lowerBodyTransform,
              transformOrigin: "50% 100%",
              filter: spriteFilter,
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              bottom: size * 0.02,
              width: size * 0.075,
              height: size * 0.018,
              borderRadius: "999px",
              background: "rgba(5, 8, 12, 0.72)",
              boxShadow: `0 0 8px ${accent}22`,
              transform: `translateX(calc(-50% + ${frontStep}px)) translateY(${-footLift}px) rotate(${directionX * 16}deg)`,
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              bottom: size * 0.012,
              width: size * 0.068,
              height: size * 0.016,
              borderRadius: "999px",
              background: "rgba(2, 4, 8, 0.62)",
              transform: `translateX(calc(-50% + ${rearStep}px)) rotate(${directionX * -12}deg)`,
            }}
          />
        </>
      ) : (
        <img
          alt=""
          aria-hidden
          draggable={false}
          src={spriteSrc}
          style={{
            position: "relative",
            height: size,
            width: "auto",
            userSelect: "none",
            pointerEvents: "none",
            transform: `translateY(${lift}px) translateX(${sway}px) perspective(260px) rotateX(${pitch}deg) rotateZ(${lean}deg) scaleX(${facing * squash}) scaleY(${stretch})`,
            transformOrigin: "50% 100%",
            filter: spriteFilter,
          }}
        />
      )}
    </div>
  );
}

export function OfficeView({ onOpenAgentChat }: OfficeViewProps) {
  const [employees, setEmployees] = useState<OfficeEmployee[]>([]);
  const [agents, setAgents] = useState<SceneAgent[]>([]);
  const [focusedAgentName, setFocusedAgentName] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [missionPanelCollapsed, setMissionPanelCollapsed] = useState(true);
  const [overlayPanelCollapsed, setOverlayPanelCollapsed] = useState(true);
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

  const dragTargetId = useMemo(() => {
    if (!dragState?.started) return null;
    if (!inspectedAgent) return nearestNodeId(dragState.scenePoint);
    return nearestReachableNodeId(inspectedAgent.currentNodeId, dragState.scenePoint);
  }, [dragState, inspectedAgent]);

  const dragTargetNode = dragTargetId ? NAV_NODES[dragTargetId] : null;
  const dragTargetBlocked = dragState?.started ? pointInObstacle(dragState.scenePoint) : false;
  const showGraph = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("officeDebug") === "1";

  const sortedAgents = useMemo(
    () => [...agents].sort((left, right) => left.y - right.y),
    [agents],
  );

  const visibleEmployees = useMemo(
    () => employees.length,
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
  const panelToggleSize = clamp(32 * uiScale, 24, 32);
  const panelToggleIconSize = clamp(18 * uiScale, 14, 18);
  const collapsedPanelPaddingY = clamp(10 * uiScale, 8, 10);
  const collapsedPanelPaddingX = clamp(12 * uiScale, 8, 12);
  const collapsedPanelGap = clamp(10 * uiScale, 6, 10);
  const collapsedMissionPanelWidth = clamp(sceneWidth * 0.19, 160, 226);
  const collapsedOverlayPanelWidth = clamp(sceneWidth * 0.17, 160, 240);
  const collapsedPanelTitleSize = clamp(13 * uiScale, 10.5, 13);
  const collapsedSummarySize = clamp(10.5 * uiScale, 8.5, 10.5);
  const collapsedBadgeSize = clamp(34 * uiScale, 24, 34);
  const compactScene = sceneWidth < 1080;
  const veryCompactScene = sceneWidth < 920;
  const baseSceneTags = veryCompactScene
    ? ["Scene Layer"]
    : compactScene
      ? ["Scene Layer", "Object Map"]
      : ["Scene Layer", "Movement Overlay", "Object Map"];
  const sceneTags = SCENE_OCCLUDER_COUNT > 0 && !veryCompactScene
    ? [...baseSceneTags, "Foreground Occlusion"]
    : baseSceneTags;
  const metricsColumns = compactScene ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))";
  const agentSpriteHeight = clamp(sceneWidth * 0.078, 76, 116);
  const agentTagMinWidth = clamp(sceneWidth * 0.06, 78, 102);
  const agentTagMaxWidth = clamp(sceneWidth * 0.125, 116, 162);
  const agentTagPaddingY = clamp(7 * uiScale, 5, 7);
  const agentTagPaddingX = clamp(8 * uiScale, 6, 8);
  const agentTagOffset = clamp(10 * uiScale, 8, 10);
  const agentTagStatusGap = clamp(6 * uiScale, 4, 6);
  const agentTagStatusDot = clamp(5.5 * uiScale, 4.5, 5.5);
  const agentTagStatusSize = clamp(8.5 * uiScale, 7.5, 8.8);
  const agentTagNameSize = clamp(13.5 * uiScale, 11.5, 14);
  const agentTagRoleSize = clamp(10.5 * uiScale, 9, 10.8);
  const collapsedMissionTitle = veryCompactScene ? "Mission" : "Mission Control";
  const collapsedOverlayTitle = veryCompactScene ? "Overlay" : "Live Overlay";
  const compactSummary = `${visibleEmployees} visible · ${movingAgents} moving`;

  const clientToScenePoint = (clientX: number, clientY: number): ScenePoint | null => {
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  const moveAgentToPoint = (agentName: string, point: ScenePoint) => {
    setSelectedAgentName(agentName);
    setFocusedAgentName(agentName);
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.name !== agentName) return agent;

        const startNodeId = nearestNodeId({ x: agent.x, y: agent.y });
        const targetNodeId = nearestReachableNodeId(startNodeId, point);
        const targetNode = NAV_NODES[targetNodeId];
        if (!targetNode) return agent;
        const manualPath = shortestPath(startNodeId, targetNodeId).slice(1);
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
              filter: "saturate(1.04) contrast(1.1) brightness(0.98)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(4, 7, 14, 0.06), rgba(4, 7, 14, 0.14) 38%, rgba(4, 7, 14, 0.26) 100%)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 50% 43%, rgba(135, 176, 255, 0.1), transparent 28%), radial-gradient(circle at 50% 52%, transparent 42%, rgba(2, 6, 12, 0.5) 100%)",
              mixBlendMode: "screen",
              opacity: 0.7,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(100deg, transparent 0%, rgba(109, 162, 255, 0.05) 46%, rgba(109, 162, 255, 0.16) 49%, rgba(109, 162, 255, 0.05) 52%, transparent 100%)",
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
              opacity: 1,
              transition: "opacity 180ms ease",
            }}
          >
            {showGraph && WALKABLE_ZONES.map((zone) => (
              <polygon
                key={zone.id}
                points={zone.points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="rgba(96, 167, 255, 0.04)"
                stroke="rgba(96, 167, 255, 0.24)"
                strokeWidth={0.16}
              />
            ))}

            {showGraph && SCENE_OBJECTS.map((object) => (
              <g key={object.id}>
                <polygon
                  points={object.footprint.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill={object.sourceAssetId ? "rgba(255, 181, 90, 0.08)" : "rgba(255, 121, 121, 0.08)"}
                  stroke={object.sourceAssetId ? "rgba(255, 181, 90, 0.34)" : "rgba(255, 121, 121, 0.34)"}
                  strokeWidth={0.18}
                />
                <rect
                  x={object.anchor.x - 4.8}
                  y={object.anchor.y - 1.55}
                  rx={0.36}
                  width={9.6}
                  height={1.9}
                  fill="rgba(5, 7, 12, 0.84)"
                  stroke="rgba(255, 244, 220, 0.14)"
                  strokeWidth={0.08}
                />
                <text
                  x={object.anchor.x}
                  y={object.anchor.y - 0.32}
                  textAnchor="middle"
                  style={{
                    fill: object.sourceAssetId ? "#ffd17a" : "#ff9e9e",
                    fontFamily: "var(--font-label)",
                    fontSize: "0.64px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    pointerEvents: "none",
                  }}
                >
                  {object.sourceAssetId ?? object.label}
                </text>
              </g>
            ))}

            {showGraph && NAV_EDGES.map(([fromId, toId]) => {
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
              const bob = moving ? 0 : Math.sin(agent.bobPhase * 0.4) * 0.35;
              const labelAbove = agent.y > 24;

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
                        ...(labelAbove ? { bottom: "100%" } : { top: "100%" }),
                        transform: labelAbove
                          ? `translate(-50%, -${agentTagOffset}px)`
                          : `translate(-50%, ${agentTagOffset}px)`,
                        minWidth: agentTagMinWidth,
                        maxWidth: agentTagMaxWidth,
                        width: "max-content",
                        padding: `${agentTagPaddingY}px ${agentTagPaddingX}px ${agentTagPaddingY + 1}px`,
                        background: "rgba(5, 7, 12, 0.88)",
                        border: `1px solid ${focused ? agent.accent : "rgba(255, 244, 220, 0.12)"}`,
                        boxShadow: focused
                          ? `0 0 0 1px ${agent.accent}28, 0 14px 24px rgba(0, 0, 0, 0.36)`
                          : "0 14px 24px rgba(0, 0, 0, 0.28)",
                        textAlign: "left",
                        pointerEvents: "none",
                        backdropFilter: "blur(6px)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: agentTagStatusGap,
                          marginBottom: clamp(4 * uiScale, 3, 4),
                          fontFamily: "var(--font-label)",
                          fontSize: agentTagStatusSize,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: STATUS_COLORS[agent.status],
                        }}
                      >
                        <span
                          style={{
                            width: agentTagStatusDot,
                            height: agentTagStatusDot,
                            flex: "0 0 auto",
                            background: STATUS_COLORS[agent.status],
                            boxShadow: `0 0 10px ${STATUS_COLORS[agent.status]}80`,
                          }}
                        />
                        {STATUS_LABELS[agent.status]}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-headline)",
                          fontSize: agentTagNameSize,
                          lineHeight: 1,
                          color: "#fff4dc",
                        }}
                      >
                        {formatAgentName(agent.name)}
                      </div>
                      <div
                        style={{
                          marginTop: clamp(3 * uiScale, 2, 3),
                          fontFamily: "var(--font-body)",
                          fontSize: agentTagRoleSize,
                          lineHeight: 1.22,
                          color: "rgba(228, 224, 242, 0.82)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
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
                      directionX={agent.directionX}
                      directionY={agent.directionY}
                      facing={agent.facing}
                      highlighted={focused}
                      moving={moving}
                      opacity={dragging ? 0.2 : 1}
                      phase={agent.bobPhase}
                      size={agentSpriteHeight}
                      spriteSrc={agent.spriteSrc}
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
                  {dragTargetBlocked ? "Route Around Object" : "Drop to Re-route"}
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
                  directionX={inspectedAgent.directionX}
                  directionY={inspectedAgent.directionY}
                  facing={inspectedAgent.facing}
                  highlighted={true}
                  moving={true}
                  opacity={0.96}
                  phase={inspectedAgent.bobPhase}
                  size={agentSpriteHeight}
                  spriteSrc={inspectedAgent.spriteSrc}
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
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${SCENE_FOREGROUND_ASSET})`,
                backgroundPosition: "center",
                backgroundSize: "100% 100%",
              }}
            />
          </div>

          <div
            style={{
              position: "absolute",
              top: sceneInset,
              left: sceneInset,
              zIndex: 6,
              width: missionPanelCollapsed ? collapsedMissionPanelWidth : headerPanelWidth,
              padding: missionPanelCollapsed
                ? `${collapsedPanelPaddingY}px ${collapsedPanelPaddingX}px`
                : `${clamp(18 * uiScale, 12, 18)}px ${panelPadding}px ${panelPadding}px`,
              background: "linear-gradient(180deg, rgba(5, 7, 12, 0.92), rgba(5, 7, 12, 0.78))",
              border: "1px solid rgba(255, 244, 220, 0.16)",
              boxShadow: "0 18px 40px rgba(0, 0, 0, 0.3)",
              backdropFilter: "blur(5px)",
              transition: "width 180ms ease, padding 180ms ease, transform 180ms ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: missionPanelCollapsed ? "center" : "flex-start",
                justifyContent: "space-between",
                gap: collapsedPanelGap,
              }}
            >
              {missionPanelCollapsed ? (
                <div
                  style={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: collapsedPanelGap,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: collapsedBadgeSize,
                      height: collapsedBadgeSize,
                      border: "1px solid rgba(245, 215, 110, 0.4)",
                      color: "#f5d76e",
                      fontFamily: "var(--font-headline)",
                      fontSize: clamp(20 * uiScale, 13, 20),
                      fontWeight: 700,
                      flex: "0 0 auto",
                    }}
                  >
                    2
                  </div>
                  <div
                    style={{
                      minWidth: 0,
                      fontFamily: "var(--font-headline)",
                      fontSize: collapsedPanelTitleSize,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#fff4dc",
                      lineHeight: 1.05,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {collapsedMissionTitle}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: panelHeadlineBox,
                    height: panelHeadlineBox,
                    border: "1px solid rgba(245, 215, 110, 0.4)",
                    color: "#f5d76e",
                    fontFamily: "var(--font-headline)",
                    fontSize: panelHeadlineSize,
                    fontWeight: 700,
                    flex: "0 0 auto",
                  }}
                >
                  2
                </div>
              )}

              <button
                type="button"
                aria-expanded={!missionPanelCollapsed}
                aria-label={missionPanelCollapsed ? "Expand mission panel" : "Collapse mission panel"}
                onClick={() => setMissionPanelCollapsed((prev) => !prev)}
                style={{
                  width: panelToggleSize,
                  height: panelToggleSize,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 244, 220, 0.12)",
                  color: "#cfc6b1",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: panelToggleIconSize }}>
                  {missionPanelCollapsed ? "chevron_right" : "chevron_left"}
                </span>
              </button>
            </div>

            {!missionPanelCollapsed && (
              <>
                <div
                  style={{
                    marginTop: clamp(12 * uiScale, 8, 12),
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
              </>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              top: sceneInset,
              right: sceneInset,
              zIndex: 6,
              width: overlayPanelCollapsed ? collapsedOverlayPanelWidth : sidePanelWidth,
              padding: overlayPanelCollapsed
                ? `${collapsedPanelPaddingY}px ${collapsedPanelPaddingX}px`
                : `${clamp(18 * uiScale, 12, 18)}px ${panelPadding}px ${panelPadding}px`,
              background: "linear-gradient(180deg, rgba(5, 7, 12, 0.9), rgba(5, 7, 12, 0.76))",
              border: "1px solid rgba(255, 244, 220, 0.14)",
              boxShadow: "0 18px 40px rgba(0, 0, 0, 0.26)",
              backdropFilter: "blur(5px)",
              transition: "width 180ms ease, padding 180ms ease, transform 180ms ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: "var(--font-label)",
                fontSize: clamp(11 * uiScale, 9, 11),
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#98907d",
              }}
            >
              <span>{overlayPanelCollapsed ? collapsedOverlayTitle : "Live Overlay"}</span>
              <button
                type="button"
                aria-expanded={!overlayPanelCollapsed}
                aria-label={overlayPanelCollapsed ? "Expand overlay panel" : "Collapse overlay panel"}
                onClick={() => setOverlayPanelCollapsed((prev) => !prev)}
                style={{
                  width: panelToggleSize,
                  height: panelToggleSize,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 244, 220, 0.12)",
                  color: "#cfc6b1",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: panelToggleIconSize }}>
                  {overlayPanelCollapsed ? "chevron_left" : "chevron_right"}
                </span>
              </button>
            </div>
            {overlayPanelCollapsed ? (
              <div
                style={{
                  marginTop: clamp(8 * uiScale, 6, 8),
                  fontFamily: "var(--font-label)",
                  fontSize: collapsedSummarySize,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#cfc6b1",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {compactSummary}
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginTop: clamp(12 * uiScale, 8, 16),
                    display: "grid",
                    gridTemplateColumns: metricsColumns,
                    gap: clamp(10 * uiScale, 6, 10),
                  }}
                >
                    {[
                      { label: "Visible", value: `${visibleEmployees}` },
                      { label: "Moving", value: `${movingAgents}` },
                      { label: "Waypoints", value: `${Object.keys(NAV_NODES).length}` },
                      { label: "Objects", value: `${SCENE_OBJECT_COUNT}` },
                      { label: "Asset-Backed", value: `${SCENE_ASSET_LINKED_OBJECT_COUNT}` },
                      { label: "Occluders", value: `${SCENE_OCCLUDER_COUNT}` },
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
                      Click to open chat. Drag to move across the office floor.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
