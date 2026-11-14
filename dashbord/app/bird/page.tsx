"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TableauEmbed from "@/conmponents/TableauEmbed";

// The bird that is shown when the page first loads
const DEFAULT_BIRD = "EUROPEAN TURTLE DOVE";

// Converts an all-caps bird name like "EUROPEAN TURTLE DOVE" to "European Turtle Dove"
function toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Maps IUCN conservation status codes to badge colors — severity runs dark → light
function getStatusColor(status: string): string {
    switch (status?.toUpperCase()) {
        case "CRITICALLY ENDANGERED": return "bg-[#333333] text-white";
        case "ENDANGERED":            return "bg-[#FF8A2A] text-white";
        case "VULNERABLE":            return "bg-[#ffbc88] text-[#333333]";
        case "NEAR THREATENED":       return "bg-[#fff99d] text-[#333333]";
        case "LEAST CONCERN":         return "bg-[#fffdde] text-[#333333]";
        default:                      return "bg-[#C9C9C9] text-[#333333]";
    }
}

// Module-level cache for Wikipedia prey images — shared across all PreyPill instances
const preyImageCache = new Map<string, string | null>();

// Strips NaN, null, empty strings, and garbage values from a prey list
function cleanPreyList(list: any[]): string[] {
    return (list ?? [])
        .map((item: any) => String(item ?? "").trim())
        .filter(str => {
            if (str === "") return false;
            const lower = str.toLowerCase();
            return lower !== "nan" && lower !== "null" && lower !== "undefined";
        });
}

// A single prey pill — hovering fetches a Wikipedia thumbnail and shows it in a card above the pill
function PreyPill({ name, filled = false }: { name: string; filled?: boolean }) {
    const [showCard,   setShowCard]   = useState(false);
    const [imgSrc,     setImgSrc]     = useState<string | null | undefined>(undefined);
    const [imgLoading, setImgLoading] = useState(false);

    // Fetch a thumbnail from Wikipedia's public summary API; results are cached so the same prey only fetches once
    function loadImage() {
        if (preyImageCache.has(name)) { setImgSrc(preyImageCache.get(name)); return; }
        setImgLoading(true);
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`)
            .then(res => res.json())
            .then(data => {
                const url: string | null = data.thumbnail?.source ?? null;
                preyImageCache.set(name, url);
                setImgSrc(url);
                setImgLoading(false);
            })
            .catch(() => { preyImageCache.set(name, null); setImgSrc(null); setImgLoading(false); });
    }

    function handleMouseEnter() { setShowCard(true); loadImage(); }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setShowCard(false)}
            onClick={() => { setShowCard(v => !v); loadImage(); }}
        >
            {/* The pill — filled orange for prey types, outlined for specific prey names */}
            <span className={`cursor-pointer rounded-full px-3 py-1 text-sm select-none transition-opacity hover:opacity-80 ${
                filled
                    ? "bg-[#ffbc88] font-medium text-[#232629]"
                    : "bg-white border border-[#ffbc88] text-[#232629]"
            }`}>
                {name}
            </span>

            {/* Hover card — appears above the pill with the Wikipedia thumbnail */}
            {showCard && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-20 w-40 rounded-lg border border-[#e3e6e8] bg-white shadow-lg p-3">
                    {imgLoading ? (
                        <p className="text-sm text-center text-[#9199a1] py-4">Loading...</p>
                    ) : imgSrc ? (
                        <img src={imgSrc} alt={name} className="w-full rounded-md object-cover max-h-28" />
                    ) : (
                        <p className="text-sm text-center text-[#9199a1] py-4">No image available</p>
                    )}
                    <p className="mt-2 text-sm text-center font-medium text-[#232629]">{name}</p>
                </div>
            )}
        </div>
    );
}

// A single row in the Wikipedia accordion — clicking opens or closes the section text
function WikiAccordionItem({ title, content }: { title: string; content: string }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            {/* Clickable header — chevron rotates when open */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex justify-between items-center px-5 py-3.5 bg-[#f8f9f9] hover:bg-[#f1f2f3] transition-colors text-left border-b border-[#e3e6e8]"
                aria-expanded={isOpen}
            >
                <span className="font-semibold text-base text-[#232629]">{title}</span>
                <span className={`text-[#9199a1] text-lg transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>›</span>
            </button>
            {/* Section text — only rendered when open; truncated to 500 words */}
            {isOpen && (
                <div className="px-5 py-4 bg-white text-base text-[#6a737c] leading-relaxed whitespace-pre-line border-b border-[#e3e6e8]">
                    {(() => {
                        const words = content.split(/\s+/);
                        return words.length > 500 ? words.slice(0, 500).join(" ") + "…" : content;
                    })()}
                </div>
            )}
        </div>
    );
}

// Short educational description for each taxonomic rank
const RANK_DESCRIPTIONS: Record<string, string> = {
    Class:   "Class is one of the broadest groupings in animal classification. All birds belong to class Aves — they share key traits like feathers, beaks, warm blood, and hard-shelled eggs.",
    Order:   "Order groups families that share a common ancestor. Birds in the same order are more closely related to each other than to birds in different orders.",
    Family:  "Family groups genera that look and behave similarly. Birds in the same family often share physical features, nesting habits, or diet — even if they vary in size and color.",
    Genus:   "Genus groups species that are very closely related — often similar in appearance and behavior. The genus name is the first word in a bird's two-part scientific name.",
    Species: "Species is the most specific classification level. Birds of the same species can reproduce with each other. Each species has a unique two-part scientific name made up of the genus and species identifier.",
};

// Taxonomy section — a horizontal chain of clickable boxes; clicking one opens a detail panel
function TaxonomySection({ birdData }: { birdData: any }) {
    // Tracks which rank box is currently open — null means all closed
    const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

    // Build the ordered list of taxonomy levels using the bird's actual data
    const levels = [
        { label: "Class",   value: birdData.taxonomy?.class },
        { label: "Order",   value: birdData.taxonomy?.order },
        { label: "Family",  value: birdData.taxonomy?.family },
        { label: "Genus",   value: birdData.taxonomy?.genus },
        { label: "Species", value: birdData.scientific_name },
    ].filter(level => level.value); // skip any levels the API didn't return

    function handleBoxClick(label: string) {
        // Toggle — clicking the open box closes it
        setExpandedLevel(prev => (prev === label ? null : label));
    }

    const expanded = levels.find(l => l.label === expandedLevel) ?? null;

    return (
        <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                <span className="font-semibold text-base text-[#232629]">Classification</span>
                <span className="ml-2 text-base text-[#9199a1]">Click any level to learn more.</span>
            </div>
            <div className="p-5">
                {/* Horizontal chain of clickable taxonomy boxes with connecting arrows */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {levels.map((level, index) => {
                        const isOpen = expandedLevel === level.label;
                        return (
                            <div key={level.label} className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handleBoxClick(level.label)}
                                    className={`flex flex-col items-center rounded-lg px-4 py-2.5 min-w-[90px] border-2 transition-colors cursor-pointer ${
                                        isOpen
                                            ? "bg-[#fdf2d8] border-[#ffbc88]"
                                            : "bg-[#f8f9f9] border-[#e3e6e8] hover:border-[#babfc4]"
                                    }`}
                                    aria-expanded={isOpen}
                                >
                                    <span className="text-sm font-semibold uppercase tracking-widest text-[#9199a1] mb-0.5">{level.label}</span>
                                    <span className={`text-base font-medium text-[#232629] text-center ${level.label === "Species" ? "italic" : ""}`}>{level.value}</span>
                                </button>
                                {index < levels.length - 1 && (
                                    <span className="text-[#9199a1] select-none">›</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Detail panel — appears below the chain when a box is selected */}
                {expanded && (
                    <div className="mt-4 bg-[#f8f9f9] border border-[#e3e6e8] rounded-lg px-5 py-4">
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-sm font-semibold uppercase tracking-widest text-[#9199a1]">{expanded.label}</span>
                            <span className={`text-lg font-bold text-[#232629] ${expanded.label === "Species" ? "italic" : ""}`}>{expanded.value}</span>
                        </div>
                        <p className="text-base text-[#6a737c] leading-relaxed">{RANK_DESCRIPTIONS[expanded.label]}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function BirdPageInner() {
    // Read the ?species= URL param so links from elsewhere open the right bird directly
    const searchParams = useSearchParams();
    const urlSpecies   = searchParams.get("species")?.toUpperCase().trim() ?? DEFAULT_BIRD;

    const [birdNames,       setBirdNames]       = useState<string[]>([]);
    const [searchQuery,     setSearchQuery]     = useState(urlSpecies);
    const [selectedBird,    setSelectedBird]    = useState(urlSpecies);
    const [birdData,        setBirdData]        = useState<any>(null);
    const [birdDataLoading, setBirdDataLoading] = useState(true);
    const [birdImage,       setBirdImage]       = useState<string | null>(null);
    const [plumageImages,   setPlumageImages]   = useState<string[]>([]);
    const [plumageLoading,  setPlumageLoading]  = useState(false);

    // Which page of prey items to show (10 at a time); resets when bird changes
    const [preyPage, setPreyPage] = useState(0);

    // In-memory caches — switching back to a previously viewed bird is instant
    const birdDataCache  = useRef<Map<string, any>>(new Map());
    const birdImageCache = useRef<Map<string, string>>(new Map());

    // Load the full list of 525 bird species names from the CSV when the page first opens
    useEffect(() => {
        fetch("/bird_name_mapping.csv")
            .then(response => response.text())
            .then(data => {
                const names = data
                    .split("\n").slice(1)
                    .map(row => row.split(",")[0].trim())
                    .filter(name => name.length > 0);
                setBirdNames(names);
            })
            .catch(error => console.error("Error loading bird names:", error));
    }, []);

    // Fetch the bird's enrichment data — checks the cache first so repeat visits are instant
    useEffect(() => {
        if (birdDataCache.current.has(selectedBird)) {
            setBirdData(birdDataCache.current.get(selectedBird));
            setBirdDataLoading(false);
            return;
        }
        setBirdDataLoading(true);
        setBirdData(null);
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(selectedBird)}`)
            .then(response => {
                if (!response.ok) throw new Error("Failed to fetch bird information");
                return response.json();
            })
            .then(data => {
                birdDataCache.current.set(selectedBird, data.bird);
                setBirdData(data.bird);
                setBirdDataLoading(false);
            })
            .catch(error => {
                console.error("Error loading bird information:", error);
                setBirdDataLoading(false);
            });
    }, [selectedBird]);

    // Fetch the bird's dataset image — checks the cache first so repeat visits are instant
    useEffect(() => {
        if (birdImageCache.current.has(selectedBird)) {
            setBirdImage(birdImageCache.current.get(selectedBird)!);
            return;
        }
        setBirdImage(null);
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(selectedBird)}/image`)
            .then(response => {
                if (!response.ok) throw new Error("Failed to fetch bird image");
                return response.blob();
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                birdImageCache.current.set(selectedBird, url);
                setBirdImage(url);
            })
            .catch(error => console.error("Error loading bird image:", error));
    }, [selectedBird]);

    // Fetch Wikimedia plumage images whenever the selected bird changes
    useEffect(() => {
        if (!selectedBird) return;
        setPlumageLoading(true);
        setPlumageImages([]);
        fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(selectedBird)}/plumage`)
            .then(r => r.json())
            .then(data => setPlumageImages(data.images ?? []))
            .catch(() => setPlumageImages([]))
            .finally(() => setPlumageLoading(false));
    }, [selectedBird]);

    // Updates the search input and loads the bird if the typed value matches a name in the list
    function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value.toUpperCase();
        setSearchQuery(value);
        if (birdNames.includes(value)) { setSelectedBird(value); setPreyPage(0); }
    }

    // Picks a random bird from the full 525-species list
    function handleRandom() {
        if (birdNames.length === 0) return;
        const randomName = birdNames[Math.floor(Math.random() * birdNames.length)];
        setSearchQuery(randomName);
        setSelectedBird(randomName);
        setPreyPage(0);
    }

    return (
        <main className="flex-1 min-w-0 bg-[#f8f9f9] p-6 flex flex-col gap-5">

            {/* ── Search card ──────────────────────────────────────────────────── */}
            <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 shadow-sm" style={{ borderTop: "3px solid #ffbc88" }}>
                <h1 className="text-xl font-bold text-[#232629] mb-1">Bird Explorer</h1>
                <p className="text-base text-[#6a737c] mb-4">Search any of the 525 species in the AvianVision dataset.</p>
                <div className="flex gap-3 max-w-xl">
                    <input
                        id="bird-search"
                        type="text"
                        list="bird-name-list"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Type a bird name..."
                        className="flex-1 rounded-lg border border-[#babfc4] bg-white px-4 py-2.5 text-base text-[#232629] placeholder:text-[#9199a1] focus:outline-none focus:ring-2 focus:ring-[#ffbc88]"
                    />
                    {/* datalist feeds the browser's native dropdown suggestions */}
                    <datalist id="bird-name-list">
                        {birdNames.map(name => <option key={name} value={name} />)}
                    </datalist>
                    <button
                        onClick={handleRandom}
                        disabled={birdNames.length === 0}
                        className="rounded-lg border border-[#d6d9dc] bg-white px-5 py-2.5 text-base font-semibold text-[#232629] hover:bg-[#f1f2f3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        Random Bird
                    </button>
                </div>
            </div>

            {/* ── Bird image + key info ─────────────────────────────────────────── */}
            <div className="bg-white border border-[#e3e6e8] rounded-lg p-5 flex flex-wrap gap-6 items-start shadow-sm">

                {/* Dataset image with loading placeholder */}
                <div className="w-[220px] h-[180px] flex-none rounded-lg overflow-hidden bg-[#f1f2f3] border border-[#e3e6e8]">
                    {birdImage ? (
                        <img src={birdImage} alt={selectedBird} className="w-full h-full object-contain" />
                    ) : (
                        <div className="w-full h-full bg-[#e3e6e8] animate-pulse" />
                    )}
                </div>

                {/* Bird name, scientific name, conservation status and trend */}
                <div className="flex-1 min-w-[200px] flex flex-col gap-3">
                    {birdDataLoading ? (
                        <div className="flex flex-col gap-2">
                            <div className="h-5 w-48 bg-[#e3e6e8] rounded animate-pulse" />
                            <div className="h-4 w-32 bg-[#e3e6e8] rounded animate-pulse" />
                        </div>
                    ) : birdData ? (
                        <>
                            <div>
                                <h2 className="text-2xl font-bold text-[#232629] leading-tight">{toTitleCase(birdData.species_label)}</h2>
                                <p className="italic text-base text-[#9199a1] mt-0.5">{birdData.scientific_name}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-1.5">Conservation Status</p>
                                <span className={`inline-block rounded-full px-3 py-0.5 text-base font-semibold ${getStatusColor(birdData.conservation?.status_label)}`}>
                                    {birdData.conservation?.status_label ?? "Unknown"}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-1">
                                {birdData.conservation?.population_trend && (
                                    <div className="bg-[#f8f9f9] rounded-lg px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-1">Population Trend</p>
                                        <p className="text-base font-semibold text-[#232629]">{birdData.conservation.population_trend}</p>
                                    </div>
                                )}
                                {birdData.conservation?.movement_patterns && (
                                    <div className="bg-[#f8f9f9] rounded-lg px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-1">Movement</p>
                                        <p className="text-base font-semibold text-[#232629]">{birdData.conservation.movement_patterns}</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-base text-[#9199a1]">No information available for this species.</p>
                    )}
                </div>
            </div>

            {/* ── Taxonomy ─────────────────────────────────────────────────────── */}
            {birdData && <TaxonomySection birdData={birdData} />}

            {/* ── Diet ─────────────────────────────────────────────────────────── */}
            {birdData && (() => {
                const preyNames = cleanPreyList(birdData.diet?.prey_common_names);
                const preyTypes = cleanPreyList(birdData.diet?.prey_classes);
                const hasData   = preyNames.length > 0 || preyTypes.length > 0;
                return (
                    <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                            <span className="font-semibold text-base text-[#232629]">Diet</span>
                            {hasData && (
                                <span className="ml-2 text-sm text-[#9199a1]">Hover or click any pill to see an image.</span>
                            )}
                        </div>
                        <div className="p-5">
                            {hasData ? (
                                <div className="flex flex-col gap-5">
                                    {preyNames.length > 0 && (
                                        <div>
                                            <p className="text-sm font-semibold uppercase tracking-widest text-[#9199a1] mb-2.5">Prey</p>
                                            <div className="flex flex-wrap gap-2">
                                                {preyNames.slice(preyPage * 10, (preyPage + 1) * 10).map(prey => <PreyPill key={prey} name={prey} />)}
                                            </div>
                                            {preyNames.length > 10 && (
                                                <div className="flex items-center gap-3 mt-3">
                                                    <button
                                                        onClick={() => setPreyPage(p => Math.max(0, p - 1))}
                                                        disabled={preyPage === 0}
                                                        className="px-3 py-1 text-base rounded border border-[#d6d9dc] bg-white text-[#232629] hover:bg-[#f1f2f3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                    >‹ Prev</button>
                                                    <span className="text-base text-[#9199a1]">{preyPage + 1} / {Math.ceil(preyNames.length / 10)}</span>
                                                    <button
                                                        onClick={() => setPreyPage(p => Math.min(Math.ceil(preyNames.length / 10) - 1, p + 1))}
                                                        disabled={(preyPage + 1) * 10 >= preyNames.length}
                                                        className="px-3 py-1 text-base rounded border border-[#d6d9dc] bg-white text-[#232629] hover:bg-[#f1f2f3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                    >Next ›</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {preyTypes.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-2.5">Prey Type</p>
                                            <div className="flex flex-wrap gap-2">{preyTypes.map(cls => <PreyPill key={cls} name={cls} filled />)}</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-base text-[#9199a1] italic">No diet data available for this species.</p>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── About this species (Wikipedia) ───────────────────────────────── */}
            {birdData?.wikipedia && (
                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                        <span className="font-semibold text-base text-[#232629]">About this Species</span>
                        <span className="ml-2 text-sm text-[#9199a1]">Wikipedia</span>
                    </div>
                    <div className="p-5 flex flex-col gap-5">
                        {/* Plumage photo gallery — best 2 images side by side */}
                        {(plumageLoading || plumageImages.length > 0) && (
                            <div className="max-w-xs">
                                {plumageLoading ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="h-28 bg-[#e3e6e8] animate-pulse rounded-lg" />
                                        <div className="h-28 bg-[#e3e6e8] animate-pulse rounded-lg" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {plumageImages.slice(0, 2).map((url, i) => (
                                            <img key={i} src={url} alt={`${toTitleCase(selectedBird)} photo ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Wikipedia extract — truncated to 500 words */}
                        {birdData.wikipedia.extract && (
                            <p className="text-base text-[#6a737c] leading-relaxed">
                                {(() => {
                                    const words = birdData.wikipedia.extract.split(/\s+/);
                                    return words.length > 500
                                        ? words.slice(0, 500).join(" ") + "…"
                                        : birdData.wikipedia.extract;
                                })()}
                            </p>
                        )}

                        {/* Expandable Wikipedia sections */}
                        {Object.entries(birdData.wikipedia.sections ?? {}).length > 0 && (
                            <div className="border border-[#e3e6e8] rounded-lg overflow-hidden">
                                {Object.entries(birdData.wikipedia.sections).map(([title, content]) => (
                                    <WikiAccordionItem key={title} title={title} content={content as string} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Migration & Sightings ─────────────────────────────────────────── */}
            {birdData?.migration && (
                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                        <span className="font-semibold text-base text-[#232629]">Migration &amp; Sightings</span>
                    </div>
                    <div className="p-5 flex flex-col gap-5">

                        {/* Top countries + Individual Bird Occurrence side by side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                            {/* Top countries ranked by sighting count */}
                            {birdData.migration.top_countries?.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9199a1] mb-3">
                                        Top Countries — {(birdData.migration.total_sightings ?? 0).toLocaleString()} total sightings
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        {(() => {
                                            const countries = birdData.migration.top_countries.slice(0, 5);
                                            const maxCount  = Math.max(...countries.map((c: any) => c.count ?? 0));
                                            const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
                                            return countries.map((c: any) => {
                                                let countryName = c.country;
                                                try { countryName = displayNames.of(c.country) ?? c.country; } catch { /* keep raw code */ }
                                                const pct = Math.round((c.count / maxCount) * 100);
                                                return (
                                                    <div key={c.country}>
                                                        <div className="flex justify-between text-base mb-1">
                                                            <span className="text-[#232629] font-medium">{countryName}</span>
                                                            <span className="text-[#9199a1]">{(c.count ?? 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-[#e3e6e8]">
                                                            <div className="h-2 rounded-full bg-[#ffbc88]" style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Individual Bird Occurrence Tableau embed */}
                            <div>
                                <p className="text-base font-semibold text-[#232629] mb-2">Individual Bird Occurrence</p>
                                <TableauEmbed url={process.env.NEXT_PUBLIC_BIRD_OCCURRENCE!} title="Individual Bird Occurrence" height="400px" speciesFilter={selectedBird} />
                            </div>
                        </div>

                        {/* Monthly Sightings Over Time and Observation Trends side by side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <p className="text-base font-semibold text-[#232629] mb-2">Monthly Sightings Over Time</p>
                                <TableauEmbed url={process.env.NEXT_PUBLIC_MONTHLY_SIGHTING_OVERTIME!} title="Monthly Sighting Over Time" height="400px" speciesFilter={selectedBird} />
                            </div>
                            <div>
                                <p className="text-base font-semibold text-[#232629] mb-2">Observation Trends by Year</p>
                                <TableauEmbed url={process.env.NEXT_PUBLIC_OBSERVATION_BY_YEAR!} title="Observation Trends by Year" height="400px" speciesFilter={selectedBird} />
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </main>
    );
}

// Suspense wrapper is required by Next.js whenever useSearchParams() is used in a client component
export default function BirdPage() {
    return (
        <Suspense fallback={null}>
            <BirdPageInner />
        </Suspense>
    );
}
