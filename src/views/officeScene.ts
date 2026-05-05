import officeLevel from "./officeLevel.json";

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

export interface ScenePolygon {
  id: string;
  points: ScenePoint[];
}

export interface SceneObject {
  id: string;
  label: string;
  anchor: ScenePoint;
  footprint: ScenePoint[];
  occlusionFootprint?: ScenePoint[];
  occludesAgents: boolean;
  blocksMovement: boolean;
  orientation: "front" | "side" | "back" | "custom";
  sourceAssetId: string | null;
  zLayer: number;
  occluderAsset?: string;
}

interface OfficeLevelNavSettings {
  gridStartX: number;
  gridEndX: number;
  gridStartY: number;
  gridEndY: number;
  gridStep: number;
  obstacleClearance: number;
}

interface OfficeLevelData {
  canvas: {
    width: number;
    height: number;
  };
  assets: {
    background: string;
    foreground: string;
  };
  nav: OfficeLevelNavSettings;
  walkableZones: ScenePolygon[];
  patrolAnchors: Record<string, ScenePoint>;
  defaultPatrolAnchorIds: string[];
  patrolRouteAnchors: Record<string, string[]>;
  objects: SceneObject[];
}

const LEVEL = officeLevel as OfficeLevelData;

export const SCENE_ASSET = LEVEL.assets.background;
export const SCENE_FOREGROUND_ASSET = LEVEL.assets.foreground;
export const SCENE_RATIO = LEVEL.canvas.width / LEVEL.canvas.height;

export const WALKABLE_ZONES: ScenePolygon[] = LEVEL.walkableZones;
export const SCENE_OBJECTS: SceneObject[] = LEVEL.objects;

export const OBSTACLE_ZONES: ScenePolygon[] = SCENE_OBJECTS
  .filter((object) => object.blocksMovement)
  .map((object) => ({
    id: object.id,
    points: object.footprint,
  }));

export const FOREGROUND_SLICES: ScenePolygon[] = SCENE_OBJECTS
  .filter((object) => object.occludesAgents)
  .map((object) => ({
    id: object.id,
    points: object.occlusionFootprint ?? object.footprint,
  }));

export const AGENT_ACCENTS: Record<string, string> = {
  exe: "#f5d76e",
  yoshi: "#77e5ff",
  tom: "#a7ff9d",
  mari: "#ffb86d",
  sasha: "#ff8ca8",
};

export const DEFAULT_AGENT_SPRITES = [
  "/virtual-office/agents/operative-0.png",
  "/virtual-office/agents/operative-1.png",
  "/virtual-office/agents/operative-2.png",
  "/virtual-office/agents/operative-3.png",
  "/virtual-office/agents/operative-4.png",
  "/virtual-office/agents/operative-5.png",
];

export const AGENT_SPRITES: Record<string, string> = {
  exe: "/virtual-office/agents/operative-5.png",
  yoshi: "/virtual-office/agents/operative-4.png",
  tom: "/virtual-office/agents/operative-2.png",
  mari: "/virtual-office/agents/operative-3.png",
  sasha: "/virtual-office/agents/operative-1.png",
};

const GRID_START_X = LEVEL.nav.gridStartX;
const GRID_END_X = LEVEL.nav.gridEndX;
const GRID_START_Y = LEVEL.nav.gridStartY;
const GRID_END_Y = LEVEL.nav.gridEndY;
const GRID_STEP = LEVEL.nav.gridStep;
const OBSTACLE_CLEARANCE = LEVEL.nav.obstacleClearance;
const NAV_LINK_STEPS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1],
];

const PATROL_ANCHORS: Record<string, ScenePoint> = LEVEL.patrolAnchors;
const DEFAULT_PATROL_ANCHOR_IDS = LEVEL.defaultPatrolAnchorIds;
const PATROL_ROUTE_ANCHORS: Record<string, string[]> = LEVEL.patrolRouteAnchors;

export const SCENE_OCCLUDER_COUNT = FOREGROUND_SLICES.length;
export const SCENE_ASSET_LINKED_OBJECT_COUNT = SCENE_OBJECTS.filter((object) => Boolean(object.sourceAssetId)).length;
export const SCENE_OBJECT_COUNT = SCENE_OBJECTS.length;
export const SCENE_OBSTACLE_COUNT = OBSTACLE_ZONES.length;

export function formatAgentName(name: string): string {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function pointInPolygon(point: ScenePoint, polygon: ScenePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]?.x ?? 0;
    const yi = polygon[i]?.y ?? 0;
    const xj = polygon[j]?.x ?? 0;
    const yj = polygon[j]?.y ?? 0;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInAnyPolygon(point: ScenePoint, polygons: ScenePolygon[]): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon.points));
}

function distancePointToSegment(point: ScenePoint, start: ScenePoint, end: ScenePoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function distanceToPolygonEdges(point: ScenePoint, polygon: ScenePoint[]): number {
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    bestDistance = Math.min(bestDistance, distancePointToSegment(point, polygon[j]!, polygon[i]!));
  }
  return bestDistance;
}

function orientation(a: ScenePoint, b: ScenePoint, c: ScenePoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(a: ScenePoint, b: ScenePoint, c: ScenePoint): boolean {
  return c.x >= Math.min(a.x, b.x) - 1e-9
    && c.x <= Math.max(a.x, b.x) + 1e-9
    && c.y >= Math.min(a.y, b.y) - 1e-9
    && c.y <= Math.max(a.y, b.y) + 1e-9;
}

function segmentsIntersect(a1: ScenePoint, a2: ScenePoint, b1: ScenePoint, b2: ScenePoint): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) {
    return true;
  }

  if (Math.abs(o1) < 1e-9 && pointOnSegment(a1, a2, b1)) return true;
  if (Math.abs(o2) < 1e-9 && pointOnSegment(a1, a2, b2)) return true;
  if (Math.abs(o3) < 1e-9 && pointOnSegment(b1, b2, a1)) return true;
  if (Math.abs(o4) < 1e-9 && pointOnSegment(b1, b2, a2)) return true;

  return false;
}

function segmentHitsPolygon(start: ScenePoint, end: ScenePoint, polygon: ScenePoint[]): boolean {
  if (pointInPolygon(start, polygon) || pointInPolygon(end, polygon)) return true;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (segmentsIntersect(start, end, polygon[j]!, polygon[i]!)) return true;
  }

  return false;
}

function interpolatePoint(start: ScenePoint, end: ScenePoint, factor: number): ScenePoint {
  return {
    x: start.x + (end.x - start.x) * factor,
    y: start.y + (end.y - start.y) * factor,
  };
}

function pointInWalkable(point: ScenePoint): boolean {
  return pointInAnyPolygon(point, WALKABLE_ZONES);
}

export function pointInObstacle(point: ScenePoint): boolean {
  return pointInAnyPolygon(point, OBSTACLE_ZONES);
}

function pointHasClearance(point: ScenePoint): boolean {
  if (!pointInWalkable(point) || pointInObstacle(point)) return false;
  return OBSTACLE_ZONES.every((zone) => distanceToPolygonEdges(point, zone.points) >= OBSTACLE_CLEARANCE);
}

function segmentStaysWalkable(start: ScenePoint, end: ScenePoint): boolean {
  for (let index = 1; index < 8; index += 1) {
    if (!pointHasClearance(interpolatePoint(start, end, index / 8))) return false;
  }
  return true;
}

function canTraverseSegment(start: ScenePoint, end: ScenePoint): boolean {
  if (!segmentStaysWalkable(start, end)) return false;
  return OBSTACLE_ZONES.every((zone) => !segmentHitsPolygon(start, end, zone.points));
}

function buildNavigationGraph(): Record<string, NavNode> {
  const draftNodes = new Map<string, NavNode>();
  const gridLookup = new Map<string, string>();

  for (let row = 0, y = GRID_START_Y; y <= GRID_END_Y; y += GRID_STEP, row += 1) {
    for (let column = 0, x = GRID_START_X; x <= GRID_END_X; x += GRID_STEP, column += 1) {
      const point = { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
      if (!pointHasClearance(point)) continue;

      const id = `nav-${column}-${row}`;
      draftNodes.set(id, {
        id,
        x: point.x,
        y: point.y,
        links: [],
      });
      gridLookup.set(`${column}:${row}`, id);
    }
  }

  for (const node of draftNodes.values()) {
    const [, columnText, rowText] = node.id.split("-");
    const column = Number(columnText);
    const row = Number(rowText);

    for (const [deltaColumn, deltaRow] of NAV_LINK_STEPS) {
      const neighborId = gridLookup.get(`${column + deltaColumn}:${row + deltaRow}`);
      const neighbor = neighborId ? draftNodes.get(neighborId) : null;
      if (!neighbor) continue;
      if (!canTraverseSegment(node, neighbor)) continue;

      node.links.push(neighbor.id);
      neighbor.links.push(node.id);
    }
  }

  const connectedNodes = new Map<string, NavNode>();
  for (const node of draftNodes.values()) {
    if (node.links.length === 0) continue;
    connectedNodes.set(node.id, {
      ...node,
      links: node.links.filter((linkId) => draftNodes.get(linkId)?.links.length),
    });
  }

  return Object.fromEntries(connectedNodes.entries());
}

export const NAV_NODES: Record<string, NavNode> = buildNavigationGraph();

export const NAV_EDGES = Object.values(NAV_NODES).flatMap((node) =>
  node.links
    .filter((target) => node.id < target)
    .map((target) => [node.id, target] as const)
);

function buildNodeComponents(): Map<string, number> {
  const components = new Map<string, number>();
  let componentId = 0;

  for (const startId of Object.keys(NAV_NODES)) {
    if (components.has(startId)) continue;
    const queue = [startId];
    components.set(startId, componentId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const nextId of NAV_NODES[currentId]?.links ?? []) {
        if (components.has(nextId)) continue;
        components.set(nextId, componentId);
        queue.push(nextId);
      }
    }

    componentId += 1;
  }

  return components;
}

const NODE_COMPONENTS = buildNodeComponents();

function componentIdForNode(nodeId: string): number {
  return NODE_COMPONENTS.get(nodeId) ?? -1;
}

function patrolRouteFromAnchors(anchorIds: string[]): string[] {
  return anchorIds
    .map((anchorId) => nearestNodeId(PATROL_ANCHORS[anchorId] ?? PATROL_ANCHORS.southCenter))
    .filter((nodeId, index, all) => index === 0 || nodeId !== all[index - 1]);
}

export const DEFAULT_PATROL_ROUTE = patrolRouteFromAnchors(DEFAULT_PATROL_ANCHOR_IDS);

export const PATROL_ROUTES: Record<string, string[]> = Object.fromEntries(
  Object.entries(PATROL_ROUTE_ANCHORS).map(([name, anchors]) => [name, patrolRouteFromAnchors(anchors)]),
);

export function nearestNodeId(point: ScenePoint): string {
  let bestId = Object.keys(NAV_NODES)[0] ?? "nav-0-0";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of Object.values(NAV_NODES)) {
    const distance = Math.hypot(node.x - point.x, node.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = node.id;
    }
  }

  return bestId;
}

export function nearestReachableNodeId(startId: string, point: ScenePoint): string {
  const startComponentId = componentIdForNode(startId);
  let bestId = NAV_NODES[startId] ? startId : nearestNodeId(point);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of Object.values(NAV_NODES)) {
    if (startComponentId >= 0 && componentIdForNode(node.id) !== startComponentId) continue;
    const distance = Math.hypot(node.x - point.x, node.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = node.id;
    }
  }

  return bestId;
}

export function sameComponentNodeIds(startId: string, nodeIds: string[]): string[] {
  const startComponentId = componentIdForNode(startId);
  return nodeIds.filter((nodeId) => componentIdForNode(nodeId) === startComponentId);
}

function simplifyPath(path: string[]): string[] {
  if (path.length <= 2) return path;

  const simplified = [path[0]!];
  let cursorIndex = 0;

  while (cursorIndex < path.length - 1) {
    let nextIndex = cursorIndex + 1;
    const cursorNode = NAV_NODES[path[cursorIndex]!];

    if (cursorNode) {
      for (let candidateIndex = path.length - 1; candidateIndex > cursorIndex + 1; candidateIndex -= 1) {
        const candidateNode = NAV_NODES[path[candidateIndex]!];
        if (!candidateNode || !canTraverseSegment(cursorNode, candidateNode)) continue;
        nextIndex = candidateIndex;
        break;
      }
    }

    simplified.push(path[nextIndex]!);
    cursorIndex = nextIndex;
  }

  return simplified;
}

export function shortestPath(startId: string, endId: string): string[] {
  const safeStartId = NAV_NODES[startId] ? startId : nearestNodeId(PATROL_ANCHORS.southCenter);
  const safeEndId = NAV_NODES[endId] ? endId : safeStartId;

  if (safeStartId === safeEndId) return [safeStartId];

  const openSet = new Set([safeStartId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[safeStartId, 0]]);
  const heuristic = (leftId: string, rightId: string) => {
    const left = NAV_NODES[leftId];
    const right = NAV_NODES[rightId];
    if (!left || !right) return Number.POSITIVE_INFINITY;
    return Math.hypot(left.x - right.x, left.y - right.y);
  };
  const fScore = new Map<string, number>([[safeStartId, heuristic(safeStartId, safeEndId)]]);

  while (openSet.size > 0) {
    let currentId = safeStartId;
    let currentScore = Number.POSITIVE_INFINITY;

    for (const candidateId of openSet) {
      const candidateScore = fScore.get(candidateId) ?? Number.POSITIVE_INFINITY;
      if (candidateScore < currentScore) {
        currentScore = candidateScore;
        currentId = candidateId;
      }
    }

    if (currentId === safeEndId) {
      const path: string[] = [currentId];
      let cursor = currentId;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        path.unshift(cursor);
      }
      return simplifyPath(path);
    }

    openSet.delete(currentId);

    for (const neighborId of NAV_NODES[currentId]?.links ?? []) {
      const currentNode = NAV_NODES[currentId];
      const neighborNode = NAV_NODES[neighborId];
      if (!currentNode || !neighborNode) continue;

      const tentativeScore = (gScore.get(currentId) ?? Number.POSITIVE_INFINITY)
        + Math.hypot(neighborNode.x - currentNode.x, neighborNode.y - currentNode.y);

      if (tentativeScore >= (gScore.get(neighborId) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(neighborId, currentId);
      gScore.set(neighborId, tentativeScore);
      fScore.set(neighborId, tentativeScore + heuristic(neighborId, safeEndId));
      openSet.add(neighborId);
    }
  }

  return [safeStartId];
}
