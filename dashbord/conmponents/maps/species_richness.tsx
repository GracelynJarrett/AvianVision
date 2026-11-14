"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Occurrence = {
    country: string;
    species_label: string;
};

export default function SpeciesRichness() {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/occurrences`)
            .then((res) => res.json())
            .then((data) => {
                setOccurrences(data.occurrences ?? []);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching occurrences:", error);
                setLoading(false);
            });
    }, []);

    const countryCounts = Object.values(
        occurrences.reduce((acc, item) => {
            if (!acc[item.country]) {
                acc[item.country] = {
                    country: item.country,
                    species: new Set<string>(),
                };
            }

            acc[item.country].species.add(item.species_label);

            return acc;
        }, {} as Record<string, { country: string; species: Set<string> }>)
    ).map((item) => ({
        country: item.country,
        count: item.species.size,
    }));

    const chartData = [
        {
            type: "choropleth" as const,
            locations: countryCounts.map((item) => item.country),
            z: countryCounts.map((item) => item.count),
            locationmode: "country names" as const,
            colorscale: "YlOrRd",
            colorbar: {
                title: { text: "Unique Species" },
            },
            text: countryCounts.map((item) => item.count.toLocaleString()),
            hovertemplate:
                "<b>%{location}</b><br>Unique Species: %{z}<extra></extra>",
        },
    ];

    if (loading) {
        return <p>Loading occurrence data...</p>;
    }

    return (
        <div className="w-full">
            <Plot
                data={chartData}
                layout={{
                    title: { text: "Species Richness" },
                    geo: {
                        projection: { type: "natural earth" },
                        showland: true,
                        landcolor: "rgb(240, 240, 240)",
                        showcountries: true,
                    },
                    autosize: true,
                    margin: { t: 50, b: 30, l: 20, r: 20 },
                }}
                style={{ width: "100%", height: "750px" }}
                useResizeHandler={true}
            />
        </div>
    );

}



