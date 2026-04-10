/**
 * PreText chat model — measurement, layout, and virtualization for markdown chat.
 *
 * Ported from @chenglou/pretext demos/markdown-chat.model.ts.
 * Adapted for:
 *   - Exe Foundry Bold fonts (Manrope, Epilogue, Space Grotesk)
 *   - Dynamic message lists (no template cycling)
 *   - Simplified API (no occlusion banners)
 */

import { marked, type Token, type Tokens } from "marked";
import {
  layoutWithLines,
  measureLineStats,
  measureNaturalWidth,
  prepareWithSegments,
  type LayoutLine,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  prepareRichInline,
  walkRichInlineLineRanges,
  type PreparedRichInline,
} from "@chenglou/pretext/rich-inline";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MarkdownChatSeed = {
  role: "assistant" | "user";
  markdown: string;
};

export type PreparedChatTemplate = {
  blocks: PreparedBlock[];
  role: "assistant" | "user";
};

export type InlineFragmentLayout = {
  className: string;
  href: string | null;
  leadingGap: number;
  text: string;
};

export type TemplateFrame = {
  blocks: BlockFrame[];
  bubbleHeight: number;
  contentInsetX: number;
  frameWidth: number;
  layoutContentWidth: number;
  role: "assistant" | "user";
  totalHeight: number;
};

export type ChatMessageInstance = {
  bottom: number;
  prepared: PreparedChatTemplate;
  frame: TemplateFrame;
  top: number;
};

export type ConversationFrame = {
  chatWidth: number;
  messages: ChatMessageInstance[];
  totalHeight: number;
};

type InlineBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "inline";
  lineHeight: number;
  lines: Array<{ fragments: InlineFragmentLayout[]; width: number }>;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  usedWidth: number;
};

type CodeBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "code";
  lines: LayoutLine[];
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  usedWidth: number;
  width: number;
};

type RuleBlockLayout = {
  contentLeft: number;
  height: number;
  kind: "rule";
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
  width: number;
};

export type BlockLayout = InlineBlockLayout | CodeBlockLayout | RuleBlockLayout;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MESSAGE_SIDE_PADDING = 16;
const TOP_PADDING = 12;
const BOTTOM_PADDING = 12;
const MESSAGE_GAP = 10;
const BUBBLE_MAX_RATIO = 0.82;
const BUBBLE_PADDING_X = 14;
const BUBBLE_PADDING_Y = 10;
const BODY_LINE_HEIGHT = 22;
const HEADING_ONE_LINE_HEIGHT = 26;
const HEADING_TWO_LINE_HEIGHT = 24;
const HARD_BREAK_GAP = 4;
const BLOCK_GAP = 10;
const RICH_BLOCK_GAP = 2;
const LIST_ITEM_GAP = 4;
const LIST_NESTING_INDENT = 18;
const BLOCKQUOTE_INDENT = 18;
const LIST_MARKER_GAP = 10;
const RAIL_OFFSET = 5;
const RULE_HEIGHT = 18;
const VIRTUALIZATION_OVERSCAN = 3;

export const CODE_LINE_HEIGHT = 18;
export const CODE_BLOCK_PADDING_X = 12;
export const CODE_BLOCK_PADDING_Y = 8;

// ---------------------------------------------------------------------------
// Font constants — Exe Foundry Bold
// ---------------------------------------------------------------------------

const BODY_FAMILY = "Manrope, sans-serif";
const HEADING_FAMILY = "Epilogue, sans-serif";
const CODE_FAMILY = '"Space Grotesk", sans-serif';
const INLINE_CODE_FONT = `600 12px ${CODE_FAMILY}`;
const INLINE_CODE_EXTRA_WIDTH = 12;
const IMAGE_FONT = `700 11px ${BODY_FAMILY}`;
const IMAGE_EXTRA_WIDTH = 14;
const MARKER_FONT = `600 11px ${CODE_FAMILY}`;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type InlineVariant = "body" | "heading-1" | "heading-2";

type MarkState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  href: string | null;
};

type ParseContext = {
  listDepth: number;
  quoteDepth: number;
};

type InlinePiece = {
  breakMode: "normal" | "never";
  className: string;
  extraWidth: number;
  font: string;
  href: string | null;
  text: string;
};

type PreparedBlockBase = {
  contentLeft: number;
  marginTop: number;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
};

type PreparedInlineBlock = PreparedBlockBase & {
  kind: "inline";
  classNames: string[];
  flow: PreparedRichInline;
  hrefs: Array<string | null>;
  lineHeight: number;
};

type PreparedCodeBlock = PreparedBlockBase & {
  kind: "code";
  lineHeight: number;
  prepared: PreparedTextWithSegments;
};

type PreparedRuleBlock = PreparedBlockBase & {
  kind: "rule";
  height: number;
};

type PreparedBlock = PreparedInlineBlock | PreparedCodeBlock | PreparedRuleBlock;

type BlockFrameBase = {
  contentLeft: number;
  height: number;
  markerClassName: string | null;
  markerLeft: number | null;
  markerText: string | null;
  quoteRailLefts: number[];
  top: number;
};

type InlineBlockFrame = BlockFrameBase & {
  kind: "inline";
  lineHeight: number;
  usedWidth: number;
};

type CodeBlockFrame = BlockFrameBase & {
  kind: "code";
  lineHeight: number;
  width: number;
};

type RuleBlockFrame = BlockFrameBase & {
  kind: "rule";
  width: number;
};

type BlockFrame = InlineBlockFrame | CodeBlockFrame | RuleBlockFrame;

// ---------------------------------------------------------------------------
// Constant state
// ---------------------------------------------------------------------------

const EMPTY_MARK_STATE: MarkState = {
  bold: false,
  italic: false,
  strike: false,
  href: null,
};

const markerWidthCache = new Map<string, number>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createPreparedChatTemplates(
  specs: readonly MarkdownChatSeed[],
): PreparedChatTemplate[] {
  return specs.map((spec) => ({
    blocks: parseMarkdownBlocks(spec.markdown),
    role: spec.role,
  }));
}

export function buildConversationFrame(
  templates: readonly PreparedChatTemplate[],
  chatWidth: number,
): ConversationFrame {
  const laneWidth = Math.max(120, chatWidth - MESSAGE_SIDE_PADDING * 2);
  const userFrameWidth = Math.min(
    laneWidth,
    Math.max(240, Math.floor(chatWidth * BUBBLE_MAX_RATIO)),
  );
  const assistantFrameWidth = laneWidth;
  const messages: ChatMessageInstance[] = new Array(templates.length);

  let y = TOP_PADDING;
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i]!;
    const contentInsetX = BUBBLE_PADDING_X;
    const frameWidth =
      template.role === "assistant" ? assistantFrameWidth : userFrameWidth;
    const contentWidth = Math.max(120, frameWidth - contentInsetX * 2);
    const messageFrame = layoutTemplateFrame(
      template,
      frameWidth,
      contentWidth,
      contentInsetX,
    );
    const top = y;
    const bottom = top + messageFrame.totalHeight;

    messages[i] = { bottom, frame: messageFrame, prepared: template, top };
    y = bottom + MESSAGE_GAP;
  }

  const totalHeight =
    messages.length === 0
      ? TOP_PADDING + BOTTOM_PADDING
      : y - MESSAGE_GAP + BOTTOM_PADDING;

  return { chatWidth, messages, totalHeight };
}

export function findVisibleRange(
  frame: ConversationFrame,
  scrollTop: number,
  viewportHeight: number,
): { start: number; end: number } {
  if (frame.messages.length === 0) return { start: 0, end: 0 };

  const minY = Math.max(0, scrollTop);
  const maxY = scrollTop + viewportHeight;

  // Binary search: first message whose bottom > minY
  let low = 0;
  let high = frame.messages.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (frame.messages[mid]!.bottom > minY) high = mid;
    else low = mid + 1;
  }
  const start = Math.max(0, low - VIRTUALIZATION_OVERSCAN);

  // Binary search: first message whose top >= maxY
  low = start;
  high = frame.messages.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (frame.messages[mid]!.top >= maxY) high = mid;
    else low = mid + 1;
  }
  const end = Math.min(frame.messages.length, low + VIRTUALIZATION_OVERSCAN);

  return { start, end };
}

export function materializeTemplateBlocks(
  message: ChatMessageInstance,
): BlockLayout[] {
  return message.prepared.blocks.map((block, index) =>
    materializeBlockLayout(
      block,
      message.frame.blocks[index]!,
      message.frame.layoutContentWidth,
    ),
  );
}

// ---------------------------------------------------------------------------
// Markdown parsing → prepared blocks
// ---------------------------------------------------------------------------

function parseMarkdownBlocks(markdown: string): PreparedBlock[] {
  const tokens = marked.lexer(markdown, { gfm: true });
  return parseBlockTokens(tokens, { listDepth: 0, quoteDepth: 0 });
}

function parseBlockTokens(
  tokens: readonly Token[],
  ctx: ParseContext,
): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    switch (token.type) {
      case "space":
      case "def":
        continue;

      case "paragraph":
        appendBlockGroup(
          blocks,
          buildInlineBlocks(token.tokens ?? [], "body", ctx),
          BLOCK_GAP,
        );
        continue;

      case "heading":
        appendBlockGroup(
          blocks,
          buildInlineBlocks(
            token.tokens ?? [],
            headingVariant(token.depth),
            ctx,
          ),
          BLOCK_GAP + 4,
        );
        continue;

      case "code":
        appendBlockGroup(
          blocks,
          [buildCodeBlock(token.text, ctx)],
          RICH_BLOCK_GAP,
        );
        continue;

      case "list":
        appendBlockGroup(
          blocks,
          buildListBlocks(token as Tokens.List, ctx),
          BLOCK_GAP,
        );
        continue;

      case "blockquote":
        appendBlockGroup(
          blocks,
          parseBlockTokens(token.tokens ?? [], {
            listDepth: ctx.listDepth,
            quoteDepth: ctx.quoteDepth + 1,
          }),
          RICH_BLOCK_GAP,
        );
        continue;

      case "hr":
        appendBlockGroup(
          blocks,
          [buildRuleBlock(ctx)],
          BLOCK_GAP + 2,
        );
        continue;

      case "table":
        appendBlockGroup(
          blocks,
          [buildCodeBlock(formatTable(token as Tokens.Table), ctx)],
          RICH_BLOCK_GAP,
        );
        continue;

      case "html": {
        const htmlText =
          token.text.trim().length > 0 ? token.text : token.raw;
        const isPre = "pre" in token && token.pre === true;
        if (token.block || isPre) {
          appendBlockGroup(
            blocks,
            [buildCodeBlock(htmlText, ctx)],
            RICH_BLOCK_GAP,
          );
        } else {
          appendBlockGroup(
            blocks,
            buildPlainTextBlocks(htmlText, "body", ctx),
            BLOCK_GAP,
          );
        }
        continue;
      }

      case "text":
        if (Array.isArray(token.tokens) && token.tokens.length > 0) {
          appendBlockGroup(
            blocks,
            buildInlineBlocks(token.tokens, "body", ctx),
            BLOCK_GAP,
          );
        } else {
          appendBlockGroup(
            blocks,
            buildPlainTextBlocks(token.text, "body", ctx),
            BLOCK_GAP,
          );
        }
        continue;

      default: {
        const fallback = fallbackTextForToken(token);
        if (fallback.length > 0) {
          appendBlockGroup(
            blocks,
            buildPlainTextBlocks(fallback, "body", ctx),
            BLOCK_GAP,
          );
        }
      }
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// List handling
// ---------------------------------------------------------------------------

function buildListBlocks(
  token: Tokens.List,
  ctx: ParseContext,
): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];
  const itemCtx: ParseContext = {
    listDepth: ctx.listDepth + 1,
    quoteDepth: ctx.quoteDepth,
  };

  for (let i = 0; i < token.items.length; i++) {
    const item = token.items[i]!;
    let itemBlocks = parseBlockTokens(item.tokens, itemCtx);
    if (itemBlocks.length === 0) {
      itemBlocks = buildPlainTextBlocks(item.text, "body", itemCtx);
    }

    decorateListItemBlocks(
      itemBlocks,
      resolveListMarkerText(token, item, i),
      resolveListMarkerClassName(token, item),
    );
    appendBlockGroup(blocks, itemBlocks, LIST_ITEM_GAP);
  }

  return blocks;
}

function decorateListItemBlocks(
  blocks: PreparedBlock[],
  markerText: string,
  markerClassName: string,
): void {
  if (blocks.length === 0) return;

  const markerArea = measureMarkerWidth(markerText) + LIST_MARKER_GAP;
  for (let i = 0; i < blocks.length; i++) {
    blocks[i] = shiftBlock(blocks[i]!, markerArea);
  }

  const first = blocks[0]!;
  blocks[0] = {
    ...first,
    markerClassName,
    markerLeft: first.contentLeft - markerArea,
    markerText,
  } satisfies PreparedBlock;
}

function resolveListMarkerText(
  list: Tokens.List,
  item: Tokens.ListItem,
  index: number,
): string {
  if (item.task) return item.checked ? "\u2611" : "\u2610";
  if (list.ordered) {
    const start = typeof list.start === "number" ? list.start : 1;
    return `${start + index}.`;
  }
  return "\u2022";
}

function resolveListMarkerClassName(
  list: Tokens.List,
  item: Tokens.ListItem,
): string {
  if (item.task) return "block-marker block-marker--task";
  return list.ordered
    ? "block-marker block-marker--ordered"
    : "block-marker block-marker--bullet";
}

// ---------------------------------------------------------------------------
// Inline block building
// ---------------------------------------------------------------------------

function buildInlineBlocks(
  tokens: readonly Token[],
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const lines = collectInlinePieceLines(tokens, variant);
  return buildPreparedInlineBlocks(lines, variant, ctx);
}

function buildPlainTextBlocks(
  text: string,
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const piece = createTextPiece(text, EMPTY_MARK_STATE, variant);
  if (piece === null) return [];
  return buildPreparedInlineBlocks([[piece]], variant, ctx);
}

function buildPreparedInlineBlocks(
  lines: InlinePiece[][],
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const blocks: PreparedBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const block = buildPreparedInlineBlock(lines[i]!, variant, ctx);
    if (block === null) continue;
    blocks.push({
      ...block,
      marginTop: blocks.length === 0 ? 0 : HARD_BREAK_GAP,
    } satisfies PreparedBlock);
  }

  return blocks;
}

function buildPreparedInlineBlock(
  pieces: InlinePiece[],
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedInlineBlock | null {
  if (pieces.length === 0) return null;

  return {
    ...createBlockBase(ctx),
    classNames: pieces.map((p) => p.className),
    flow: prepareRichInline(
      pieces.map((p) => ({
        text: p.text,
        font: p.font,
        break: p.breakMode,
        extraWidth: p.extraWidth,
      })),
    ),
    hrefs: pieces.map((p) => p.href),
    kind: "inline",
    lineHeight: lineHeightForVariant(variant),
  };
}

// ---------------------------------------------------------------------------
// Code and rule blocks
// ---------------------------------------------------------------------------

function buildCodeBlock(text: string, ctx: ParseContext): PreparedCodeBlock {
  return {
    ...createBlockBase(ctx),
    kind: "code",
    lineHeight: CODE_LINE_HEIGHT,
    prepared: prepareWithSegments(
      stripTrailingNewline(text),
      `500 12px ${CODE_FAMILY}`,
      { whiteSpace: "pre-wrap" },
    ),
  };
}

function buildRuleBlock(ctx: ParseContext): PreparedRuleBlock {
  return {
    ...createBlockBase(ctx),
    height: RULE_HEIGHT,
    kind: "rule",
  };
}

// ---------------------------------------------------------------------------
// Block base / helpers
// ---------------------------------------------------------------------------

function createBlockBase(ctx: ParseContext): PreparedBlockBase {
  const listIndent = Math.max(0, ctx.listDepth - 1) * LIST_NESTING_INDENT;
  const contentLeft = listIndent + ctx.quoteDepth * BLOCKQUOTE_INDENT;
  const quoteRailLefts: number[] = [];

  for (let d = 0; d < ctx.quoteDepth; d++) {
    quoteRailLefts.push(listIndent + d * BLOCKQUOTE_INDENT + RAIL_OFFSET);
  }

  return {
    contentLeft,
    marginTop: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteRailLefts,
  };
}

function appendBlockGroup(
  target: PreparedBlock[],
  group: PreparedBlock[],
  firstMargin: number,
): void {
  if (group.length === 0) return;

  for (let i = 0; i < group.length; i++) {
    const block = group[i]!;
    target.push({
      ...block,
      marginTop:
        i === 0 ? (target.length === 0 ? 0 : firstMargin) : block.marginTop,
    } satisfies PreparedBlock);
  }
}

function shiftBlock(block: PreparedBlock, delta: number): PreparedBlock {
  return { ...block, contentLeft: block.contentLeft + delta } satisfies PreparedBlock;
}

// ---------------------------------------------------------------------------
// Inline piece collection (token walker)
// ---------------------------------------------------------------------------

function collectInlinePieceLines(
  tokens: readonly Token[],
  variant: InlineVariant,
): InlinePiece[][] {
  const lines: InlinePiece[][] = [[]];

  function currentLine(): InlinePiece[] {
    return lines[lines.length - 1]!;
  }

  function pushLineBreak(): void {
    lines.push([]);
  }

  function pushPiece(piece: InlinePiece | null): void {
    if (piece === null) return;
    const line = currentLine();
    const previous = line[line.length - 1];
    if (previous !== undefined && canMergeInlinePieces(previous, piece)) {
      previous.text += piece.text;
      return;
    }
    line.push(piece);
  }

  function walk(tokenList: readonly Token[], marks: MarkState): void {
    for (let i = 0; i < tokenList.length; i++) {
      const token = tokenList[i]!;

      switch (token.type) {
        case "text":
          if (Array.isArray(token.tokens) && token.tokens.length > 0) {
            walk(token.tokens, marks);
          } else {
            pushPiece(createTextPiece(token.text, marks, variant));
          }
          continue;
        case "escape":
          pushPiece(createTextPiece(token.text, marks, variant));
          continue;
        case "strong":
          walk(token.tokens ?? [], { ...marks, bold: true });
          continue;
        case "em":
          walk(token.tokens ?? [], { ...marks, italic: true });
          continue;
        case "del":
          walk(token.tokens ?? [], { ...marks, strike: true });
          continue;
        case "codespan":
          pushPiece(createCodePiece(token.text));
          continue;
        case "link":
          walk(token.tokens ?? [], { ...marks, href: token.href });
          continue;
        case "image":
          pushPiece(
            createImagePiece(
              token.text.length > 0 ? token.text : token.href,
            ),
          );
          continue;
        case "br":
          pushLineBreak();
          continue;
        case "checkbox":
          pushPiece(
            createTextPiece(
              token.checked ? "[x] " : "[ ] ",
              marks,
              variant,
            ),
          );
          continue;
        case "html":
          pushPiece(createTextPiece(token.text, marks, variant));
          continue;
        default: {
          const fallback = fallbackTextForToken(token);
          if (fallback.length > 0) {
            pushPiece(createTextPiece(fallback, marks, variant));
          }
        }
      }
    }
  }

  walk(tokens, EMPTY_MARK_STATE);

  // Trim trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1]!.length === 0) {
    lines.pop();
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Piece constructors
// ---------------------------------------------------------------------------

function createTextPiece(
  text: string,
  marks: MarkState,
  variant: InlineVariant,
): InlinePiece | null {
  if (text.length === 0) return null;
  return {
    breakMode: "normal",
    className: resolveTextClassName(variant, marks),
    extraWidth: 0,
    font: resolveTextFont(variant, marks),
    href: marks.href,
    text,
  };
}

function createCodePiece(text: string): InlinePiece | null {
  if (text.length === 0) return null;
  return {
    breakMode: "normal",
    className: "frag frag--code",
    extraWidth: INLINE_CODE_EXTRA_WIDTH,
    font: INLINE_CODE_FONT,
    href: null,
    text,
  };
}

function createImagePiece(text: string): InlinePiece {
  return {
    breakMode: "never",
    className: "frag frag--chip",
    extraWidth: IMAGE_EXTRA_WIDTH,
    font: IMAGE_FONT,
    href: null,
    text: text.length > 0 ? text : "image",
  };
}

function canMergeInlinePieces(a: InlinePiece, b: InlinePiece): boolean {
  return (
    a.breakMode === b.breakMode &&
    a.className === b.className &&
    a.extraWidth === b.extraWidth &&
    a.font === b.font &&
    a.href === b.href
  );
}

// ---------------------------------------------------------------------------
// Font / class resolution
// ---------------------------------------------------------------------------

function resolveTextFont(variant: InlineVariant, marks: MarkState): string {
  const italicPrefix = marks.italic ? "italic " : "";

  switch (variant) {
    case "heading-1": {
      const weight = marks.bold ? 800 : 700;
      return `${italicPrefix}${weight} 18px ${HEADING_FAMILY}`;
    }
    case "heading-2": {
      const weight = marks.bold ? 800 : 700;
      return `${italicPrefix}${weight} 16px ${HEADING_FAMILY}`;
    }
    case "body": {
      const weight = marks.bold ? 700 : marks.href === null ? 400 : 500;
      return `${italicPrefix}${weight} 14px ${BODY_FAMILY}`;
    }
  }
}

function resolveTextClassName(
  variant: InlineVariant,
  marks: MarkState,
): string {
  let className = "frag";

  switch (variant) {
    case "heading-1":
      className += " frag--heading-1";
      break;
    case "heading-2":
      className += " frag--heading-2";
      break;
    case "body":
      className += " frag--body";
      break;
  }

  if (marks.href !== null) className += " is-link";
  if (marks.bold) className += " is-strong";
  if (marks.italic) className += " is-em";
  if (marks.strike) className += " is-del";
  return className;
}

function headingVariant(depth: number): InlineVariant {
  if (depth <= 1) return "heading-1";
  if (depth === 2) return "heading-2";
  return "body";
}

function lineHeightForVariant(variant: InlineVariant): number {
  switch (variant) {
    case "heading-1":
      return HEADING_ONE_LINE_HEIGHT;
    case "heading-2":
      return HEADING_TWO_LINE_HEIGHT;
    case "body":
      return BODY_LINE_HEIGHT;
  }
}

// ---------------------------------------------------------------------------
// Layout: template → frame (exact pixel positions)
// ---------------------------------------------------------------------------

function layoutTemplateFrame(
  template: PreparedChatTemplate,
  maxFrameWidth: number,
  maxContentWidth: number,
  contentInsetX: number,
): TemplateFrame {
  let y = BUBBLE_PADDING_Y;
  const blocks: BlockFrame[] = [];
  let usedContentWidth = 0;

  for (let i = 0; i < template.blocks.length; i++) {
    const block = template.blocks[i]!;
    y += block.marginTop;
    const blockFrame = layoutBlockFrame(block, maxContentWidth, y);
    blocks.push(blockFrame);
    y += blockFrame.height;
    usedContentWidth = Math.max(usedContentWidth, getUsedBlockWidth(blockFrame));
  }

  const bubbleHeight = y + BUBBLE_PADDING_Y;
  const frameWidth =
    template.role === "assistant"
      ? maxFrameWidth
      : Math.min(
          maxFrameWidth,
          contentInsetX * 2 + Math.max(1, usedContentWidth),
        );

  return {
    blocks,
    bubbleHeight,
    contentInsetX,
    frameWidth,
    layoutContentWidth: maxContentWidth,
    role: template.role,
    totalHeight: bubbleHeight,
  };
}

function layoutBlockFrame(
  block: PreparedBlock,
  contentWidth: number,
  top: number,
): BlockFrame {
  switch (block.kind) {
    case "inline": {
      const lineWidth = Math.max(1, contentWidth - block.contentLeft);
      const { lineCount, maxLineWidth } = measureRichInlineStats(
        block.flow,
        lineWidth,
      );
      return {
        contentLeft: block.contentLeft,
        height: lineCount * block.lineHeight,
        kind: "inline",
        lineHeight: block.lineHeight,
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        usedWidth: maxLineWidth,
      };
    }

    case "code": {
      const boxWidth = Math.max(1, contentWidth - block.contentLeft);
      const innerWidth = Math.max(1, boxWidth - CODE_BLOCK_PADDING_X * 2);
      const { lineCount, maxLineWidth } = measureLineStats(
        block.prepared,
        innerWidth,
      );
      return {
        contentLeft: block.contentLeft,
        height: lineCount * block.lineHeight + CODE_BLOCK_PADDING_Y * 2,
        kind: "code",
        lineHeight: block.lineHeight,
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        width: maxLineWidth + CODE_BLOCK_PADDING_X * 2,
      };
    }

    case "rule":
      return {
        contentLeft: block.contentLeft,
        height: block.height,
        kind: "rule",
        markerClassName: block.markerClassName,
        markerLeft: block.markerLeft,
        markerText: block.markerText,
        quoteRailLefts: block.quoteRailLefts,
        top,
        width: Math.max(1, contentWidth - block.contentLeft),
      };
  }
}

function getUsedBlockWidth(block: BlockFrame): number {
  switch (block.kind) {
    case "inline":
      return block.contentLeft + block.usedWidth;
    case "code":
    case "rule":
      return block.contentLeft + block.width;
  }
}

// ---------------------------------------------------------------------------
// Materialization: frame → renderable block layouts
// ---------------------------------------------------------------------------

function materializeBlockLayout(
  block: PreparedBlock,
  frame: BlockFrame,
  contentWidth: number,
): BlockLayout {
  switch (frame.kind) {
    case "inline": {
      if (block.kind !== "inline") throw new Error("Inline block/frame mismatch");
      const lineWidth = Math.max(1, contentWidth - frame.contentLeft);
      const lines: Array<{ fragments: InlineFragmentLayout[]; width: number }> =
        [];
      walkRichInlineLineRanges(block.flow, lineWidth, (range) => {
        const line = materializeRichInlineLineRange(block.flow, range);
        lines.push({
          fragments: line.fragments.map((f) => ({
            className: block.classNames[f.itemIndex]!,
            href: block.hrefs[f.itemIndex] ?? null,
            leadingGap: f.gapBefore,
            text: f.text,
          })),
          width: line.width,
        });
      });

      return {
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "inline",
        lineHeight: frame.lineHeight,
        lines,
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        top: frame.top,
        usedWidth: frame.usedWidth,
      };
    }

    case "code": {
      if (block.kind !== "code") throw new Error("Code block/frame mismatch");
      const boxWidth = Math.max(1, contentWidth - frame.contentLeft);
      const innerWidth = Math.max(1, boxWidth - CODE_BLOCK_PADDING_X * 2);
      const layout = layoutWithLines(
        block.prepared,
        innerWidth,
        frame.lineHeight,
      );
      return {
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "code",
        lines: layout.lines,
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        top: frame.top,
        usedWidth: frame.width,
        width: frame.width,
      };
    }

    case "rule": {
      if (block.kind !== "rule") throw new Error("Rule block/frame mismatch");
      return {
        contentLeft: frame.contentLeft,
        height: frame.height,
        kind: "rule",
        markerClassName: frame.markerClassName,
        markerLeft: frame.markerLeft,
        markerText: frame.markerText,
        quoteRailLefts: frame.quoteRailLefts,
        top: frame.top,
        width: frame.width,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function measureMarkerWidth(text: string): number {
  const cached = markerWidthCache.get(text);
  if (cached !== undefined) return cached;
  const width = measureNaturalWidth(prepareWithSegments(text, MARKER_FONT));
  markerWidthCache.set(text, width);
  return width;
}

function fallbackTextForToken(token: Token): string {
  if ("text" in token && typeof token.text === "string") return token.text;
  return token.raw ?? "";
}

function formatTable(token: Tokens.Table): string {
  const header = token.header
    .map((cell) => inlineTokensToPlainText(cell.tokens))
    .join(" | ");
  const divider = token.header.map(() => "---").join(" | ");
  const rows = token.rows.map((row) =>
    row.map((cell) => inlineTokensToPlainText(cell.tokens)).join(" | "),
  );
  return [header, divider, ...rows].join("\n");
}

function inlineTokensToPlainText(tokens: readonly Token[]): string {
  let text = "";
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    switch (token.type) {
      case "strong":
      case "em":
      case "del":
      case "link":
        text += inlineTokensToPlainText(token.tokens ?? []);
        break;
      case "codespan":
      case "escape":
      case "text":
      case "html":
        text += token.text;
        break;
      case "br":
        text += "\n";
        break;
      case "image":
        text += token.text;
        break;
      default:
        text += fallbackTextForToken(token);
    }
  }
  return text;
}

function stripTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}
