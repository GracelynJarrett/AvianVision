"use client";

// A reusable component that embeds a Tableau Cloud view inside an iframe
// Takes the raw share-link URL from the env, strips the share params,
// and rebuilds the URL with proper embedding params
// Optionally filters the view to a single bird species using Tableau's URL filter syntax

interface TableauEmbedProps {
    url: string;        // The NEXT_PUBLIC_ env var value (share-link URL)
    title: string;      // Accessible title for the iframe (shown in screen readers)
    height?: string;    // iframe height — defaults to 500px
    speciesFilter?: string; // ALL-CAPS species label, e.g. "AFRICAN CROWNED CRANE"
}

export default function TableauEmbed({ url, title, height = "500px", speciesFilter }: TableauEmbedProps) {

    // If the env var is missing (e.g. server not restarted yet), render nothing instead of crashing
    if (!url) return null;

    // Trim any whitespace that the .env parser may leave around the value
    const base = url.trim().split("?")[0];

    // :embed=yes removes Tableau chrome (nav bar, header, etc.)
    // :showVizHome=no prevents the Tableau homepage from loading inside the iframe
    // :toolbar=hidden hides the bottom Tableau toolbar
    let embedUrl = `${base}?:embed=yes&:showVizHome=no&:toolbar=hidden`;

    // Tableau URL filter syntax: append &FieldName=Value with spaces replaced by +
    // This tells Tableau to show only rows where "Species Label" matches the given bird
    if (speciesFilter) {
        const encodedValue = speciesFilter.trim().replace(/ /g, "+");
        embedUrl += `&Species+Label=${encodedValue}`;
    }

    return (
        <iframe
            src={embedUrl}
            title={title}
            width="100%"
            height={height}
            style={{ border: "none", borderRadius: "0.75rem" }}
            allowFullScreen
        />
    );
}
