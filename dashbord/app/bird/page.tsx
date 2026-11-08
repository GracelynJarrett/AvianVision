"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// The bird that is shown when the page first loads
const DEFAULT_BIRD = "EUROPEAN TURTLE DOVE";

// Converts an all-caps bird name like "EUROPEAN TURTLE DOVE" to "European Turtle Dove"
function toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Maps IUCN conservation status codes to a display color using the site palette
// Severity runs from dark (most serious) to light (least serious)
function getStatusColor(status: string): string {
    switch (status?.toUpperCase()) {
        case "CRITICALLY ENDANGERED": return "bg-[#333333] text-white";
        case "ENDANGERED": return "bg-[#FF8A2A] text-white";
        case "VULNERABLE": return "bg-[#ffbc88] text-[#333333]";
        case "NEAR THREATENED": return "bg-[#fff99d] text-[#333333]";
        case "LEAST CONCERN": return "bg-[#fffdde] text-[#333333]";
        default: return "bg-[#C9C9C9] text-[#333333]";
    }
}

// Shared cache for Wikipedia prey images — lives at module level so all pills share it
// Maps prey name → image URL (or null if Wikipedia had no image)
const preyImageCache = new Map<string, string | null>();

// Filters an array of prey values to remove blank, NaN, null, undefined, or garbage entries
// Converts each item to a string first so no matter what type MongoDB sent, we catch it
function cleanPreyList(list: any[]): string[] {
    return (list ?? [])
        .map((item: any) => String(item ?? "").trim())
        .filter(str => {
            if (str === "") return false;
            const lower = str.toLowerCase();
            // Drop any string that is a serialized bad value
            return lower !== "nan" && lower !== "null" && lower !== "undefined";
        });
}

// A single prey pill that fetches a Wikipedia image and shows it in a hover card
function PreyPill({ name, filled = false }: { name: string; filled?: boolean }) {
    const [showCard, setShowCard] = useState(false);
    const [imgSrc, setImgSrc] = useState<string | null | undefined>(undefined);
    const [imgLoading, setImgLoading] = useState(false);

    // Fetch a thumbnail from Wikipedia's public summary API the first time this pill is hovered
    // Results are stored in the module-level cache so the same prey name only fetches once
    function loadImage() {
        if (preyImageCache.has(name)) {
            setImgSrc(preyImageCache.get(name));
            return;
        }
        setImgLoading(true);
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`)
            .then(res => res.json())
            .then(data => {
                const url: string | null = data.thumbnail?.source ?? null;
                preyImageCache.set(name, url);
                setImgSrc(url);
                setImgLoading(false);
            })
            .catch(() => {
                preyImageCache.set(name, null);
                setImgSrc(null);
                setImgLoading(false);
            });
    }

    function handleMouseEnter() {
        setShowCard(true);
        loadImage();
    }

    return (
        // Relative wrapper so the hover card can position itself above the pill
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setShowCard(false)}
            onClick={() => { setShowCard(v => !v); loadImage(); }}
        >
            {/* The pill itself — filled style for prey classes, outlined for prey names */}
            <span className={`cursor-pointer rounded-full px-4 py-1 text-sm select-none transition-opacity hover:opacity-80
                ${filled
                    ? "bg-[#ffbc88] font-medium text-[#333333]"
                    : "bg-white border border-[#ffbc88] text-[#333333]"
                }`}
            >
                {name}
            </span>

            {/* Hover card — appears above the pill with the Wikipedia thumbnail */}
            {showCard && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-20 w-44 rounded-xl border border-[#C9C9C9] bg-white shadow-lg p-3">
                    {imgLoading ? (
                        <p className="text-xs text-center text-[#909090] py-4">Loading...</p>
                    ) : imgSrc ? (
                        <img
                            src={imgSrc}
                            alt={name}
                            className="w-full rounded-lg object-cover max-h-32"
                        />
                    ) : (
                        <p className="text-xs text-center text-[#909090] py-4">No image available</p>
                    )}
                    <p className="mt-2 text-xs text-center font-medium text-[#333333]">{name}</p>
                </div>
            )}
        </div>
    );
}

// One row in the Wikipedia accordion — click the header to expand or collapse the section text
function WikiAccordionItem({ title, content }: { title: string; content: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            {/* Clickable header row — chevron rotates when open */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex justify-between items-center px-6 py-4 bg-[#fffdde] hover:bg-[#fff99d] transition-colors text-left"
                aria-expanded={isOpen}
            >
                <span className="font-serif font-semibold text-[#333333]">{title}</span>
                <span className={`text-[#909090] text-lg transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                    ›
                </span>
            </button>

            {/* Section text — only rendered when open */}
            {isOpen && (
                <div className="px-6 py-5 bg-white text-[#3F4850] leading-relaxed whitespace-pre-line">
                    {content}
                </div>
            )}
        </div>
    );
}

// Short educational description for each taxonomic rank
// These explain what the classification level means, not the specific bird value
const RANK_DESCRIPTIONS: Record<string, string> = {
    Class:
        "Class is one of the broadest groupings in animal classification. All birds belong to class Aves — they share key traits like feathers, beaks, warm blood, and hard-shelled eggs.",
    Order:
        "Order groups families that share a common ancestor. Birds in the same order are more closely related to each other than to birds in different orders.",
    Family:
        "Family groups genera that look and behave similarly. Birds in the same family often share physical features, nesting habits, or diet — even if they vary in size and color.",
    Genus:
        "Genus groups species that are very closely related — often similar in appearance and behavior. The genus name is the first word in a bird's two-part scientific name.",
    Species:
        "Species is the most specific classification level. Birds of the same species can reproduce with each other. Each species has a unique two-part scientific name made up of the genus and species identifier.",
};

// Taxonomy section with clickable boxes — clicking a box opens a detail panel below the chain
function TaxonomySection({ birdData }: { birdData: any }) {
    // Tracks which rank box is currently open — null means all closed
    const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

    // Build the ordered list of taxonomy levels using the bird's actual data
    const levels = [
        { label: "Class", value: birdData.taxonomy?.class },
        { label: "Order", value: birdData.taxonomy?.order },
        { label: "Family", value: birdData.taxonomy?.family },
        { label: "Genus", value: birdData.taxonomy?.genus },
        { label: "Species", value: birdData.scientific_name },
    ].filter(level => level.value); // skip any levels the API didn't return

    // Toggle a box open or closed — clicking the open box closes it
    function handleBoxClick(label: string) {
        setExpandedLevel(prev => (prev === label ? null : label));
    }

    const expanded = levels.find(l => l.label === expandedLevel) ?? null;

    return (
        <section className="bg-[#fffdde] px-8 py-12">
            <div className="max-w-5xl mx-auto">
                <h2 className="font-serif text-2xl font-bold text-[#333333] mb-2 text-center">
                    Classification
                </h2>
                <p className="text-center text-sm text-[#909090] mb-8">
                    Click any level to learn more about it.
                </p>

                {/* Horizontal chain of clickable taxonomy boxes */}
                <div className="flex flex-wrap justify-center items-center gap-2">
                    {levels.map((level, index) => {
                        const isOpen = expandedLevel === level.label;
                        return (
                            <div key={level.label} className="flex items-center gap-2">

                                {/* Taxonomy box — highlighted when open */}
                                <button
                                    onClick={() => handleBoxClick(level.label)}
                                    className={`flex flex-col items-center rounded-xl px-5 py-4 min-w-[110px] shadow-sm border-2 transition-colors duration-150 cursor-pointer
                                        ${isOpen
                                            ? "bg-[#fff99d] border-[#3F4850]"
                                            : "bg-white border-[#C9C9C9] hover:border-[#909090]"
                                        }`}
                                    aria-expanded={isOpen}
                                    aria-label={`${level.label}: ${level.value}`}
                                >
                                    {/* Rank label */}
                                    <span className="text-xs font-semibold uppercase tracking-widest text-[#909090] mb-1">
                                        {level.label}
                                    </span>
                                    {/* Rank value — italic for species (scientific name) */}
                                    <span className={`text-sm font-medium text-[#333333] text-center ${level.label === "Species" ? "italic" : ""}`}>
                                        {level.value}
                                    </span>
                                </button>

                                {/* Connecting arrow — hidden after the last box */}
                                {index < levels.length - 1 && (
                                    <span className="text-[#909090] text-lg select-none">›</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Detail panel — slides in below the chain when a box is open */}
                {expanded && (
                    <div className="mt-6 rounded-xl bg-white border border-[#C9C9C9] px-8 py-6 shadow-sm">
                        {/* Rank name and value */}
                        <div className="flex items-baseline gap-3 mb-3">
                            <span className="text-xs font-semibold uppercase tracking-widest text-[#909090]">
                                {expanded.label}
                            </span>
                            <span className={`font-serif text-2xl font-bold text-[#333333] ${expanded.label === "Species" ? "italic" : ""}`}>
                                {expanded.value}
                            </span>
                        </div>
                        {/* Static explanation of what this rank means */}
                        <p className="text-[#3F4850] leading-relaxed">
                            {RANK_DESCRIPTIONS[expanded.label]}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}

function BirdPageInner() {
    // Read the ?species= URL param so links from the slideshow open the right bird directly
    const searchParams = useSearchParams();
    const urlSpecies = searchParams.get("species")?.toUpperCase().trim() ?? DEFAULT_BIRD;

    const [birdNames, setBirdNames] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState(urlSpecies);
    const [selectedBird, setSelectedBird] = useState(urlSpecies);
    const [birdData, setBirdData] = useState<any>(null);
    const [birdDataLoading, setBirdDataLoading] = useState(true);
    const [birdImage, setBirdImage] = useState<string | null>(null);

    // Wikimedia plumage image URLs for the currently selected bird
    const [plumageImages, setPlumageImages] = useState<string[]>([]);
    const [plumageLoading, setPlumageLoading] = useState(false);

    // In-memory caches so switching back to a previously viewed bird is instant
    const birdDataCache = useRef<Map<string, any>>(new Map());
    const birdImageCache = useRef<Map<string, string>>(new Map());

    // Load the full list of 525 bird species names from the CSV when the page first opens
    useEffect(() => {
        fetch("/bird_name_mapping.csv")
            .then(response => response.text())
            .then(data => {
                const names = data
                    .split("\n")
                    .slice(1)
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

    // Fetch the bird's image — checks the cache first so repeat visits are instant
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

    // Called when the user types in the search box — updates the input and loads the bird
    // if what they typed exactly matches a name in the list (happens when they pick from the dropdown)
    function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value.toUpperCase();
        setSearchQuery(value);
        if (birdNames.includes(value)) {
            setSelectedBird(value);
        }
    }

    // Pick a completely random bird from the loaded name list and display it
    function handleRandom() {
        if (birdNames.length === 0) return;
        const randomName = birdNames[Math.floor(Math.random() * birdNames.length)];
        setSearchQuery(randomName);
        setSelectedBird(randomName);
    }

    return (
        <main className="bg-[#FFFFFF] text-[#3F4850]">

            {/* ── Page intro ──────────────────────────────────────────────────────── */}
            <section className=" px-8 py-14">
                <div className="max-w-5xl mx-auto text-center">
                    <h1 className="font-serif text-4xl font-bold underline text-[#333333] mb-8">
                        Bird Explorer
                    </h1>
                    <p className="text-lg text-[#3F4850] leading-relaxed max-w-2xl mx-auto">
                        Search any of the 525 bird species in the AvianVision dataset.
                        Explore conservation status, classification, diet, migration patterns, and more.
                    </p>
                </div>
            </section>

            {/* ── Section 1: Search ───────────────────────────────────────────────── */}
            {/* Lets the user find a bird by typing or load a random one */}
            <section className=" px-8 py-10">
                <div className="max-w-2xl mx-auto bg-[#ffd6b6] px-15 py-8 rounded-2xl">
                    <h2 className="font-serif text-2xl font-semibold text-center mb-3 text-[#333333]">
                        Find a Bird
                    </h2>

                    {/* Search input and Random button sit side-by-side */}
                    <div className="flex gap-3 ">
                        <input
                            id="bird-search"
                            type="text"
                            list="bird-name-list"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder="Type a bird name..."
                            className="flex-1 rounded-lg border border-[#3F4850]/30 bg-white px-4 py-3 text-[#333333] placeholder:text-[#909090] focus:outline-none focus:ring-2 focus:ring-[#3F4850]/40 "
                        />
                        {/* datalist feeds the browser's native dropdown suggestions */}
                        <datalist id="bird-name-list">
                            {birdNames.map(name => (
                                <option key={name} value={name} />
                            ))}
                        </datalist>

                        {/* Random button — picks a surprise bird from the full 525-species list */}
                        <button
                            onClick={handleRandom}
                            disabled={birdNames.length === 0}
                            className="rounded-lg bg-[#3F4850] px-6 py-3 text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            Random Bird
                        </button>
                    </div>

                    {/* Shows which bird is currently loaded */}
                    {selectedBird && (
                        <p className="mt-3 text-center text-base text-[#3F4850]">
                            Currently showing:{" "}
                            <span className="font-semibold italic">{toTitleCase(selectedBird)}</span>
                        </p>
                    )}
                </div>
            </section>

            {/* ── Section 2: Bird Header ──────────────────────────────────────────── */}
            {/* Shows the bird's image on the left and key facts on the right */}
            <section className="px-8 py-12">
                <div className="max-w-5xl mx-auto flex flex-col gap-10 md:flex-row md:items-start md:gap-12">

                    {/* Bird image — shows a placeholder box while the image is loading */}
                    <div className="flex-shrink-0 flex justify-center">
                        <div className="w-96 h-96 rounded-2xl border-2 border-[#C9C9C9] bg-[#fffdde] overflow-hidden flex items-center justify-center">
                            {birdImage ? (
                                <img
                                    src={birdImage}
                                    alt={selectedBird}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                // Shown while the image fetch is in flight
                                <p className="text-[#909090] text-sm">Loading image...</p>
                            )}
                        </div>
                    </div>

                    {/* Bird information — name, scientific name, and conservation details */}
                    <div className="flex flex-col gap-4 flex-1">

                        {birdDataLoading ? (
                            // Shown while the API call is in flight
                            <p className="text-[#909090]">Loading bird information...</p>
                        ) : birdData ? (
                            <>
                                {/* Common name */}
                                <h2 className="font-serif text-4xl font-bold text-[#333333] leading-tight">
                                    {toTitleCase(birdData.species_label)}
                                </h2>

                                {/* Scientific name */}
                                <p className="italic text-2xl text-[#909090]">
                                    {birdData.scientific_name}
                                </p>

                                {/* Divider */}
                                <hr className="border-[#C9C9C9]-300" />

                                {/* Conservation status badge */}
                                <div>
                                    <p className="text-base font-semibold uppercase tracking-widest text-[#909090] mb-2">
                                        Conservation Status
                                    </p>
                                    <span className={`rounded-full px-4 py-1 text-base font-semibold ${getStatusColor(birdData.conservation?.status_label)}`}>
                                        {birdData.conservation?.status_label ?? "Unknown"}
                                    </span>
                                </div>

                                {/* Population trend and movement — shown as a small fact card grid */}
                                <div className="grid grid-cols-2 gap-3 pt-1 ">
                                    {birdData.conservation?.population_trend && (
                                        <div className="rounded-lg bg-[#fffdde] px-4 py-3 rounded-2xl">
                                            <p className="text-base font-semibold uppercase tracking-widest text-[#909090] mb-1">
                                                Population Trend
                                            </p>
                                            <p className="text-base font-medium text-[#333333]">
                                                {birdData.conservation.population_trend}
                                            </p>
                                        </div>
                                    )}
                                    {birdData.conservation?.movement_patterns && (
                                        <div className="rounded-lg bg-[#fffdde] px-4 py-3 rounded-2xl">
                                            <p className="text-base font-semibold uppercase tracking-widest text-[#909090] mb-1">
                                                Movement
                                            </p>
                                            <p className="text-base font-medium text-[#333333]">
                                                {birdData.conservation.movement_patterns}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            // Shown if the API returned no data for this bird
                            <p className="text-[#909090]">No information available for this species.</p>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Section 3: Taxonomy Tree ────────────────────────────────────────── */}
            {/* Shows the bird's place in the classification system, from class down to species */}
            {/* Clicking any box opens a panel explaining what that classification rank means */}
            {birdData && (
                <TaxonomySection birdData={birdData} />
            )}

            {/* ── Section 4: Diet ─────────────────────────────────────────────────── */}
            {/* Shows what this bird eats using data from the Avian Diet Database */}
            {birdData && (
                <section className=" px-8 py-12">
                    <div className=" bg-[#ffd6b6] py-10 rounded-2xl">
                        <h2 className="font-serif text-3xl font-bold text-[#333333] mb-8 text-center">
                            Diet
                        </h2>

                        {/* Clean both lists first to remove any NaN or empty entries */}
                        {(() => {
                            const preyNames = cleanPreyList(birdData.diet?.prey_common_names);
                            const preyTypes = cleanPreyList(birdData.diet?.prey_classes);
                            const hasData = preyNames.length > 0 || preyTypes.length > 0;

                            return hasData ? (
                                <div className="flex flex-col gap-6 px-10">

                                    {/* Single hint at the top — no need to repeat it per group */}
                                    <p className="text-ms text-[#3F4850]/60">
                                        Hover or click any pill to see an image of that prey item.
                                    </p>

                                    {/* Prey names */}
                                    {preyNames.length > 0 && (
                                        <div>
                                            <h3 className="text-base font-semibold uppercase tracking-widest text-[#3F4850] mb-3">
                                                Prey
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {preyNames.map((prey) => (
                                                    <PreyPill key={prey} name={prey} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Prey types — broader categories such as "Fish" or "Insects" */}
                                    {preyTypes.length > 0 && (
                                        <div>
                                            <h3 className="text-base font-semibold uppercase tracking-widest text-[#3F4850] mb-3">
                                                Prey Type
                                            </h3>
                                            <div className="flex flex-wrap gap-3 text-sm">
                                                {preyTypes.map((cls) => (
                                                    <PreyPill key={cls} name={cls} filled />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                // Shown when the Avian Diet Database has no data for this species
                                <p className="text-center text-[#909090]">
                                    No diet data available for this species.
                                </p>
                            );
                        })()}
                    </div>
                </section>
            )}

            {/* ── Section 5: Wikipedia Description ────────────────────────────────── */}
            {/* Shows a summary of the bird followed by expandable Wikipedia sections */}
            {birdData?.wikipedia && (
                <section className="bg-[#FFFFFF] px-8 py-12">
                    <div className="max-w-5xl mx-auto">
                        <h2 className="font-serif text-3xl font-bold text-[#333333] mb-8 text-center">
                            About this Species
                        </h2>

                        {/* Plumage photo gallery — Wikimedia Commons images for this species */}
                        {(plumageLoading || plumageImages.length > 0) && (
                            <div className="mb-10">
                                {plumageLoading ? (
                                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                                        <div className="h-52 bg-[#C9C9C9] animate-pulse rounded-xl" />
                                        <div className="h-52 bg-[#C9C9C9] animate-pulse rounded-xl" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                                        {plumageImages.map((url, i) => (
                                            <img
                                                key={i}
                                                src={url}
                                                alt={`${toTitleCase(selectedBird)} photo ${i + 1}`}
                                                className="w-full h-52 object-cover rounded-xl"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Short extract — always visible, gives a quick overview */}
                        {birdData.wikipedia.extract && (
                            <p className="text-lg text-[#333333] leading-relaxed mb-10 max-w-3xl mx-auto text-center">
                                {birdData.wikipedia.extract}
                            </p>
                        )}

                        {/* Accordion — one entry per Wikipedia section, each independently togglable */}
                        {Object.entries(birdData.wikipedia.sections ?? {}).length > 0 && (
                            <div className="border border-[#C9C9C9] rounded-xl overflow-hidden divide-y divide-[#C9C9C9]">
                                {Object.entries(birdData.wikipedia.sections).map(([title, content]) => (
                                    <WikiAccordionItem
                                        key={title}
                                        title={title}
                                        content={content as string}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ── Section 6: Migration ────────────────────────────────────────────── */}
            {/* Shows sighting counts, top countries, and a monthly breakdown chart */}
            {/* Tableau migration map will replace the placeholder once published */}
            {birdData?.migration && (
                <section className="bg-[#333333] px-8 py-12 text-white">
                    <div className="max-w-5xl mx-auto">
                        <h2 className="font-serif text-3xl font-bold text-[#fff99d] mb-10 text-center">
                            Migration &amp; Sightings
                        </h2>

                        {/* Total sightings — one large number at the top */}
                        <div className="text-center mb-12">
                            <p className="text-6xl font-bold text-white">
                                {(birdData.migration.total_sightings ?? 0).toLocaleString()}
                            </p>
                            <p className="mt-2 text-base text-[#C9C9C9]">Total recorded sightings</p>
                        </div>

                        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">

                            {/* Top countries — name, count, and a proportional bar */}
                            {birdData.migration.top_countries?.length > 0 && (
                                <div>
                                    <h3 className="font-serif text-2xl font-semibold text-[#ffbc88] mb-5">
                                        Top Countries
                                    </h3>
                                    <div className="flex flex-col gap-4">
                                        {(() => {
                                            const countries = birdData.migration.top_countries.slice(0, 5);
                                            const maxCount = Math.max(...countries.map((c: any) => c.count));
                                            // Resolve 2-letter country code to a readable name using the browser's built-in API
                                            const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

                                            return countries.map((c: any) => {
                                                let countryName = c.country;
                                                try { countryName = displayNames.of(c.country) ?? c.country; } catch { /* keep raw code */ }
                                                const pct = Math.round((c.count / maxCount) * 100);

                                                return (
                                                    <div key={c.country}>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span className="text-white text-base">{countryName}</span>
                                                            <span className="text-[#C9C9C9]">{c.count.toLocaleString()}</span>
                                                        </div>
                                                        {/* Progress bar — width is proportional to the highest-count country */}
                                                        <div className="h-2 rounded-full bg-white/20">
                                                            <div
                                                                className="h-2 rounded-full bg-[#ffbc88]"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Monthly sightings — a simple CSS bar chart, no library needed */}
                            {birdData.migration.monthly_sightings && (
                                <div>
                                    <h3 className="font-serif text-2xl font-semibold text-[#ffbc88] mb-5">
                                        Sightings by Month
                                    </h3>
                                    {(() => {
                                        const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                        const monthly = birdData.migration.monthly_sightings;
                                        const values = MONTHS.map((_, i) => Number(monthly[String(i + 1)] ?? 0));
                                        const maxVal = Math.max(...values, 1); // avoid divide-by-zero

                                        return (
                                            <div className="flex items-end gap-1 h-52">
                                                {values.map((val, i) => (
                                                    <div key={i} className="flex flex-col items-center flex-1">
                                                        {/* Bar height is proportional to the busiest month */}
                                                        <div
                                                            className="w-full rounded-t bg-[#fff99d]"
                                                            style={{ height: `${(val / maxVal) * 100}%` }}
                                                            title={`${MONTHS[i]}: ${val}`}
                                                        />
                                                        <span className="mt-1 text-[10px] text-[#C9C9C9]">
                                                            {MONTHS[i]}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* ── Tableau placeholder ──────────────────────────────────────────── */}
                        {/* This section will be replaced with the real Tableau embed once    */}
                        {/* Gracie has confirmed the server access / publishing approach.     */}
                        <div className="mt-12 rounded-xl border-2 border-dashed border-[#909090] p-10 text-center">
                            <p className="text-[#909090] text-sm uppercase tracking-widest mb-2">Coming Soon</p>
                            <p className="text-white font-serif text-xl font-semibold">Tableau Migration Map</p>
                            <p className="text-[#C9C9C9] mt-2 text-sm">
                                An interactive migration map will be embedded here once the Tableau setup is confirmed.
                            </p>
                        </div>

                    </div>
                </section>
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
