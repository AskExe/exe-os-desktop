import type { TabKey } from "../components/Sidebar";

export type OfficeStatus = "active" | "working" | "idle" | "offline";

export interface OfficeEmployee {
  name: string;
  role: string;
  status: OfficeStatus;
}

export interface ScenePoint {
  x: number;
  y: number;
}

export interface NavNode extends ScenePoint {
  id: string;
  links: string[];
}

export interface ForegroundSlice {
  id: string;
  points: ScenePoint[];
  opacity?: number;
}

export interface OfficeDockTab {
  key: TabKey;
  label: string;
  icon: string;
}

export const SCENE_ASSET = "/virtual-office/mission-control-floor.png";
export const SCENE_RATIO = 2274 / 1444;

export const OFFICE_DOCK_TABS: OfficeDockTab[] = [
  { key: "office", label: "Office", icon: "apartment" },
  { key: "work", label: "Work", icon: "work" },
  { key: "wiki", label: "Knowledge", icon: "library_books" },
  { key: "crm", label: "CRM", icon: "hub" },
  { key: "team", label: "Team", icon: "groups" },
];

export const NAV_NODES: Record<string, NavNode> = {
  commandWest: { id: "commandWest", x: 24, y: 46, links: ["mapHub", "consoleWest"] },
  mapHub: { id: "mapHub", x: 41, y: 45, links: ["commandWest", "northLift", "tableNorth", "consoleWest"] },
  northLift: { id: "northLift", x: 59, y: 44, links: ["mapHub", "galleryEast", "tableNorth", "tableEast"] },
  galleryEast: { id: "galleryEast", x: 81, y: 49, links: ["northLift", "dataBridge"] },
  consoleWest: { id: "consoleWest", x: 29, y: 62, links: ["commandWest", "mapHub", "supportSouth", "southWalk"] },
  tableNorth: { id: "tableNorth", x: 57, y: 55, links: ["mapHub", "northLift", "tableEast", "tableSouth", "supportSouth"] },
  tableEast: { id: "tableEast", x: 71, y: 63, links: ["northLift", "tableNorth", "dataBridge", "holoRing"] },
  dataBridge: { id: "dataBridge", x: 82, y: 64, links: ["galleryEast", "tableEast", "holoRing"] },
  supportSouth: { id: "supportSouth", x: 40, y: 73, links: ["consoleWest", "tableNorth", "tableSouth", "southWalk"] },
  tableSouth: { id: "tableSouth", x: 56, y: 76, links: ["tableNorth", "supportSouth", "holoRing", "opsSouth"] },
  holoRing: { id: "holoRing", x: 73, y: 79, links: ["tableEast", "dataBridge", "tableSouth", "opsSouth"] },
  southWalk: { id: "southWalk", x: 34, y: 86, links: ["consoleWest", "supportSouth", "opsSouth"] },
  opsSouth: { id: "opsSouth", x: 55, y: 88, links: ["tableSouth", "holoRing", "southWalk"] },
};

export const NAV_EDGES = Object.values(NAV_NODES).flatMap((node) =>
  node.links
    .filter((target) => node.id < target)
    .map((target) => [node.id, target] as const)
);

export const PATROL_ROUTES: Record<string, string[]> = {
  exe: ["consoleWest", "supportSouth", "southWalk", "tableSouth"],
  yoshi: ["mapHub", "tableNorth", "tableSouth", "opsSouth"],
  tom: ["commandWest", "consoleWest", "supportSouth", "tableNorth"],
  mari: ["tableEast", "dataBridge", "holoRing", "tableSouth"],
  sasha: ["galleryEast", "northLift", "dataBridge", "holoRing"],
};

export const AGENT_ACCENTS: Record<string, string> = {
  exe: "#f5d76e",
  yoshi: "#77e5ff",
  tom: "#a7ff9d",
  mari: "#ffb86d",
  sasha: "#ff8ca8",
};

export const FOREGROUND_SLICES: ForegroundSlice[] = [
  {
    id: "west-railing",
    opacity: 1,
    points: [
      { x: 0, y: 77 },
      { x: 13, y: 68 },
      { x: 20, y: 73 },
      { x: 14, y: 100 },
      { x: 0, y: 100 },
    ],
  },
  {
    id: "holo-pedestal",
    opacity: 1,
    points: [
      { x: 61, y: 57 },
      { x: 83, y: 51 },
      { x: 93, y: 63 },
      { x: 73, y: 75 },
    ],
  },
  {
    id: "south-right-console",
    opacity: 1,
    points: [
      { x: 52, y: 86 },
      { x: 65, y: 82 },
      { x: 70, y: 90 },
      { x: 56, y: 97 },
    ],
  },
];

export function formatAgentName(name: string): string {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function nearestNodeId(point: ScenePoint): string {
  let bestId = Object.keys(NAV_NODES)[0] ?? "tableSouth";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of Object.values(NAV_NODES)) {
    const dx = node.x - point.x;
    const dy = node.y - point.y;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = node.id;
    }
  }

  return bestId;
}

export function shortestPath(startId: string, endId: string): string[] {
  if (startId === endId) return [startId];

  const queue: string[] = [startId];
  const visited = new Set([startId]);
  const parents = new Map<string, string | null>([[startId, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current === endId) break;

    for (const next of NAV_NODES[current]?.links ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      parents.set(next, current);
      queue.push(next);
    }
  }

  if (!parents.has(endId)) return [startId];

  const path: string[] = [];
  let cursor: string | null = endId;
  while (cursor) {
    path.unshift(cursor);
    cursor = parents.get(cursor) ?? null;
  }

  return path;
}
