"use client";
import { useEffect, useRef, useState } from "react";
import ConservationStatus from "@/conmponents/charts/conservation_status";


// Converts ALL-CAPS species labels to Title Case for display
function toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Returns a Tailwind class string for the IUCN conservation status badge color
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

// The species comparison page — lets users compare up to 6 bird species side by side
export default function SpeciesPage() {

    // Full list of 525 bird names loaded from the CSV, used to populate the datalists
    const [birdNames, setBirdNames] = useState<string[]>([]);

    // Six comparison slots — each is either a confirmed species label or null (empty)
    const [slots, setSlots] = useState<(string | null)[]>(DEFAULT_SLOTS);

    // Per-slot typed text — decoupled from slots so half-typed strings don't trigger fetches
    const [slotInputs, setSlotInputs] = useState<string[]>(DEFAULT_INPUTS);

    // Fetched bird data, keyed by species label
    const [birdDataMap, setBirdDataMap] = useState<Record<string, any>>({});

    // Which slot indices are currently waiting for their API fetch to complete
    const [loadingSlots, setLoadingSlots] = useState<Set<number>>(new Set([0, 1]));

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
                    .split("\n")
                    .slice(1)
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
        const nextSlots = [...slots];
        const nextInputs = [...slotInputs];
        nextSlots[i] = null;
        nextInputs[i] = "";
        setSlots(nextSlots);
        setSlotInputs(nextInputs);
    }

    return (
        <main className="bg-[#FFFFFF]">

            {/* Section 1: Hero — page title and description */}
            <section className="bg-[#ffffff] px-8 py-14">
                <div className="max-w-5xl mx-auto text-center">
                    <h1 className="font-serif text-4xl font-bold text-[#333333] mb-10 underline">
                        Species Comparison
                    </h1>
                    <p className="text-lg text-[#3F4850] leading-relaxed max-w-2xl mx-auto">
                        Compare up to 6 bird species side by side. Search for a species
                        in any slot below to add it to the comparison.
                    </p>
                </div>
            </section>


            {/* Temraly placeholder for the maps and graphs*/}

            <div>
                <div className="rounded-xl border-2 border-dashed border-[#C9C9C9]/40 p-6">
                    < ConservationStatus />
                </div>
                <p className="text-[#c9c9c9] px-10 py-5">
                    All Bird Occurrence
                </p>
            </div>



            {/* Section 2: Bird Selector — 6 search slots in a 2×3 grid */}
            <section className="bg-[#ffffff] px-8 py-2 ">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-6">
                        Select Species
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {slots.map((label, i) => (
                            <div key={i} className={`relative rounded-xl border-3 bg-[#ffd6b6] p-4 transition-colors ${label
                                ? "border-[#3F4850] "
                                : "border-dashed border-[#C9C9C9]"
                                }`}>

                                {/* Slot number label */}
                                <p className="text-base font-semibold uppercase tracking-widest text-[#3F4850] mb-2">
                                    Bird {i + 1}
                                </p>

                                {/* Search input — unique list id per slot avoids cross-slot datalist interference */}
                                <input
                                    type="text"
                                    list={`bird-name-list-${i}`}
                                    value={slotInputs[i]}
                                    onChange={e => handleSlotInputChange(i, e.target.value)}
                                    onBlur={() => handleSlotBlur(i)}
                                    placeholder="Search for a bird..."
                                    className="w-full bg-[#ffffff] rounded-lg border border-[#C9C9C9] px-3 py-2 text-base text-[#333333] placeholder:text-[#C9C9C9] focus:outline-none focus:border-[#3F4850] pr-8"
                                />

                                {/* Each slot gets its own datalist, filtered to exclude birds already chosen in other slots */}
                                <datalist id={`bird-name-list-${i}`}>
                                    {birdNames
                                        .filter(name => !slots.some((s, j) => j !== i && s === name))
                                        .map(name => (
                                            <option key={name} value={name} />
                                        ))
                                    }
                                </datalist>

                                {/* Clear button — only shown when this slot has a confirmed bird */}
                                {label && (
                                    <button
                                        onClick={() => handleClearSlot(i)}
                                        className="absolute top-3 right-3 text-[#3F4850]/40 hover:text-[#333333] text-lg leading-none font-bold transition-colors"
                                        aria-label={`Clear slot ${i + 1}`}
                                    >
                                        ×
                                    </button>
                                )}

                                {/* Loading indicator while the bird's data is being fetched */}
                                {loadingSlots.has(i) && (
                                    <p className="mt-2 text-xs text-[#3F4850]/50 italic">Loading…</p>
                                )}

                                {/* Confirmed species name shown below the input once loaded */}
                                {label && !loadingSlots.has(i) && (
                                    <p className="mt-2 text-xs font-medium text-[#3F4850]">
                                        {toTitleCase(label)}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Hint shown when every slot has been cleared */}
                    {activeSlots.length === 0 && (
                        <p className="mt-6 text-center text-lg text-[#3F4850]/60 italic">
                            Select at least one bird above to see the comparison below.
                        </p>
                    )}
                </div>
            </section>

            {/* Section 3: Comparison Table — attribute rows vs. bird columns */}
            <section className="bg-[#FFFFFF] px-8 py-20">
                <div className="max-w-7xl mx-auto">
                    <h2 className="font-serif text-2xl font-bold text-[#333333] mb-6">
                        Side-by-Side Comparison
                    </h2>

                    {/* Only render the table when at least one bird is selected */}
                    {activeSlots.length === 0 ? (
                        <p className="text-center text-sm text-[#3F4850]/60 italic py-10">
                            Select at least one species above to see the comparison.
                        </p>
                    ) : (
                        /* Horizontal scroll wrapper so narrow screens don't clip the table */
                        <div className="overflow-x-auto rounded-xl border border-[#C9C9C9]">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-[#fffdde]">
                                        {/* Sticky label column header — stays fixed while scrolling right */}
                                        <th className="sticky left-0 z-10 bg-[#fffdde] text-lg px-4 py-3 text-left font-semibold text-[#333333] border-b border-[#C9C9C9] min-w-[140px]">
                                            Attribute
                                        </th>

                                        {/* One column header per active bird */}
                                        {activeSlots.map(({ label, index }) => {
                                            const bird = birdDataMap[label];
                                            const statusLabel = bird?.conservation?.status_label ?? null;
                                            return (
                                                <th key={index} className="px-4 py-3 text-left text-lg border-b border-[#C9C9C9] min-w-[180px] align-top">
                                                    {/* Bird common name */}
                                                    <p className="font-bold text-[#333333]">
                                                        {toTitleCase(label)}
                                                    </p>
                                                    {/* Scientific name — genus + species from taxonomy */}
                                                    {bird?.taxonomy?.genus && (
                                                        <p className="italic text-base text-[#3F4850]/70 mt-0.5">
                                                            {bird.taxonomy.genus}
                                                        </p>
                                                    )}
                                                    {/* IUCN conservation status badge */}
                                                    {/* Loading pulse while fetching */}
                                                    {loadingSlots.has(index) && (
                                                        <div className="mt-1 h-4 w-24 bg-[#C9C9C9] animate-pulse rounded" />
                                                    )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>

                                <tbody>
                                    {/* Each row is one attribute; cells are grouped so rows alternate shade */}

                                    {/* Conservation Status row */}
                                    <tr className="border-b border-[#C9C9C9]">
                                        <td className="sticky left-0 z-10 bg-white px-4 py-3 font-bold text-[#333333] text-base">
                                            Conservation Status
                                        </td>
                                        {activeSlots.map(({ label, index }) => {
                                            const bird = birdDataMap[label];
                                            const status = bird?.conservation?.status_label;
                                            return (
                                                <td key={index} className="px-4 py-3 bg-white">
                                                    {loadingSlots.has(index) ? (
                                                        <div className="h-5 w-20 bg-[#C9C9C9] animate-pulse rounded" />
                                                    ) : status ? (
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-base font-medium ${getStatusColor(status)}`}>
                                                            {status}
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* Population Trend row */}
                                    <tr className="border-b border-[#C9C9C9] bg-[#fafafa]">
                                        <td className="sticky left-0 z-10 bg-[#fafafa] text-base px-4 py-3 font-bold text-[#333333]">
                                            Population Trend
                                        </td>
                                        {activeSlots.map(({ label, index }) => {
                                            const bird = birdDataMap[label];
                                            const trend = bird?.conservation?.population_trend;
                                            return (
                                                <td key={index} className="px-4 py-3 text-base bg-[#fafafa] text-[#3F4850]">
                                                    {loadingSlots.has(index) ? (
                                                        <div className="h-4 w-20 bg-[#C9C9C9] animate-pulse rounded" />
                                                    ) : (trend ?? "—")}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* Movement row */}
                                    <tr className="border-b border-[#C9C9C9]">
                                        <td className="sticky left-0 z-10 bg-white text-base px-4 py-3 font-bold text-[#333333]">
                                            Movement
                                        </td>
                                        {activeSlots.map(({ label, index }) => {
                                            const bird = birdDataMap[label];
                                            const movement = bird?.conservation?.movement_patterns;
                                            return (
                                                <td key={index} className="px-4 py-3 bg-white text-base text-[#3F4850]">
                                                    {loadingSlots.has(index) ? (
                                                        <div className="h-4 w-20 bg-[#C9C9C9] animate-pulse rounded" />
                                                    ) : (movement ?? "—")}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* Order row — yellow highlight when cells match the first active bird */}
                                    <tr className="border-b border-t-5 border-[#C9C9C9] bg-[#fafafa]">
                                        <td className="sticky left-0 z-10 bg-[#fafafa] px-4 py-3 font-bold text-base text-[#333333]">
                                            Order
                                        </td>
                                        {activeSlots.map(({ label, index }, colIdx) => {
                                            const bird = birdDataMap[label];
                                            const order = bird?.taxonomy?.order;
                                            const firstOrder = birdDataMap[activeSlots[0]?.label]?.taxonomy?.order;
                                            // Highlight this cell if it matches the first bird and there is more than one bird being compared
                                            const matches = colIdx > 0 && order && firstOrder && order === firstOrder;
                                            return (
                                                <td key={index} className={`px-4 py-3 text-base text-[#3F4850] `}>
                                                    {loadingSlots.has(index) ? (
                                                        <div className="h-4 w-20 bg-[#C9C9C9] animate-pulse rounded" />
                                                    ) : (order ?? "—")}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* Family row — same yellow highlight logic */}
                                    <tr className="border-b border-[#C9C9C9]">
                                        <td className="sticky text-base left-0 z-10 bg-white px-4 py-3 font-bold text-[#333333]">
                                            Family
                                        </td>
                                        {activeSlots.map(({ label, index }, colIdx) => {
                                            const bird = birdDataMap[label];
                                            const family = bird?.taxonomy?.family;
                                            const firstFamily = birdDataMap[activeSlots[0]?.label]?.taxonomy?.family;
                                            const matches = colIdx > 0 && family && firstFamily && family === firstFamily;
                                            return (
                                                <td key={index} className={`px-4 py-3 text-[#3F4850] text-base`}>
                                                    {loadingSlots.has(index) ? (
                                                        <div className="h-4 w-20 bg-[#C9C9C9] animate-pulse rounded" />
                                                    ) : (family ?? "—")}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* Genus row — same yellow highlight logic */}
                                    <tr className="border-b border-[#C9C9C9] bg-[#fafafa]">
                                        <td className="sticky left-0 z-10 bg-[#fafafa] px-4 py-3 text-base font-bold text-[#333333]">
                                            Genus
                                        </td>
                                        {activeSlots.map(({ label, index }, colIdx) => {
                                            const bird = birdDataMap[label];
                                            const genus = bird?.taxonomy?.genus;
                                            const firstGenus = birdDataMap[activeSlots[0]?.label]?.taxonomy?.genus;
                                            const matches = colIdx > 0 && genus && firstGenus && genus === firstGenus;
                                            return (
                                                <td key={index} className={`px-4 py-3 text-[#3F4850] text-base`}>
                                                    {loadingSlots.has(index) ? (
                                                        <div className="h-4 w-20 bg-[#C9C9C9] animate-pulse rounded" />
                                                    ) : (genus ?? "—")}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                </tbody>
                            </table>
                        </div>
                    )}

                </div>
            </section>

            {/* Section 4: Diet Cards — one card per active bird showing prey items as pills */}
            {activeSlots.length > 0 && (
                <section className="px-8 py-2 pb-15">
                    <div className="max-w-6xl mx-auto">
                        <h2 className="font-serif text-3xl font-bold text-[#333333] mb-2">
                            Diet
                        </h2>
                        <p className="text-base text-[#3F4850] mb-6">
                            Common prey items recorded for each species.
                        </p>

                        {/* Grid of cards — up to 3 per row on large screens */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                            {activeSlots.map(({ label, index }) => {
                                const bird = birdDataMap[label];
                                const isLoading = loadingSlots.has(index);

                                // Pull prey from prey_common_names first, fall back to top_prey
                                const rawPrey = bird?.diet?.prey_common_names ?? bird?.diet?.top_prey ?? [];
                                const prey = cleanPreyList(rawPrey);

                                return (
                                    <div key={index} className="bg-white rounded-xl p-5 shadow-xl">
                                        {/* Card header — bird common name */}
                                        <h3 className="font-bold text-lg text-[#333333] mb-3">
                                            {toTitleCase(label)}
                                        </h3>

                                        {/* Loading state — three skeleton pill shapes */}
                                        {isLoading ? (
                                            <div className="flex flex-wrap gap-2">
                                                {[1, 2, 3].map(n => (
                                                    <div key={n} className="h-6 w-20 bg-[#C9C9C9] animate-pulse rounded-full" />
                                                ))}
                                            </div>
                                        ) : prey.length > 0 ? (
                                            /* Prey pills — one pill per item in the cleaned list */
                                            <div className="flex flex-wrap gap-2">
                                                {prey.map((item, pi) => (
                                                    <span
                                                        key={pi}
                                                        className="px-2 py-2 bg-[#fffdde] text-[#333333] text-xs rounded-full border border-[#C9C9C9]"
                                                    >
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            /* Fallback when no diet data is available for this species */
                                            <p className="text-base text-[#3F4850]/60 italic">
                                                No diet data available.
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* Section 5: Maps — geographic Tableau embeds for occurrence and density */}
            <section className="bg-[#333333] px-10 py-15">
                <div className="max-w-6xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-white mb-2">
                        Maps
                    </h2>
                    <p className="text-base text-[#C9C9C9] mb-8">
                        Geographic visualizations showing where these species are found — Tableau embeds coming soon.
                    </p>

                    {/* Two map placeholders side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Placeholder: Species Density Heatmap */}
                        <div>
                            <div className="rounded-xl border-2 border-dashed border-[#C9C9C9]/40 flex flex-col items-center justify-center py-20 gap-3">
                                <div className="text-4xl opacity-40">🗺️</div>
                                <p className="font-semibold text-white/70 text-sm">Species Density Heatmap</p>
                                <p className="text-xs text-[#C9C9C9]/50 italic">Tableau embed coming soon</p>
                            </div>
                            <p className="text-[#c9c9c9] px-10 py-5">Put map or graph description under</p>
                        </div>

                        {/* Placeholder: All Bird Occurrence */}
                        <div>
                            <div className="rounded-xl border-2 border-dashed border-[#C9C9C9]/40 flex flex-col items-center justify-center py-20 gap-3">
                                <div className="text-4xl opacity-40">📍</div>
                                <p className="font-semibold text-white/70 text-sm">All Bird Occurrence</p>
                                <p className="text-xs text-[#C9C9C9]/50 italic">Tableau embed coming soon</p>
                            </div>
                            <p className="text-[#c9c9c9] px-10 py-5">Put map or graph description under</p>
                        </div>

                    </div>
                </div>
            </section>

            {/* Section 6: Charts — trend and status Tableau embeds */}
            <section className="bg-[#3F4850] px-8 py-15">
                <div className="max-w-6xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-white mb-2">
                        Trends &amp; Status
                    </h2>
                    <p className="text-base text-[#C9C9C9] mb-8">
                        Charts showing population trends, sighting patterns, and conservation status over time — Tableau embeds coming soon.
                    </p>

                    {/* Four chart placeholders in a 2-column grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Placeholder: Observation Trend by Year */}
                        <div>
                            <div className="rounded-xl border-2 border-dashed border-[#C9C9C9]/40 flex flex-col items-center justify-center py-20 gap-3">
                                <div className="text-4xl opacity-40">📈</div>
                                <p className="font-semibold text-white/70 text-sm">Observation Trend by Year</p>
                                <p className="text-xs text-[#C9C9C9]/50 italic">Tableau embed coming soon</p>
                            </div>
                            <p className=" text-base text-[#c9c9c9] px-10 py-5">Put map or graph description under</p>
                        </div>

                        {/* Placeholder: Monthly Sighting Over Time */}
                        <div>
                            <div className="rounded-xl border-2 border-dashed border-[#C9C9C9]/40 flex flex-col items-center justify-center py-20 gap-3">
                                <div className="text-4xl opacity-40">📅</div>
                                <p className="font-semibold text-white/70 text-sm">Monthly Sighting Over Time</p>
                                <p className="text-xs text-[#C9C9C9]/50 italic">Tableau embed coming soon</p>
                            </div>
                            <p className=" text-base text-[#c9c9c9] px-10 py-5">Put map or graph description under</p>
                        </div>

                        {/* Placeholder: Population Trend */}
                        <div>
                            <div className="rounded-xl border-2 border-dashed border-[#C9C9C9]/40 flex flex-col items-center justify-center py-20 gap-3">
                                <div className="text-4xl opacity-40">📊</div>
                                <p className="font-semibold text-white/70 text-sm">Population Trend</p>
                                <p className="text-xs text-[#C9C9C9]/50 italic">Tableau embed coming soon</p>
                            </div>
                            <p className=" text-base text-[#c9c9c9] px-10 py-5">Put map or graph description under</p>
                        </div>

                        {/* Placeholder: Conservation Status */}
                        <div>
                            <div className="rounded-xl border-2 border-dashed border-[#C9C9C9]/40 flex flex-col items-center justify-center py-20 gap-3">
                                <div className="text-4xl opacity-40">🛡️</div>
                                <p className="font-semibold text-white/70 text-sm">Conservation Status</p>
                                <p className="text-xs text-[#C9C9C9]/50 italic">Tableau embed coming soon</p>
                            </div>
                            <p className=" text-base text-[#c9c9c9] px-10 py-5">Put map or graph description under</p>
                        </div>

                    </div>
                </div>
            </section>

            {/* Section 7: Wikipedia Summaries — a short bio card for each selected species */}
            {activeSlots.length > 0 && (
                <section className="bg-[#fffdde] px-8 py-10">
                    <div className="max-w-6xl mx-auto">
                        <h2 className="font-serif text-3xl font-bold text-[#333333] mb-2">
                            About These Species
                        </h2>
                        <p className="text-base text-[#3F4850] mb-6">
                            A brief overview of each selected species from Wikipedia.
                        </p>

                        {/* Grid of bio cards — up to 3 per row on large screens */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeSlots.map(({ label, index }) => {
                                const bird = birdDataMap[label];
                                const isLoading = loadingSlots.has(index);

                                // Grab the full Wikipedia extract and trim it to the first 400 characters
                                const fullText: string = bird?.wikipedia?.extract ?? "";
                                const summary = fullText.length > 400
                                    ? fullText.slice(0, 400).trimEnd() + "…"
                                    : fullText;

                                return (
                                    <div key={index} className="bg-white rounded-xl p-5 shadow-lg flex flex-col gap-4">
                                        {/* Card header — bird common name */}
                                        <h3 className="font-bold text-[#333333] text-lg">
                                            {toTitleCase(label)}
                                        </h3>

                                        {/* Loading state — three skeleton lines mimicking text */}
                                        {isLoading ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="h-3 w-full bg-[#C9C9C9] animate-pulse rounded" />
                                                <div className="h-3 w-5/6 bg-[#C9C9C9] animate-pulse rounded" />
                                                <div className="h-3 w-4/6 bg-[#C9C9C9] animate-pulse rounded" />
                                            </div>
                                        ) : summary ? (
                                            /* Truncated Wikipedia extract */
                                            <p className="text-base text-[#3F4850] leading-relaxed">
                                                {summary}
                                            </p>
                                        ) : (
                                            /* Fallback when no Wikipedia data is available */
                                            <p className="text-base text-[#3F4850]/60 italic">
                                                No description available.
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

        </main>
    );
}
