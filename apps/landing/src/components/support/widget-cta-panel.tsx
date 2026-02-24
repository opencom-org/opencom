"use client";

import { useState } from "react";
import { Home, Loader2, MessageCirclePlus } from "lucide-react";
import { buttonVariants, cn } from "@opencom/ui";

type WidgetAction = "home" | "chat";

interface ActionResult {
  ok: boolean;
  message: string;
}

const POLL_INTERVAL_MS = 90;
const WAIT_TIMEOUT_MS = 2200;
const DEFAULT_STATUS_MESSAGE = "Use these actions to jump directly into support.";
const HOME_TAB_SELECTOR = "button[title='Home']";
const MESSAGES_TAB_SELECTOR = "button[title='Conversations'], button[title='Messages']";
const NEW_CHAT_BUTTON_SELECTOR = "button.opencom-new-conv, button[title='New conversation']";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getWidgetRoot(): ShadowRoot | null {
  const widgetHost = document.getElementById("opencom-widget");
  return widgetHost?.shadowRoot ?? null;
}

function getWidgetButton(selector: string): HTMLButtonElement | null {
  const root = getWidgetRoot();
  if (!root) return null;
  const element = root.querySelector(selector);
  return element instanceof HTMLButtonElement ? element : null;
}

async function waitForWidgetButton(
  selector: string,
  timeoutMs: number = WAIT_TIMEOUT_MS
): Promise<HTMLButtonElement | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const button = getWidgetButton(selector);
    if (button) return button;
    await delay(POLL_INTERVAL_MS);
  }

  return null;
}

async function ensureWidgetOpen(): Promise<boolean> {
  const root = getWidgetRoot();
  if (!root) return false;

  if (root.querySelector(".opencom-chat")) return true;

  const launcherButton = getWidgetButton("button.opencom-launcher");
  if (!launcherButton) return false;

  launcherButton.click();

  const widgetNavButton = await waitForWidgetButton(
    `${HOME_TAB_SELECTOR}, ${MESSAGES_TAB_SELECTOR}`,
    1800
  );

  return Boolean(widgetNavButton);
}

async function ensureWidgetTabbedShell(): Promise<boolean> {
  const opened = await ensureWidgetOpen();
  if (!opened) return false;

  const existingMessagesButton = getWidgetButton(MESSAGES_TAB_SELECTOR);
  if (existingMessagesButton) return true;

  const backButton = getWidgetButton("button.opencom-back");
  if (backButton) {
    backButton.click();
    const messagesAfterBack = await waitForWidgetButton(MESSAGES_TAB_SELECTOR, 1100);
    if (messagesAfterBack) return true;
  }

  const closeButton = getWidgetButton("button.opencom-close");
  if (closeButton) {
    closeButton.click();
    await delay(140);
  }

  const reopened = await ensureWidgetOpen();
  if (!reopened) return false;

  const messagesAfterReopen = await waitForWidgetButton(MESSAGES_TAB_SELECTOR, 1200);
  return Boolean(messagesAfterReopen);
}

async function openWidgetHome(): Promise<ActionResult> {
  if (!getWidgetRoot()) {
    return {
      ok: false,
      message:
        "Support widget is not ready yet. Try again in a second or click the launcher in the bottom-right corner.",
    };
  }

  const opened = await ensureWidgetTabbedShell();
  if (!opened) {
    return {
      ok: false,
      message:
        "Could not open the widget automatically. Click the launcher in the bottom-right corner.",
    };
  }

  const homeButton = await waitForWidgetButton(HOME_TAB_SELECTOR, 1000);
  if (homeButton) {
    homeButton.click();
    return { ok: true, message: "Widget opened on Home." };
  }

  const messagesButton = await waitForWidgetButton(MESSAGES_TAB_SELECTOR, 1000);
  if (messagesButton) {
    messagesButton.click();
    return {
      ok: true,
      message: "Widget opened. Home tab is hidden in this workspace, so we opened Messages.",
    };
  }

  return {
    ok: true,
    message: "Widget is open. Use the bottom navigation to switch tabs.",
  };
}

async function openNewChat(): Promise<ActionResult> {
  if (!getWidgetRoot()) {
    return {
      ok: false,
      message:
        "Support widget is not ready yet. Try again in a second or click the launcher in the bottom-right corner.",
    };
  }

  const opened = await ensureWidgetTabbedShell();
  if (!opened) {
    return {
      ok: false,
      message:
        "Could not open the widget automatically. Click the launcher in the bottom-right corner.",
    };
  }

  const messagesButton = await waitForWidgetButton(MESSAGES_TAB_SELECTOR, 1000);
  if (!messagesButton) {
    return {
      ok: false,
      message:
        "Widget opened, but we could not find the Messages tab. Use the bottom navigation to open it.",
    };
  }
  messagesButton.click();
  await delay(180);

  const newConversationButton = await waitForWidgetButton(NEW_CHAT_BUTTON_SELECTOR, 2200);

  if (newConversationButton) {
    newConversationButton.click();
    const backButton = await waitForWidgetButton(
      "button.opencom-back, button[data-testid='widget-back-button']",
      4200
    );
    if (backButton) {
      return { ok: true, message: "New chat opened in the widget." };
    }
    return {
      ok: false,
      message:
        "Messages opened, but a chat was not created yet. Wait a second and try the button again.",
    };
  }

  return {
    ok: false,
    message:
      "Widget opened, but we could not find the new chat button. Open Messages and click the plus icon.",
  };
}

export function WidgetCtaPanel() {
  const [activeAction, setActiveAction] = useState<WidgetAction | null>(null);
  const [status, setStatus] = useState<ActionResult>({
    ok: true,
    message: DEFAULT_STATUS_MESSAGE,
  });

  const runAction = async (action: WidgetAction) => {
    if (activeAction) return;

    setActiveAction(action);
    const result = action === "home" ? await openWidgetHome() : await openNewChat();
    setStatus(result);
    setActiveAction(null);
  };

  return (
    <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/85">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Fastest path to support is the widget in the bottom-right corner. Use the actions below to
        open it directly.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => runAction("home")}
          disabled={activeAction !== null}
          className={cn(buttonVariants({ size: "lg" }), "justify-start gap-2")}
        >
          {activeAction === "home" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Home className="h-4 w-4" />
          )}
          Open Widget Home
        </button>

        <button
          type="button"
          onClick={() => runAction("chat")}
          disabled={activeAction !== null}
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "justify-start gap-2")}
        >
          {activeAction === "chat" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCirclePlus className="h-4 w-4" />
          )}
          Start a New Chat
        </button>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "mt-4 text-sm",
          status.message === DEFAULT_STATUS_MESSAGE
            ? "text-muted-foreground"
            : status.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
        )}
      >
        {status.message}
      </p>
    </div>
  );
}
