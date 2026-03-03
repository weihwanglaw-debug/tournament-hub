import config from "@/data/config.json";
import { Facebook, Instagram, Linkedin, Twitter, Mail } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Facebook,
  Instagram,
  LinkedIn: Linkedin,
  X: Twitter,
  Twitter,
};

export default function Footer() {
  return (
    <footer
      className="py-10 px-6"
      style={{ background: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Social icons */}
        <div className="flex items-center gap-4">
          {config.footer.socialLinks.map((link) => {
            const Icon = iconMap[link.platform] || Mail;
            return (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label={link.platform}
              >
                <Icon className="h-5 w-5" />
              </a>
            );
          })}
        </div>

        {/* Contact */}
        <a
          href={`mailto:${config.footer.contactEmail}`}
          className="text-sm hover:underline opacity-80"
        >
          {config.footer.contactEmail}
        </a>

        {/* Extra links */}
        {config.footer.extraLinks && config.footer.extraLinks.length > 0 && (
          <div className="flex items-center gap-4">
            {config.footer.extraLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm hover:underline opacity-80"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-white/20 text-center text-xs opacity-60">
        {config.footer.copyrightText}
      </div>
    </footer>
  );
}
