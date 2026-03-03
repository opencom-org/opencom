export type AppConfirmInput =
  | string
  | {
      title?: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
    };

export function appConfirm(input: AppConfirmInput): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  const options =
    typeof input === "string"
      ? {
          title: "Confirm Action",
          message: input,
          confirmText: "Confirm",
          cancelText: "Cancel",
          destructive: false,
        }
      : {
          title: input.title ?? "Confirm Action",
          message: input.message,
          confirmText: input.confirmText ?? "Confirm",
          cancelText: input.cancelText ?? "Cancel",
          destructive: input.destructive ?? false,
        };

  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4";

    const dialog = document.createElement("div");
    dialog.className = "w-full max-w-md rounded-lg bg-white p-6 shadow-xl";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", options.title);

    const title = document.createElement("h2");
    title.className = "mb-2 text-xl font-semibold";
    title.textContent = options.title;

    const message = document.createElement("p");
    message.className = "text-sm text-gray-600";
    message.textContent = options.message;

    const actions = document.createElement("div");
    actions.className = "mt-6 flex justify-end gap-3";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className =
      "inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50";
    cancelButton.textContent = options.cancelText;

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = options.destructive
      ? "inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      : "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90";
    confirmButton.textContent = options.confirmText;

    actions.append(cancelButton, confirmButton);
    dialog.append(title, message, actions);
    overlay.append(dialog);
    document.body.append(overlay);

    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", handleKeyDown);
      overlay.remove();
      resolve(value);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(false);
      } else if (event.key === "Enter") {
        event.preventDefault();
        settle(true);
      }
    };

    cancelButton.addEventListener("click", () => settle(false));
    confirmButton.addEventListener("click", () => settle(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        settle(false);
      }
    });
    document.addEventListener("keydown", handleKeyDown);

    cancelButton.focus();
  });
}
