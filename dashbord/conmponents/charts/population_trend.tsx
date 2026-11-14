"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Species = {
    species_label: string;
    conservation: {
        population_trend: string;
    };
};

export default function PopulationTrend() {
    const [species, setSpecies] = useState<Species[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/species`)
            .then((res) => res.json())
            .then((data) => {
                setSpecies(data.species);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching species:", err);
                setLoading(false);
            });
    }, []);
    const trendCounts = species.reduce((acc, bird) => {
        const trend = bird.conservation.population_trend;

        acc[trend] = (acc[trend] || 0) + 1;

        return acc;
    }, {} as Record<string, number>);

    const sortedTrends = Object.entries(trendCounts)
        .sort((a, b) => a[1] - b[1]);

    const chartData = [
        {
            type: "bar" as const,
            orientation: "h" as const,
            x: sortedTrends.map((item) => item[1]),
            y: sortedTrends.map((item) => item[0]),
            marker: {
                color: sortedTrends.map(([trend]) => {
                    const colors: Record<string, string> = {
                        "Increasing": "#2E8B57",
                        "Stable": "#FFD700",
                        "Decreasing": "#DC143C",
                        "Unknown": "#808080",
                    };

                    return colors[trend] || "#808080";
                }),
            },
            text: sortedTrends.map((item) =>
                item[1].toLocaleString()
            ),
            textposition: "outside" as const,
            hovertemplate:
                "<b>%{y}</b><br>Species: %{x}<extra></extra>",
        },
    ];

    if (loading) {
        return <p>Loading population trend data...</p>;
    }

    return (
        <div className="w-full">
            <Plot
                data={chartData}
                layout={{
                    title: { text: "Population Trend" },
                    xaxis: {
                        title: { text: "Number of Species" },
                    },
                    yaxis: {
                        title: { text: "Population Trend" },
                    },
                    autosize: true,
                    margin: { l: 150, r: 60, t: 60, b: 60 },
                }}
                config={{ responsive: true }}
                style={{ width: "100%", height: "600px" }}
            />
        </div>
    );



}