"use client";
import { useEffect, useRef, useState } from "react";
import TableauEmbed from "@/conmponents/TableauEmbed";

// Converts ALL-CAPS species labels to Title Case for display
function toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Returns a Tailwind class string for the IUCN conservation status badge color
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

// Strips NaN, null, empty strings, and other junk values from a prey list
function cleanPreyList(list: any[]): string[] {
    return (list ?? [])
        .map((item: any) => String(item ?? "").trim())
        .filter(str => {
            if (str === "") return false;
            const lower = str.toLowerCase();
            return lower !== "nan" && lower !== "null" && lower !== "undefined";
        });
}

// The two birds pre-loaded when the page first opens
const DEFAULT_SLOTS: (string | null)[] = [
    "EUROPEAN TURTLE DOVE", "ABBOTTS BOOBY", null, null, null, null,
];
const DEFAULT_INPUTS: string[] = [
    "EUROPEAN TURTLE DOVE", "ABBOTTS BOOBY", "", "", "", "",
];

// Tab names shown in the main navigation bar
const TABS = ["Compare", "All Bird Occurrence", "Maps", "Trends & Status", "About"] as const;
type TabName = typeof TABS[number];

// The species comparison page — lets users compare up to 6 bird species side by side
export default function SpeciesPage() {

    // Full list of 525 bird names loaded from the CSV, used to populate the datalists
    const [birdNames,    setBirdNames]    = useState<string[]>([]);

    // Six comparison slots — each is either a confirmed species label or null (empty)
    const [slots,        setSlots]        = useState<(string | null)[]>(DEFAULT_SLOTS);

    // Per-slot typed text — decoupled from slots so half-typed strings don't trigger fetches
    const [slotInputs,   setSlotInputs]   = useState<string[]>(DEFAULT_INPUTS);

    // Fetched bird data, keyed by species label
    const [birdDataMap,  setBirdDataMap]  = useState<Record<string, any>>({});

    // Which slot indices are currently waiting for their API fetch to complete
    const [loadingSlots, setLoadingSlots] = useState<Set<number>>(new Set([0, 1]));

    // Which main content tab is currently shown
    const [tab, setTab] = useState<TabName>("Compare");

    // In-memory cache so switching back to a previously viewed bird is instant
    const birdDataCache = useRef<Map<string, any>>(new Map());

    // Derived list of only the filled slots, used throughout rendering
    const activeSlots = slots
        .map((label, index) => ({ label, index }))
        .filter((s): s is { label: string; index: number } => s.label !== null);

    // Load the full 525-species name list from the CSV on page mount
    useEffect(() => {
        fetch("/bird_name_mapping.csv")
            .then(r => r.text())
            .then(data => {
                const names = data
                    .split("\n").slice(1)
                    .map(row => row.split(",")[0].trim())
                    .filter(n => n.length > 0);
                setBirdNames(names);
            })
            .catch(err => console.error("Error loading bird names:", err));
    }, []);

    // Whenever a slot changes to a new label, fetch that bird's data (or pull from cache)
    useEffect(() => {
        slots.forEach((label, index) => {
            if (!label) return;

            // Cache hit — merge directly into the data map with no network call
            if (birdDataCache.current.has(label)) {
                setBirdDataMap(prev => ({ ...prev, [label]: birdDataCache.current.get(label) }));
                setLoadingSlots(prev => { const next = new Set(prev); next.delete(index); return next; });
                return;
            }

            // Cache miss — fetch from API
            setLoadingSlots(prev => new Set(prev).add(index));
            const capturedLabel = label; // capture in closure to avoid stale reference
            fetch(`http://127.0.0.1:8000/bird/${encodeURIComponent(capturedLabel)}`)
                .then(r => r.json())
                .then(data => {
                    birdDataCache.current.set(capturedLabel, data.bird);
                    setBirdDataMap(prev => ({ ...prev, [capturedLabel]: data.bird }));
                    setLoadingSlots(prev => { const next = new Set(prev); next.delete(index); return next; });
                })
                .catch(() => {
                    setLoadingSlots(prev => { const next = new Set(prev); next.delete(index); return next; });
                });
        });
    }, [slots]);

    // Called when the user types in a slot's search input
    function handleSlotInputChange(i: number, value: string) {
        const upper = value.toUpperCase();
        const next = [...slotInputs];
        next[i] = upper;
        setSlotInputs(next);
        // Confirm only if the name is valid AND not already selected in another slot
        const takenByOther = slots.some((s, j) => j !== i && s === upper);
        if (birdNames.includes(upper) && !takenByOther) {
            const nextSlots = [...slots];
            nextSlots[i] = upper;
            setSlots(nextSlots);
        }
    }

    // If the user clicks away and the text doesn't match any species, reset to last confirmed value
    function handleSlotBlur(i: number) {
        const confirmed = slots[i] ?? "";
        if (slotInputs[i] !== confirmed) {
            const next = [...slotInputs];
            next[i] = confirmed;
            setSlotInputs(next);
        }
    }

    // Clears a slot entirely — removes from the selector and the comparison view
    function handleClearSlot(i: number) {
        const nextSlots  = [...slots];
        const nextInputs = [...slotInputs];
        nextSlots[i]  = null;
        nextInputs[i] = "";
        setSlots(nextSlots);
        setSlotInputs(nextInputs);
    }

    return (
        // Two-panel layout: flex-1 main content + fixed 300px right aside for slot selectors
        <main className="flex-1 min-w-0 flex items-stretch bg-[#f8f9f9]">

            {/* ── Left main: tab bar + content ─────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col">

                {/* Page header card */}
                <div className="bg-white border-b border-[#e3e6e8] px-6 pt-5 pb-0" style={{ borderTop: "3px solid #ffbc88" }}>
                    <h1 className="text-xl font-bold text-[#232629] mb-1">Species Comparison</h1>
                    <p className="text-sm text-[#6a737c] mb-4">Compare up to 6 bird species side by side across taxonomy, diet, and migration.</p>

                    {/* Tab navigation */}
                    <div className="flex flex-wrap border-b border-[#e3e6e8] -mb-px">
                        {TABS.map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-3.5 py-3 text-sm border-b-[3px] -mb-px transition-colors font-medium whitespace-nowrap ${
                                    tab === t
                                        ? "border-[#ffbc88] text-[#232629] font-semibold"
                                        : "border-transparent text-[#6a737c] hover:text-[#232629]"
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab content area */}
                <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">

                    {/* ── Compare tab ───────────────────────────────────────────── */}
                    {tab === "Compare" && (
                        <>
                            {/* Side-by-side comparison table */}
                            {activeSlots.length === 0 ? (
                                <div className="bg-white border-2 border-dashed border-[#d6d9dc] rounded-lg p-16 text-center text-sm text-[#6a737c]">
                                    Select at least one species in the right panel to see the comparison.
                                </div>
                            ) : (
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-sm text-[#232629]">Side-by-Side Comparison</span>
                                    </div>
                                    {/* Horizontal scroll wrapper so narrow screens don't clip the table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-[#f8f9f9]">
                                                    {/* Sticky label column */}
                                                    <th className="sticky left-0 z-10 bg-[#f8f9f9] px-4 py-3 text-left font-semibold text-[#232629] border-b border-[#e3e6e8] min-w-[130px]">
                                                        Attribute
                                                    </th>
                                                    {/* One column per active bird */}
                                                    {activeSlots.map(({ label, index }) => {
                                                        const bird = birdDataMap[label];
                                                        return (
                                                            <th key={index} className="px-4 py-3 text-left border-b border-[#e3e6e8] min-w-[170px] align-top">
                                                                <p className="font-bold text-[#232629] text-sm">{toTitleCase(label)}</p>
                                                                {bird?.taxonomy?.genus && (
                                                                    <p className="italic text-xs text-[#9199a1] mt-0.5">{bird.taxonomy.genus}</p>
                                                                )}
                                                                {loadingSlots.has(index) && (
                                                                    <div className="mt-1 h-3 w-20 bg-[#e3e6e8] animate-pulse rounded" />
                                                                )}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>

                                                {/* Conservation Status row */}
                                                <tr className="border-b border-[#e3e6e8]">
                                                    <td className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold text-sm text-[#232629]">Conservation Status</td>
                                                    {activeSlots.map(({ label, index }) => {
                                                        const bird   = birdDataMap[label];
                                                        const status = bird?.conservation?.status_label;
                                                        return (
                                                            <td key={index} className="px-4 py-3 bg-white">
                                                                {loadingSlots.has(index) ? (
                                                                    <div className="h-4 w-20 bg-[#e3e6e8] animate-pulse rounded" />
                                                                ) : status ? (
                                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>{status}</span>
                                                                ) : "—"}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Population Trend row */}
                                                <tr className="border-b border-[#e3e6e8] bg-[#f8f9f9]">
                                                    <td className="sticky left-0 z-10 bg-[#f8f9f9] px-4 py-3 font-semibold text-sm text-[#232629]">Population Trend</td>
                                                    {activeSlots.map(({ label, index }) => {
                                                        const bird  = birdDataMap[label];
                                                        const trend = bird?.conservation?.population_trend;
                                                        return (
                                                            <td key={index} className="px-4 py-3 text-sm bg-[#f8f9f9] text-[#6a737c]">
                                                                {loadingSlots.has(index) ? <div className="h-4 w-20 bg-[#e3e6e8] animate-pulse rounded" /> : (trend ?? "—")}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Movement row */}
                                                <tr className="border-b border-[#e3e6e8]">
                                                    <td className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold text-sm text-[#232629]">Movement</td>
                                                    {activeSlots.map(({ label, index }) => {
                                                        const bird     = birdDataMap[label];
                                                        const movement = bird?.conservation?.movement_patterns;
                                                        return (
                                                            <td key={index} className="px-4 py-3 bg-white text-sm text-[#6a737c]">
                                                                {loadingSlots.has(index) ? <div className="h-4 w-20 bg-[#e3e6e8] animate-pulse rounded" /> : (movement ?? "—")}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Order row */}
                                                <tr className="border-b border-[#e3e6e8] bg-[#f8f9f9]">
                                                    <td className="sticky left-0 z-10 bg-[#f8f9f9] px-4 py-3 font-semibold text-sm text-[#232629]">Order</td>
                                                    {activeSlots.map(({ label, index }, colIdx) => {
                                                        const bird       = birdDataMap[label];
                                                        const order      = bird?.taxonomy?.order;
                                                        const firstOrder = birdDataMap[activeSlots[0]?.label]?.taxonomy?.order;
                                                        const matches    = colIdx > 0 && order && firstOrder && order === firstOrder;
                                                        return (
                                                            <td key={index} className={`px-4 py-3 text-sm text-[#6a737c] ${matches ? "bg-[#fdf2d8]" : "bg-[#f8f9f9]"}`}>
                                                                {loadingSlots.has(index) ? <div className="h-4 w-20 bg-[#e3e6e8] animate-pulse rounded" /> : (order ?? "—")}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Family row */}
                                                <tr className="border-b border-[#e3e6e8]">
                                                    <td className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold text-sm text-[#232629]">Family</td>
                                                    {activeSlots.map(({ label, index }, colIdx) => {
                                                        const bird        = birdDataMap[label];
                                                        const family      = bird?.taxonomy?.family;
                                                        const firstFamily = birdDataMap[activeSlots[0]?.label]?.taxonomy?.family;
                                                        const matches     = colIdx > 0 && family && firstFamily && family === firstFamily;
                                                        return (
                                                            <td key={index} className={`px-4 py-3 text-sm text-[#6a737c] ${matches ? "bg-[#fdf2d8]" : "bg-white"}`}>
                                                                {loadingSlots.has(index) ? <div className="h-4 w-20 bg-[#e3e6e8] animate-pulse rounded" /> : (family ?? "—")}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Genus row */}
                                                <tr>
                                                    <td className="sticky left-0 z-10 bg-[#f8f9f9] px-4 py-3 font-semibold text-sm text-[#232629]">Genus</td>
                                                    {activeSlots.map(({ label, index }, colIdx) => {
                                                        const bird       = birdDataMap[label];
                                                        const genus      = bird?.taxonomy?.genus;
                                                        const firstGenus = birdDataMap[activeSlots[0]?.label]?.taxonomy?.genus;
                                                        const matches    = colIdx > 0 && genus && firstGenus && genus === firstGenus;
                                                        return (
                                                            <td key={index} className={`px-4 py-3 text-sm text-[#6a737c] ${matches ? "bg-[#fdf2d8]" : "bg-[#f8f9f9]"}`}>
                                                                {loadingSlots.has(index) ? <div className="h-4 w-20 bg-[#e3e6e8] animate-pulse rounded" /> : (genus ?? "—")}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Diet cards — one card per active bird */}
                            {activeSlots.length > 0 && (
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-sm text-[#232629]">Diet</span>
                                        <span className="ml-2 text-xs text-[#9199a1]">Common prey items recorded for each species.</span>
                                    </div>
                                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {activeSlots.map(({ label, index }) => {
                                            const bird      = birdDataMap[label];
                                            const isLoading = loadingSlots.has(index);
                                            const rawPrey   = bird?.diet?.prey_common_names ?? bird?.diet?.top_prey ?? [];
                                            const prey      = cleanPreyList(rawPrey);
                                            return (
                                                <div key={index} className="bg-[#f8f9f9] rounded-lg p-4">
                                                    <h3 className="font-semibold text-sm text-[#232629] mb-2">{toTitleCase(label)}</h3>
                                                    {isLoading ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {[1, 2, 3].map(n => <div key={n} className="h-5 w-16 bg-[#e3e6e8] animate-pulse rounded-full" />)}
                                                        </div>
                                                    ) : prey.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {prey.map((item, pi) => (
                                                                <span key={pi} className="px-2 py-0.5 bg-white text-[#232629] text-xs rounded-full border border-[#e3e6e8]">
                                                                    {item}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-[#9199a1] italic">No diet data available.</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── All Bird Occurrence tab ───────────────────────────────── */}
                    {tab === "All Bird Occurrence" && (
                        <div className="flex flex-col gap-5">

                            {/* Main occurrence map — always shows all 525 species */}
                            <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                    <span className="font-semibold text-sm text-[#232629]">All Bird Occurrence</span>
                                    <span className="ml-2 text-xs text-[#9199a1]">A global map of occurrence records across all 525 species in the dataset.</span>
                                </div>
                                <div className="p-5">
                                    <TableauEmbed url={process.env.NEXT_PUBLIC_ALL_BIRD_OCCURRENCE!} title="All Bird Occurrence" height="600px" clearFilter />
                                </div>
                            </div>

                            {/* Species Density Heatmap — full width */}
                            <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                    <span className="font-semibold text-sm text-[#232629]">Species Density Heatmap</span>
                                </div>
                                <div className="p-5">
                                    <TableauEmbed url={process.env.NEXT_PUBLIC_SPECIES_HEATMAP!} title="Species Density Heatmap" height="600px" clearFilter />
                                </div>
                            </div>

                            {/* Population Trend and Species Richness side by side */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-sm text-[#232629]">Population Trend</span>
                                    </div>
                                    <div className="p-5">
                                        <TableauEmbed url={process.env.NEXT_PUBLIC_POPULATION_TREND!} title="Population Trend" height="500px" clearFilter />
                                    </div>
                                </div>
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-sm text-[#232629]">Species Richness</span>
                                    </div>
                                    <div className="p-5">
                                        <TableauEmbed url={process.env.NEXT_PUBLIC_SPECIES_REICHNESS!} title="Species Richness" height="500px" clearFilter />
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* ── Maps tab ──────────────────────────────────────────────── */}
                    {tab === "Maps" && (
                        <div className="flex flex-col gap-5">
                            <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                    <span className="font-semibold text-sm text-[#232629]">Species Density Heatmap</span>
                                </div>
                                <div className="p-5">
                                    <TableauEmbed
                                        url={process.env.NEXT_PUBLIC_SPECIES_HEATMAP!}
                                        title="Species Density Heatmap"
                                        height="600px"
                                        speciesFilters={activeSlots.length > 0 ? activeSlots.map(s => s.label) : undefined}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-sm text-[#232629]">Species Richness</span>
                                    </div>
                                    <div className="p-5">
                                        <TableauEmbed
                                            url={process.env.NEXT_PUBLIC_SPECIES_REICHNESS!}
                                            title="Species Richness"
                                            height="500px"
                                            speciesFilters={activeSlots.length > 0 ? activeSlots.map(s => s.label) : undefined}
                                        />
                                    </div>
                                </div>
                                <div className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-sm text-[#232629]">Country Distribution</span>
                                    </div>
                                    <div className="p-5">
                                        <TableauEmbed
                                            url={process.env.NEXT_PUBLIC_COUNTRY_DISTRIBUTION!}
                                            title="Country Distribution"
                                            height="500px"
                                            speciesFilters={activeSlots.length > 0 ? activeSlots.map(s => s.label) : undefined}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Trends & Status tab ───────────────────────────────────── */}
                    {tab === "Trends & Status" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[
                                { env: process.env.NEXT_PUBLIC_OBSERVATION_BY_YEAR!,         title: "Observation Trend by Year" },
                                { env: process.env.NEXT_PUBLIC_MONTHLY_SIGHTING_OVERTIME!,    title: "Monthly Sighting Over Time" },
                                { env: process.env.NEXT_PUBLIC_POPULATION_TREND!,             title: "Population Trend" },
                                { env: process.env.NEXT_PUBLIC_CONSERVATION_STATUS!,          title: "Conservation Status" },
                            ].map(({ env, title }) => (
                                <div key={title} className="bg-white border border-[#e3e6e8] rounded-lg overflow-hidden">
                                    <div className="px-5 py-3.5 border-b border-[#e3e6e8]">
                                        <span className="font-semibold text-sm text-[#232629]">{title}</span>
                                    </div>
                                    <div className="p-5">
                                        {/* Pass the currently selected species as filters so the graphs
                                            show only the birds being compared — only sent when at least
                                            one bird is selected, otherwise the graph shows all species */}
                                        <TableauEmbed
                                            url={env}
                                            title={title}
                                            height="400px"
                                            speciesFilters={activeSlots.length > 0 ? activeSlots.map(s => s.label) : undefined}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── About tab — Wikipedia summaries for each selected species ── */}
                    {tab === "About" && (
                        activeSlots.length === 0 ? (
                            <div className="bg-white border-2 border-dashed border-[#d6d9dc] rounded-lg p-16 text-center text-sm text-[#6a737c]">
                                Select at least one species in the right panel to see summaries.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeSlots.map(({ label, index }) => {
                                    const bird      = birdDataMap[label];
                                    const isLoading = loadingSlots.has(index);
                                    const fullText: string = bird?.wikipedia?.extract ?? "";
                                    const summary   = fullText.length > 400 ? fullText.slice(0, 400).trimEnd() + "…" : fullText;
                                    return (
                                        <div key={index} className="bg-white border border-[#e3e6e8] rounded-lg p-4 flex flex-col gap-3 shadow-sm">
                                            <h3 className="font-bold text-sm text-[#232629]">{toTitleCase(label)}</h3>
                                            {isLoading ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="h-3 w-full bg-[#e3e6e8] animate-pulse rounded" />
                                                    <div className="h-3 w-5/6 bg-[#e3e6e8] animate-pulse rounded" />
                                                    <div className="h-3 w-4/6 bg-[#e3e6e8] animate-pulse rounded" />
                                                </div>
                                            ) : summary ? (
                                                <p className="text-sm text-[#6a737c] leading-relaxed">{summary}</p>
                                            ) : (
                                                <p className="text-sm text-[#9199a1] italic">No description available.</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                </div>
            </div>

            {/* ── Right aside: species slot selectors ──────────────────────────── */}
            <aside
                className="w-[280px] flex-none bg-white border-l border-[#e3e6e8] p-5 sticky top-[50px] self-start box-border overflow-y-auto flex flex-col gap-4"
                style={{ minHeight: "calc(100vh - 50px)" }}
            >
                <div>
                    <p className="font-semibold text-sm text-[#232629] mb-0.5">Select Species</p>
                    <p className="text-xs text-[#9199a1]">Pick up to 6 birds to compare.</p>
                </div>

                {/* Six search slots */}
                {slots.map((label, i) => (
                    <div key={i} className={`relative rounded-lg p-3 border transition-colors ${
                        label ? "border-[#babfc4] bg-white" : "border-dashed border-[#d6d9dc] bg-[#f8f9f9]"
                    }`}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9199a1] mb-1.5">Bird {i + 1}</p>
                        <div className="relative">
                            <input
                                type="text"
                                list={`bird-name-list-${i}`}
                                value={slotInputs[i]}
                                onChange={e => handleSlotInputChange(i, e.target.value)}
                                onBlur={() => handleSlotBlur(i)}
                                placeholder="Search for a bird…"
                                className="w-full bg-white rounded border border-[#babfc4] px-3 py-2 text-xs text-[#232629] placeholder:text-[#9199a1] focus:outline-none focus:ring-2 focus:ring-[#ffbc88] pr-6"
                            />
                            {/* Each slot gets its own datalist, filtered to exclude birds already chosen */}
                            <datalist id={`bird-name-list-${i}`}>
                                {birdNames
                                    .filter(name => !slots.some((s, j) => j !== i && s === name))
                                    .map(name => <option key={name} value={name} />)
                                }
                            </datalist>
                            {/* Clear button */}
                            {label && (
                                <button
                                    onClick={() => handleClearSlot(i)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9199a1] hover:text-[#232629] font-bold text-sm leading-none"
                                    aria-label={`Clear slot ${i + 1}`}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        {/* Loading indicator while the bird's data is being fetched */}
                        {loadingSlots.has(i) && (
                            <p className="mt-1.5 text-[10px] text-[#9199a1] italic">Loading…</p>
                        )}
                        {/* Confirmed species name shown below the input once loaded */}
                        {label && !loadingSlots.has(i) && (
                            <p className="mt-1.5 text-[10px] font-medium text-[#6a737c]">{toTitleCase(label)}</p>
                        )}
                    </div>
                ))}
            </aside>

        </main>
    );
}
