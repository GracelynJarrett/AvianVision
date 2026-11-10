"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Species = {
    species_label: string;
    taxonomy: {
        family: string;
    };
};


export default function SpeciesByFamily() {
    const [species, setSpecies] = useState<Species[]>([]);
    const [loading, setLoading] = useState(true);
    const [topN, setTopN] = useState("10");

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


    const familyCounts = species.reduce((acc, bird) => {
        const family = bird.taxonomy.family;

        acc[family] = (acc[family] || 0) + 1;

        return acc;
    }, {} as Record<string, number>);

    const sortedFamilies = Object.entries(familyCounts)
        .sort((a, b) => b[1] - a[1]);

    const filteredFamilies =
        topN === "All"
            ? sortedFamilies
            : sortedFamilies.slice(0, Number(topN));

    const displayFamilies = [...filteredFamilies].reverse();

    const chartData = [
        {
            type: "bar" as const,
            orientation: "h" as const,
            x: displayFamilies.map((item) => item[1]),
            y: displayFamilies.map((item) => item[0]),
            marker: {
                color: displayFamilies.map((item) => item[1]),
                colorscale: "YlOrRd",
            },
            text: displayFamilies.map((item) =>
                item[1].toLocaleString()
            ),
            textposition: "outside" as const,
            hovertemplate:
                "<b>%{y}</b><br>Species: %{x}<extra></extra>",
        },
    ];
    if (loading) {
        return <p>Loading species data...</p>;
    }

    return (
        <div className="flex flex-col md:flex-row gap-5">
            <div className="flex-1 min-w-0">
                <Plot
                    data={chartData}
                    layout={{
                        title: { text: "Species by Family" },
                        xaxis: {
                            title: { text: "Number of Species" },
                        },
                        yaxis: {
                            title: { text: "Family" },
                        },
                        autosize: true,
                        margin: { l: 150, r: 60, t: 60, b: 60 },
                    }}
                    config={{ responsive: true }}
                    style={{ width: "100%", height: "750px" }}
                />
            </div>

            <div className="md:w-56 shrink-0">
                <p className="font-semibold mb-3">Show Top Families</p>

                <select
                    value={topN}
                    onChange={(e) => setTopN(e.target.value)}
                    className="rounded-lg bg-white text-black p-2 w-full"
                >
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="15">Top 15</option>
                    <option value="20">Top 20</option>
                    <option value="All">All</option>
                </select>
            </div>
        </div>
    );

}