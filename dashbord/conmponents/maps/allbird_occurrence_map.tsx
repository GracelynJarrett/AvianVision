"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
});

const API_BASE = "http://localhost:8000";

type Occurrence = {
    avg_lat: number;
    avg_lon: number;
    occurrence_count: number;
    species_label: string;
    country: string;
    scientific_name: string;
    month: number;
};

const speciesColors = [
    "#38bdf8",
    "#f97316",
    "#a78bfa",
    "#22c55e",
    "#f43f5e",
    "#eab308",
    "#14b8a6",
    "#ec4899",
    "#6366f1",
    "#84cc16",
];



export default function AllBirdOccurrenceMap() {
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/occurrences`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch occurrences");
                }
                return res.json();
            })
            .then((data) => {
                setOccurrences(data.occurrences ?? []);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching occurrences:", error);
                setLoading(false);
            });
    }, []);


    if (loading) {
        return <p>Loading occurrence data...</p>;
    }

    return (
        <div className="w-full">

            {/* Map */}
            <div className="w-full">
                <Plot
                    data={Array.from(new Set(occurrences.map((item) => item.species_label))).map(
                        (speciesLabel, index) => {
                            const speciesOccurrences = occurrences.filter(
                                (item) => item.species_label === speciesLabel
                            );

                            return {
                                type: "scattergeo" as const,
                                mode: "markers" as const,
                                name: speciesLabel,
                                showlegend: false,
                                lat: speciesOccurrences.map((item) => item.avg_lat),
                                lon: speciesOccurrences.map((item) => item.avg_lon),
                                marker: {
                                    size: 5,
                                    color: speciesColors[index % speciesColors.length],
                                    opacity: 0.6,
                                },
                            };
                        }
                    )}
                    layout={{
                        title: { text: "All Bird Occurrence" },
                        geo: {
                            projection: { type: "natural earth" },
                            showland: true,
                            landcolor: "#eeeeee",
                            showcountries: true,
                        },
                        autosize: true,
                        margin: { t: 50, b: 20, l: 20, r: 20 },
                    }}
                    style={{ width: "100%", height: "600px" }}
                    useResizeHandler={true}
                />
            </div>


        </div>
    );
}


















