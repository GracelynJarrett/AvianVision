"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation links shown in the header on every page
const navLinks = [
    { href: "/", label: "Home" },
    { href: "/predict", label: "Prediction" },
    { href: "/species", label: "Species" },
    { href: "/bird", label: "Bird" },
    { href: "/stats", label: "Stats" },
];

// Maps each route to the page title shown in the center of the header
const pageTitles: { [key: string]: string } = {
    "/": "Home",
    "/predict": "Prediction",
    "/species": "Species",
    "/bird": "Bird",
    "/stats": "Statistics",
};

export default function Header() {

    const pathname = usePathname();
    const pageTitle = pageTitles[pathname] || "AvianVision";

    return (
        // Single horizontal bar: logo left | page title center | nav right
        <header className="py-3 font-serif bg-[#3F4850] text-[#FFFFFF] border-b border-[#3F4850]/20">
            <div className="relative flex items-center justify-between px-6">

                {/* Logo and brand name — left side */}
                <div className="flex items-center gap-8">
                    <svg viewBox="0 6 60 68" width="34" height="43" aria-hidden="true">
                        {/* Yellow crest + head */}
                        <path d="M30,10 C27,18 17,30 15,38 C14,47 11,56 11,60 Q11,69 30,70 Q49,69 49,60 C49,56 46,47 45,38 C43,30 33,18 30,10 Z" fill="#FFE500" />
                        {/* Eyes */}
                        <circle cx="20" cy="44" r="4" fill="#111" />
                        <circle cx="40" cy="44" r="4" fill="#111" />
                        {/* Cheek patches */}
                        <ellipse cx="15" cy="55" rx="8" ry="6" fill="#D4591E" />
                        <ellipse cx="45" cy="55" rx="8" ry="6" fill="#D4591E" />
                        {/* Beak */}
                        <polygon points="30,46 24,54 30,62 36,54" fill="#FFF8F0" />
                        {/* Neck stub */}
                        <rect x="22" y="69" width="16" height="5" rx="2.5" fill="#C0BFBF" />
                    </svg>
                    <span className="text-2xl font-bold font-serif tracking-tight">AvianVision</span>
                </div>

                {/* Current page title — pinned to the center of the full header width */}
                <div className="left-1/2 -translate-x-1/2 font-serif text-2xl font-semibold pointer-events-none">
                    {pageTitle}
                </div>

                {/* Navigation links — right side */}
                <nav className="flex gap-5" aria-label="Main navigation">
                    {navLinks.map(({ href, label }) => {
                        // Highlight the button for whichever page the user is currently on
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`px-4 py-2 rounded text-lg font-medium transition-colors duration-200 ${isActive
                                    ? "bg-[#333333] text-white"
                                    : "bg-white text-[#3F4850] hover:bg-[#3F4850] hover:text-white"
                                    }`}
                                aria-current={isActive ? "page" : undefined}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </nav>

            </div>
        </header>
    );
}
