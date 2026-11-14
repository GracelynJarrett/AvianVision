"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

export default function ConservationStatus() {

    type Species = {
        species_label: string;
        scientific_name: string;
        conservation: {
            status_label: string;
        };
    };

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

    const statusCounts = species.reduce((acc, bird) => {
        const status = bird.conservation.status_label;

        acc[status] = (acc[status] || 0) + 1;

        return acc;
    }, {} as Record<string, number>);

    const chartData = [
        {
            type: "bar" as const,
            orientation: "h" as const,
            x: Object.entries(statusCounts)
                .sort((a, b) => a[1] - b[1])
                .map((item) => item[1]),

            y: Object.entries(statusCounts)
                .sort((a, b) => a[1] - b[1])
                .map((item) => item[0]),
            marker: {
                color: Object.entries(statusCounts)
                    .sort((a, b) => a[1] - b[1])
                    .map(([status]) => {
                        const colors: Record<string, string> = {
                            "Least Concern": "#2E8B57",
                            "Near Threatened": "#9ACD32",
                            "Vulnerable": "#FFD700",
                            "Endangered": "#FF8C00",
                            "Critically Endangered": "#DC143C",
                            "Extinct in the Wild": "#8B0000",
                            "Extinct": "#333333",
                        };

                        return colors[status] || "#808080";
                    }),
            },
            text: Object.entries(statusCounts)
                .sort((a, b) => a[1] - b[1])
                .map((item) => item[1].toLocaleString()),
            textposition: "outside" as const,
            hovertemplate:
                "<b>%{y}</b><br>Species: %{x}<extra></extra>",
        },
    ];

    if (loading) {
        return <p>Loading conservation data...</p>;
    }

    return (
        <div className="w-full">
            <Plot
                data={chartData}
                layout={{
                    title: { text: "Conservation Status" },
                    xaxis: {
                        title: { text: "Number of Species" },
                    },
                    yaxis: {
                        title: { text: "Conservation Status" },
                    },
                    autosize: true,
                    margin: { l: 160, r: 50, t: 60, b: 60 },
                }}
                config={{ responsive: true }}
                style={{ width: "100%", height: "600px" }}
            />
        </div>
    );

}


