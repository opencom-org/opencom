"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Github, MessageCircle } from "lucide-react";
import { Button } from "@opencom/ui";
import {
  OPENCOM_GITHUB_DOCS_URL,
  OPENCOM_GITHUB_REPO_URL,
  OPENCOM_HOSTED_ONBOARDING_URL,
} from "@/lib/links";

const navigation = [
  { name: "Features", href: "/features" },
  { name: "Docs", href: "/docs" },
  { name: "Support", href: "/support" },
  { name: "Roadmap", href: "/roadmap" },
  { name: "Contributing", href: "/contributing" },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
              <MessageCircle className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Opencom</span>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Alpha
              </span>
            </Link>
          </div>

          <div className="flex lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-muted-foreground"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open main menu</span>
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <div className="hidden lg:flex lg:gap-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                data-tour-target={`nav-${item.name.toLowerCase()}`}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-4">
            <Button variant="ghost" size="sm">
              <a
                href={OPENCOM_GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-tour-target="nav-github"
                className="flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </Button>
            <Button size="sm">
              <a href={OPENCOM_HOSTED_ONBOARDING_URL}>Start Hosted Onboarding</a>
            </Button>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-background px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-border">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="-m-1.5 p-1.5 flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <MessageCircle className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">Opencom</span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-muted-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-border">
                <div className="space-y-2 py-6">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold text-foreground hover:bg-muted"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
                <div className="py-6 space-y-4">
                  <a
                    href={OPENCOM_GITHUB_DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mx-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold text-foreground hover:bg-muted"
                  >
                    <Github className="h-5 w-5" />
                    GitHub Docs
                  </a>
                  <a
                    href={OPENCOM_GITHUB_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mx-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold text-foreground hover:bg-muted"
                  >
                    <Github className="h-5 w-5" />
                    GitHub Repo
                  </a>
                  <Button className="w-full">
                    <a href={OPENCOM_HOSTED_ONBOARDING_URL}>Start Hosted Onboarding</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
