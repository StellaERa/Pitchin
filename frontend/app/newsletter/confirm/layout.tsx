import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Newsletter Confirmed",
  description:
    "Your Pitchin newsletter subscription has been confirmed. Stay updated with the latest news.",
  noindex: true,
});

export default function NewsletterConfirmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
