import Link from "next/link";
import { Github, MessageCircle } from "lucide-react";
import {
  OPENCOM_GITHUB_DOCS_URL,
  OPENCOM_GITHUB_REPO_URL,
  OPENCOM_HOSTED_ONBOARDING_URL,
} from "@/lib/links";

const footerLinks = {
  product: [
    { name: "Features", href: "/features" },
    { name: "Support", href: "/support" },
    { name: "Roadmap", href: "/roadmap" },
    {
      name: "Start Hosted Onboarding",
      href: OPENCOM_HOSTED_ONBOARDING_URL,
      external: true,
    },
  ],
  developers: [
    { name: "GitHub Docs", href: OPENCOM_GITHUB_DOCS_URL, external: true },
    { name: "Contributing", href: "/contributing" },
    { name: "GitHub Repo", href: OPENCOM_GITHUB_REPO_URL, external: true },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    {
      name: "GNU AGPLv3 License",
      href: "https://github.com/opencom-org/opencom/blob/main/LICENSE",
      external: true,
    },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Opencom</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Fully open source, AGPLv3 licensed, and currently free to use. Try hosted onboarding
              or dive into the GitHub docs.
            </p>
            <div className="mt-4 flex gap-4">
              <a
                href={OPENCOM_GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Developers</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.developers.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Opencom. Open source under the GNU AGPLv3.
          </p>
        </div>
      </div>
    </footer>
  );
}
