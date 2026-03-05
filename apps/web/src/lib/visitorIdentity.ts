import { formatReadableVisitorId } from "@opencom/types";

type VisitorIdentityInput = {
  visitorId?: string | null;
  readableId?: string | null;
  name?: string | null;
  email?: string | null;
};

type HumanIdVariant = "numbered" | "verb";

const HUMAN_ID_VERBS = [
  "accept",
  "act",
  "add",
  "admire",
  "agree",
  "allow",
  "appear",
  "argue",
  "arrive",
  "ask",
  "attack",
  "attend",
  "bake",
  "bathe",
  "battle",
  "beam",
  "beg",
  "begin",
  "behave",
  "bet",
  "boil",
  "bow",
  "brake",
  "brush",
  "build",
  "burn",
  "buy",
  "call",
  "camp",
  "care",
  "carry",
  "change",
  "cheat",
  "check",
  "cheer",
  "chew",
  "clap",
  "clean",
  "cough",
  "count",
  "cover",
  "crash",
  "create",
  "cross",
  "cry",
  "cut",
  "dance",
  "decide",
  "deny",
  "design",
  "dig",
  "divide",
  "do",
  "double",
  "doubt",
  "draw",
  "dream",
  "dress",
  "drive",
  "drop",
  "drum",
  "eat",
  "end",
  "enjoy",
  "enter",
  "exist",
  "fail",
  "fall",
  "feel",
  "fetch",
  "film",
  "find",
  "fix",
  "flash",
  "float",
  "flow",
  "fly",
  "fold",
  "follow",
  "fry",
  "give",
  "glow",
  "go",
  "grab",
  "greet",
  "grin",
  "grow",
  "guess",
  "hammer",
  "hang",
  "happen",
  "heal",
  "hear",
  "help",
  "hide",
  "hope",
  "hug",
  "hunt",
  "invent",
  "invite",
  "itch",
  "jam",
  "jog",
  "join",
  "joke",
  "judge",
  "juggle",
  "jump",
  "kick",
  "kiss",
  "kneel",
  "knock",
  "know",
  "laugh",
  "lay",
  "lead",
  "learn",
  "leave",
  "lick",
  "lie",
  "like",
  "listen",
  "live",
  "look",
  "lose",
  "love",
  "make",
  "march",
  "marry",
  "mate",
  "matter",
  "melt",
  "mix",
  "move",
  "nail",
  "notice",
  "obey",
  "occur",
  "open",
  "own",
  "pay",
  "peel",
  "pick",
  "play",
  "poke",
  "post",
  "press",
  "prove",
  "pull",
  "pump",
  "punch",
  "push",
  "raise",
  "read",
  "refuse",
  "relate",
  "relax",
  "remain",
  "repair",
  "repeat",
  "reply",
  "report",
  "rescue",
  "rest",
  "retire",
  "return",
  "rhyme",
  "ring",
  "roll",
  "rule",
  "run",
  "rush",
  "say",
  "scream",
  "search",
  "see",
  "sell",
  "send",
  "serve",
  "shake",
  "share",
  "shave",
  "shine",
  "shop",
  "shout",
  "show",
  "sin",
  "sing",
  "sink",
  "sip",
  "sit",
  "sleep",
  "slide",
  "smash",
  "smell",
  "smile",
  "smoke",
  "sneeze",
  "sniff",
  "sort",
  "speak",
  "spend",
  "stand",
  "stare",
  "start",
  "stay",
  "stick",
  "stop",
  "strive",
  "study",
  "swim",
  "switch",
  "take",
  "talk",
  "tan",
  "tap",
  "taste",
  "teach",
  "tease",
  "tell",
  "thank",
  "think",
  "throw",
  "tickle",
  "tie",
  "trade",
  "train",
  "travel",
  "try",
  "turn",
  "type",
  "unite",
  "vanish",
  "visit",
  "wait",
  "walk",
  "warn",
  "wash",
  "watch",
  "wave",
  "wear",
  "win",
  "wink",
  "wish",
  "wonder",
  "work",
  "worry",
  "write",
  "yawn",
  "yell",
] as const;

function normalizeIdentityField(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickWord(words: readonly string[], hash: number, salt: number): string {
  const mixed = Math.imul(hash ^ salt, 2246822519) >>> 0;
  return words[mixed % words.length] ?? words[0] ?? "visitor";
}

export function formatHumanVisitorId(
  visitorId: string,
  variant: HumanIdVariant = "numbered"
): string {
  if (variant === "numbered") {
    return formatReadableVisitorId(visitorId);
  }

  const numbered = formatReadableVisitorId(visitorId);
  const [adjective = "visitor", noun = "guest"] = numbered.split("-");
  const hash = hashString(visitorId);
  const verb = pickWord(HUMAN_ID_VERBS, hash, 0xc2b2ae35);
  return `${adjective}-${noun}-${verb}`;
}

export function formatVisitorIdentityLabel(input: VisitorIdentityInput): string {
  const name = normalizeIdentityField(input.name);
  if (name) {
    return name;
  }

  const email = normalizeIdentityField(input.email);
  if (email) {
    return email;
  }

  const readableId = normalizeIdentityField(input.readableId);
  if (readableId) {
    return readableId;
  }

  const visitorId = normalizeIdentityField(input.visitorId);
  if (visitorId) {
    return formatHumanVisitorId(visitorId);
  }

  return "Unknown visitor";
}

export function formatVisitorEmailLabel(
  input: Pick<VisitorIdentityInput, "email" | "readableId" | "visitorId">
): string {
  const email = normalizeIdentityField(input.email);
  if (email) {
    return email;
  }

  const readableId = normalizeIdentityField(input.readableId);
  if (readableId) {
    return readableId;
  }

  const visitorId = normalizeIdentityField(input.visitorId);
  if (visitorId) {
    return formatHumanVisitorId(visitorId);
  }

  return "Unknown email";
}
