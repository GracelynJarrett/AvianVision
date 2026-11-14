"use client";

// A reusable component that embeds a Tableau Cloud view using the official Tableau Embedding API.
// It fetches a short-lived JWT token from our server, then passes it to the <tableau-viz>
// web component so Tableau knows the user is authorized to see the view.
// Filters are applied after the viz loads using the Tableau JavaScript API — not via URL params,
// which the <tableau-viz> web component does not support reliably.

import { useEffect, useRef, useState } from "react";

// Tell TypeScript that <tableau-viz> is a valid element — it is a custom web component
// provided by the Tableau Embedding API script, not a standard HTML element.
// React 19 keeps JSX types under React.JSX, so we augment that namespace here.
declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "tableau-viz": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                src?: string;
                token?: string;
                height?: string;
                width?: string;
                toolbar?: string;
                "hide-tabs"?: boolean;
            };
        }
    }
}

// Module-level token cache — this lives outside the component so it is shared across
// every TableauEmbed on the page. The first component to mount starts the fetch;
// every other component reuses the same promise instead of making its own API call.
let sharedTokenPromise: Promise<string | null> | null = null;

function getToken(): Promise<string | null> {
    if (!sharedTokenPromise) {
        sharedTokenPromise = fetch("/api/tableau-token")
            .then(res => res.json())
            .then(data => (data.token as string) ?? null)
            .catch(() => null);
    }
    return sharedTokenPromise;
}

interface TableauEmbedProps {
    url: string;               // The NEXT_PUBLIC_ env var value (share-link URL)
    title: string;             // Accessible label for the visualization
    height?: string;           // Height of the embed — defaults to 500px
    speciesFilter?: string;    // Single species label — used by the bird and predict pages
    speciesFilters?: string[]; // Multiple species labels — used by the species comparison page
    clearFilter?: boolean;     // When true, clears the Species Label filter so all species always show
}

export default function TableauEmbed({ url, title, height = "500px", speciesFilter, speciesFilters, clearFilter }: TableauEmbedProps) {

    // token holds the JWT shared by all TableauEmbed components on this page
    const [token, setToken] = useState<string | null>(null);
    // scriptLoaded tracks whether the Tableau Embedding API JavaScript has finished loading
    const [scriptLoaded, setScriptLoaded] = useState(false);
    // error tracks whether something went wrong fetching the token
    const [error, setError] = useState(false);

    // vizRef gives us direct access to the <tableau-viz> DOM element so we can
    // call the Tableau JavaScript API methods on it after the viz loads
    const vizRef = useRef<HTMLElement | null>(null);

    // Fetch (or reuse) the shared JWT token on mount
    useEffect(() => {
        // cancelled prevents a state update on a component that has already unmounted
        let cancelled = false;
        getToken().then(tok => {
            if (cancelled) return;
            if (tok) setToken(tok);
            else setError(true);
        });
        return () => { cancelled = true; };
    }, []);

    // Inject the Tableau Embedding API script once, then wait for it to fully register
    // the <tableau-viz> custom element before allowing any component to render
    useEffect(() => {
        let cancelled = false;

        // Add the script tag only once — skip if it is already in the DOM
        const existing = document.querySelector('script[src*="tableau.embedding"]');
        if (!existing) {
            const script = document.createElement("script");
            script.src = "https://10ay.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js";
            // type="module" is required by the Tableau Embedding API v3
            script.type = "module";
            document.head.appendChild(script);
        }

        // customElements.whenDefined() resolves only after the custom element is fully
        // registered — reliable even when multiple components call it at the same time
        customElements.whenDefined("tableau-viz").then(() => {
            if (!cancelled) setScriptLoaded(true);
        });

        return () => { cancelled = true; };
    }, []);

    // Apply or clear the species filter using the Tableau JavaScript API.
    // This runs whenever the token is ready, the script is loaded, or the filter values change.
    // Using the JS API instead of URL params because the <tableau-viz> web component
    // ignores URL filter parameters and throws an internal error when they are present.
    useEffect(() => {
        if (!token || !scriptLoaded || !vizRef.current) return;

        // Build the list of species values to filter by — either one bird or several
        const filterValues: string[] = speciesFilter
            ? [speciesFilter]
            : (speciesFilters ?? []);

        // If no filter is requested and clearFilter is off, do nothing —
        // the viz shows whatever default state Tableau saved
        if (filterValues.length === 0 && !clearFilter) return;

        const viz = vizRef.current as any;

        // applyFilters — either clears the Species Label filter (so all species show)
        // or applies specific species values, depending on which props were passed.
        // Some worksheets won't have the "Species Label" field — those are caught and skipped.
        async function applyFilters() {
            try {
                const sheet = viz.workbook.activeSheet;

                // A dashboard contains multiple worksheets; a single sheet IS the worksheet
                const worksheets = sheet.sheetType === "dashboard"
                    ? (sheet.worksheets as any[])
                    : [sheet];

                for (const ws of worksheets) {
                    try {
                        if (clearFilter) {
                            // Remove the Species Label filter entirely so all species are visible
                            await ws.clearFilterAsync("Species Label");
                        } else {
                            // 'replace' swaps any existing filter with the new species values
                            await ws.applyFilterAsync("Species Label", filterValues, "replace");
                        }
                    } catch {
                        // This worksheet does not have a "Species Label" field — skip it silently
                    }
                }
            } catch {
                // The workbook is not interactive yet — set up a one-time listener to retry
                // when the viz finishes loading
                viz.addEventListener("firstinteractive", applyFilters, { once: true });
            }
        }

        applyFilters();
    }, [token, scriptLoaded, speciesFilter, speciesFilters, clearFilter]);

    // If the env var is missing, render nothing instead of crashing
    if (!url) return null;

    // Strip the share-link query params — we only want the base path to the view.
    // Filters are no longer added to the URL here; they are applied via the JS API above.
    const embedUrl = url.trim().split("?")[0];

    // Show a user-friendly message if the token request failed
    if (error) {
        return (
            <div
                style={{ height }}
                className="flex items-center justify-center rounded-xl bg-red-50 text-sm text-red-500"
                aria-label={title}
            >
                Unable to load visualization — Tableau token error.
            </div>
        );
    }

    // Show a loading placeholder while waiting for the token or the Tableau script
    if (!token || !scriptLoaded) {
        return (
            <div
                style={{ height }}
                className="flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400 animate-pulse"
                aria-label={title}
            >
                Loading visualization...
            </div>
        );
    }

    // Once we have both the token and the registered custom element, render the Tableau viz.
    // toolbar="hidden" hides the bottom bar (share, download, data details, etc.)
    // hide-tabs removes the sheet/graph switcher tabs
    // ref gives us access to the DOM element so the filter effect above can call the JS API
    return (
        <tableau-viz
            ref={vizRef}
            src={embedUrl}
            token={token}
            height={height}
            width="100%"
            toolbar="hidden"
            hide-tabs
            aria-label={title}
        />
    );
}
