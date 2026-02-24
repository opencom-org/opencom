"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Plus,
  Trash2,
  GripVertical,
  Smartphone,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";

interface CarouselScreen {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  buttons?: Array<{
    text: string;
    action: "url" | "dismiss" | "next" | "deeplink";
    url?: string;
    deepLink?: string;
  }>;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDeepLink(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\/.+/i.test(value);
}

function CarouselEditor() {
  const params = useParams();
  const carouselId = params.id as Id<"carousels">;
  const { activeWorkspace } = useAuth();

  const carousel = useQuery(api.carousels.get, { id: carouselId });
  const stats = useQuery(api.carousels.getStats, { id: carouselId });
  const eventNames = useQuery(
    api.events.getDistinctNames,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const updateCarousel = useMutation(api.carousels.update);
  const activateCarousel = useMutation(api.carousels.activate);
  const pauseCarousel = useMutation(api.carousels.pause);

  const [name, setName] = useState("");
  const [screens, setScreens] = useState<CarouselScreen[]>([]);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [audienceRules, setAudienceRules] = useState<AudienceRule | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (carousel) {
      setName(carousel.name);
      setScreens(carousel.screens as CarouselScreen[]);
      setAudienceRules((carousel.audienceRules ?? carousel.targeting) as AudienceRule | null);
      setValidationErrors([]);
      setFormError(null);
    }
  }, [carousel]);

  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    if (!name.trim()) {
      errors.push("Carousel name is required.");
    }
    if (!screens.length) {
      errors.push("Add at least one screen before saving.");
      return errors;
    }

    screens.forEach((screen, screenIndex) => {
      const title = screen.title?.trim();
      const body = screen.body?.trim();
      if (!title && !body) {
        errors.push(`Screen ${screenIndex + 1} must include a title or body.`);
      }

      (screen.buttons ?? []).forEach((button, buttonIndex) => {
        const text = button.text?.trim();
        if (!text) {
          errors.push(`Screen ${screenIndex + 1}, button ${buttonIndex + 1} needs button text.`);
        }
        if (button.action === "url") {
          const nextUrl = button.url?.trim();
          if (!nextUrl || !isValidHttpUrl(nextUrl)) {
            errors.push(
              `Screen ${screenIndex + 1}, button ${buttonIndex + 1} needs a valid http(s) URL.`
            );
          }
        }
        if (button.action === "deeplink") {
          const nextDeepLink = button.deepLink?.trim();
          if (!nextDeepLink || !isValidDeepLink(nextDeepLink)) {
            errors.push(
              `Screen ${screenIndex + 1}, button ${buttonIndex + 1} needs a valid deep link.`
            );
          }
        }
      });
    });

    return errors;
  };

  const handleSave = async () => {
    const errors = getValidationErrors();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setFormError("Fix validation errors before saving.");
      return;
    }

    setValidationErrors([]);
    setFormError(null);
    setIsSaving(true);
    try {
      await updateCarousel({
        id: carouselId,
        name: name.trim(),
        screens,
        targeting: audienceRules ?? undefined,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save carousel.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      if (carousel?.status === "active") {
        await pauseCarousel({ id: carouselId });
        return;
      }

      const errors = getValidationErrors();
      if (errors.length > 0) {
        setValidationErrors(errors);
        setFormError("Resolve validation errors before activating this carousel.");
        return;
      }

      await activateCarousel({ id: carouselId });
      setValidationErrors([]);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to update carousel status.");
    }
  };

  const addScreen = () => {
    const newScreen: CarouselScreen = {
      id: `screen-${Date.now()}`,
      title: "New Screen",
      body: "Screen content",
    };
    setScreens([...screens, newScreen]);
    setActiveScreenIndex(screens.length);
  };

  const removeScreen = (index: number) => {
    if (screens.length <= 1) return;
    const newScreens = screens.filter((_, i) => i !== index);
    setScreens(newScreens);
    if (activeScreenIndex >= newScreens.length) {
      setActiveScreenIndex(newScreens.length - 1);
    }
  };

  const updateScreen = (index: number, updates: Partial<CarouselScreen>) => {
    const newScreens = [...screens];
    newScreens[index] = { ...newScreens[index], ...updates };
    setScreens(newScreens);
  };

  const addButton = (screenIndex: number) => {
    const screen = screens[screenIndex];
    const buttons = screen.buttons || [];
    updateScreen(screenIndex, {
      buttons: [...buttons, { text: "Button", action: "next" }],
    });
  };

  const updateButton = (
    screenIndex: number,
    buttonIndex: number,
    updates: Partial<NonNullable<CarouselScreen["buttons"]>[number]>
  ) => {
    const screen = screens[screenIndex];
    const buttons = [...(screen.buttons || [])];
    buttons[buttonIndex] = { ...buttons[buttonIndex], ...updates };
    updateScreen(screenIndex, { buttons });
  };

  const removeButton = (screenIndex: number, buttonIndex: number) => {
    const screen = screens[screenIndex];
    const buttons = (screen.buttons || []).filter((_, i) => i !== buttonIndex);
    updateScreen(screenIndex, { buttons });
  };

  if (!carousel) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const activeScreen = screens[activeScreenIndex];

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <Input
              data-testid="carousel-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold border-none p-0 focus:ring-0"
              placeholder="Carousel name"
            />
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  carousel.status === "active"
                    ? "bg-green-100 text-green-800"
                    : carousel.status === "paused"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {carousel.status}
              </span>
              <span className="text-sm text-gray-500">{screens.length} screens</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="carousel-save-button"
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            data-testid="carousel-status-toggle"
            variant="outline"
            onClick={handleToggleStatus}
          >
            {carousel.status === "active" ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>

      {(formError || validationErrors.length > 0) && (
        <div className="border-b bg-red-50 px-6 py-3" data-testid="carousel-editor-errors">
          {formError && <p className="text-sm text-red-700 mb-1">{formError}</p>}
          {validationErrors.length > 0 && (
            <ul
              className="list-disc list-inside text-sm text-red-700 space-y-1"
              data-testid="carousel-validation-errors"
            >
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r bg-gray-50 p-4 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Screens</h3>
            <Button variant="ghost" size="sm" onClick={addScreen}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {screens.map((screen, index) => (
              <div
                key={screen.id}
                onClick={() => setActiveScreenIndex(index)}
                className={`p-3 rounded-lg cursor-pointer flex items-center gap-2 ${
                  index === activeScreenIndex
                    ? "bg-primary/10 border-primary/30 border"
                    : "bg-white border hover:bg-gray-100"
                }`}
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {screen.title || `Screen ${index + 1}`}
                  </div>
                </div>
                {screens.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScreen(index);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-auto">
          {activeScreen && (
            <div className="max-w-lg mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <Input
                  data-testid="carousel-screen-title-input"
                  value={activeScreen.title || ""}
                  onChange={(e) => updateScreen(activeScreenIndex, { title: e.target.value })}
                  placeholder="Screen title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <textarea
                  data-testid="carousel-screen-body-input"
                  value={activeScreen.body || ""}
                  onChange={(e) => updateScreen(activeScreenIndex, { body: e.target.value })}
                  placeholder="Screen content"
                  className="w-full h-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL (optional)
                </label>
                <Input
                  data-testid="carousel-screen-image-url-input"
                  value={activeScreen.imageUrl || ""}
                  onChange={(e) => updateScreen(activeScreenIndex, { imageUrl: e.target.value })}
                  placeholder="https://example.com/image.png"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Buttons</label>
                  <Button variant="ghost" size="sm" onClick={() => addButton(activeScreenIndex)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Button
                  </Button>
                </div>
                <div className="space-y-3">
                  {(activeScreen.buttons || []).map((button, buttonIndex) => (
                    <div key={buttonIndex} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          data-testid="carousel-button-text-input"
                          value={button.text}
                          onChange={(e) =>
                            updateButton(activeScreenIndex, buttonIndex, { text: e.target.value })
                          }
                          placeholder="Button text"
                          className="flex-1"
                        />
                        <button
                          onClick={() => removeButton(activeScreenIndex, buttonIndex)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <select
                        data-testid="carousel-button-action-select"
                        value={button.action}
                        onChange={(e) =>
                          updateButton(activeScreenIndex, buttonIndex, {
                            action: e.target.value as "url" | "dismiss" | "next" | "deeplink",
                          })
                        }
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="next">Go to next screen</option>
                        <option value="dismiss">Dismiss carousel</option>
                        <option value="url">Open URL</option>
                        <option value="deeplink">Deep link</option>
                      </select>
                      {button.action === "url" && (
                        <Input
                          data-testid="carousel-button-url-input"
                          value={button.url || ""}
                          onChange={(e) =>
                            updateButton(activeScreenIndex, buttonIndex, { url: e.target.value })
                          }
                          placeholder="https://example.com"
                        />
                      )}
                      {button.action === "deeplink" && (
                        <Input
                          data-testid="carousel-button-deeplink-input"
                          value={button.deepLink || ""}
                          onChange={(e) =>
                            updateButton(activeScreenIndex, buttonIndex, {
                              deepLink: e.target.value,
                            })
                          }
                          placeholder="myapp://screen/details"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-80 border-l bg-gray-100 p-6 overflow-auto">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Preview
          </h3>
          <div className="bg-gray-800 rounded-3xl p-4 shadow-xl">
            <div className="bg-white rounded-xl overflow-hidden">
              {activeScreen?.imageUrl && (
                <img
                  src={activeScreen.imageUrl}
                  alt="Screen"
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <h4 className="font-bold text-lg mb-2">{activeScreen?.title || "Title"}</h4>
                <p className="text-gray-600 text-sm mb-4">{activeScreen?.body || "Body text"}</p>
                <div className="space-y-2">
                  {(activeScreen?.buttons || []).map((button, i) => (
                    <button
                      key={i}
                      className="w-full py-2 px-4 bg-primary/50 text-white rounded-lg text-sm font-medium"
                    >
                      {button.text}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center gap-1 mt-4">
                  {screens.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i === activeScreenIndex ? "bg-primary/50" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg p-4">
            <h4 className="font-medium mb-3">Audience Targeting</h4>
            <AudienceRuleBuilder
              value={audienceRules}
              onChange={setAudienceRules}
              eventNames={eventNames ?? []}
              workspaceId={activeWorkspace?._id}
            />
          </div>

          {stats && (
            <div className="mt-6 bg-white rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Shown</span>
                  <span className="font-medium">{stats.shown}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed</span>
                  <span className="font-medium">{stats.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completion Rate</span>
                  <span className="font-medium">{stats.completionRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CarouselPage() {
  return (
    <AppLayout>
      <CarouselEditor />
    </AppLayout>
  );
}
