import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://opencom.dev";
const RAW_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_OPENCOM_SITE_URL ??
  DEFAULT_SITE_URL;
const SITE_URL = RAW_SITE_URL.endsWith("/") ? RAW_SITE_URL.slice(0, -1) : RAW_SITE_URL;

const metadataBase = (() => {
  try {
    return new URL(SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
})();

const DEFAULT_SOCIAL_IMAGE = {
  url: "/social/opencom-social-card.png",
  width: 1200,
  height: 630,
  alt: "Opencom dashboard and inbox preview",
} as const;

const DEFAULT_TITLE = "Opencom - Open Source Customer Messaging";
const DEFAULT_DESCRIPTION =
  "The open-source Intercom alternative. Self-hosted customer messaging with live chat, product tours, tickets, surveys, campaigns, knowledge base, AI agent, and native SDKs.";

type SocialImageInput = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: SocialImageInput;
};

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  const cleaned = path.replace(/^\/+|\/+$/g, "");
  return `/${cleaned}`;
}

function resolveSocialImage(image?: SocialImageInput) {
  const selected = image ?? DEFAULT_SOCIAL_IMAGE;
  return {
    openGraph: {
      url: selected.url,
      width: selected.width ?? DEFAULT_SOCIAL_IMAGE.width,
      height: selected.height ?? DEFAULT_SOCIAL_IMAGE.height,
      alt: selected.alt ?? DEFAULT_SOCIAL_IMAGE.alt,
    },
    twitter: selected.url,
  };
}

export const landingRootMetadata: Metadata = {
  metadataBase,
  applicationName: "Opencom",
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "open source",
    "intercom alternative",
    "customer messaging",
    "chat widget",
    "self-hosted",
    "product tours",
    "knowledge base",
    "support tickets",
    "surveys",
    "campaigns",
    "ai agent",
    "customer support",
  ],
  authors: [{ name: "Opencom Team" }],
  creator: "Opencom Team",
  publisher: "Opencom",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: "Opencom",
    locale: "en_US",
    type: "website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE.url],
  },
};

export function createLandingPageMetadata({
  title,
  description,
  path,
  image,
}: PageMetadataInput): Metadata {
  const canonicalPath = normalizePath(path);
  const socialImage = resolveSocialImage(image);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: "Opencom",
      locale: "en_US",
      type: "website",
      images: [socialImage.openGraph],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage.twitter],
    },
  };
}
