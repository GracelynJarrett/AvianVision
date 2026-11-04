"use client";
import { useEffect, useState } from "react";

// Renders a metric formula as a visual fraction if numerator/denominator are provided,
// or as plain styled text if the metric only has a formula string
function FormulaCell({ m }: { m: any }) {
    if (m.numerator && m.denominator) {
        return (
            <div className="inline-flex flex-col items-center gap-1 font-mono text-xs text-[#3F4850]">
                {/* Numerator sits above the dividing line */}
                <span className="text-center">{m.numerator}</span>
                {/* The horizontal dividing line */}
                <span className="w-full border-t border-[#3F4850]" />
                {/* Denominator sits below the dividing line */}
                <span className="text-center">{m.denominator}</span>
            </div>
        );
    }
    // Non-fraction formulas (e.g. Loss, F1) render as a styled text block
    return (
        <span className="font-mono text-xs text-[#3F4850] bg-[#fffdde] rounded px-2 py-1 inline-block">
            {m.formula ?? "—"}
        </span>
    );
}

// The stats page shows how the AvianVision AI model was trained and how well it performs
export default function StatsPage() {

    const [statsData, setStatsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all stats data from the API when the page first loads
    useEffect(() => {
        fetch("http://127.0.0.1:8000/stats")
            .then((res) => res.json())
            .then((data) => {
                setStatsData(data);
                setLoading(false);
            })
            .catch(() => {
                setError("Could not load stats. Make sure the API is running.");
                setLoading(false);
            });
    }, []);

    // best_model has the final test metrics; best_hyperparameter_model is the same
    // model but logged during tuning, so it carries the train/val breakdown
    const best = statsData?.mlflow?.best_model;
    const bestHT = statsData?.mlflow?.best_hyperparameter_model;
    const bestTest = best?.test;
    const bestVal = bestHT?.validation;
    const bestTrain = bestHT?.train;

    // Format a 0–1 decimal as a percentage string, or "—" if the value is missing
    function fmtPct(val: number | null | undefined): string {
        if (val == null) return "—";
        return (val * 100).toFixed(2) + "%";
    }

    // Format a loss value to 4 decimal places, or "—" if missing
    function fmtLoss(val: number | null | undefined): string {
        if (val == null) return "—";
        return val.toFixed(4);
    }

    return (
        <main className="bg-[#FFFFFF]">

            {/* Section 1: Hero — page title and subtitle */}
            <section className="bg-[#fffdde] px-8 py-14">
                <div className="max-w-5xl mx-auto text-center">
                    <h1 className="font-serif text-4xl font-bold text-[#333333] mb-4">
                        Model Performance
                    </h1>
                    <p className="text-lg text-[#3F4850] leading-relaxed max-w-2xl mx-auto">
                        A look at how the AvianVision AI model was trained, tuned, and evaluated
                        across 525 bird species.
                    </p>
                </div>
            </section>

            {/* Dataset Overview — dataset facts shown before the model metrics */}
            <section className="bg-[#ffd6b6] px-8 py-14">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-3">
                        Dataset Overview
                    </h2>
                    <p className="text-[#3F4850] mb-10">
                        The AvianVision model was trained on a publicly available bird image
                        dataset from HuggingFace. Each species has a dedicated set of validation
                        and test images that were never shown to the model during training,
                        ensuring the performance metrics reflect real-world accuracy.
                    </p>

                    {/* Stat cards — key dataset numbers at a glance, two rows */}
                    {/* Row 1: the train/val/test split */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6">
                        <div className="rounded-xl bg-white/60 p-6 text-center">
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/60 mb-2">Training</p>
                            <p className="text-4xl font-bold text-[#333333]">84.6K</p>
                            <p className="mt-2 text-sm text-[#3F4850]">Training images</p>
                        </div>
                        <div className="rounded-xl bg-white/60 p-6 text-center">
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/60 mb-2">Validation</p>
                            <p className="text-4xl font-bold text-[#333333]">2,625</p>
                            <p className="mt-2 text-sm text-[#3F4850]">Validation images</p>
                            <p className="mt-1 text-xs text-[#3F4850]/60">5 per species</p>
                        </div>
                        <div className="rounded-xl bg-white/60 p-6 text-center">
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/60 mb-2">Test</p>
                            <p className="text-4xl font-bold text-[#333333]">2,625</p>
                            <p className="mt-2 text-sm text-[#3F4850]">Test images</p>
                            <p className="mt-1 text-xs text-[#3F4850]/60">5 per species</p>
                        </div>
                    </div>

                    {/* Row 2: other dataset facts */}
                    <div className="grid grid-cols-2 gap-6 max-w-md">
                        <div className="rounded-xl bg-white/60 p-6 text-center">
                            <p className="text-4xl font-bold text-[#333333]">525</p>
                            <p className="mt-2 text-sm text-[#3F4850]">Bird species</p>
                        </div>
                        <div className="rounded-xl bg-white/60 p-6 text-center">
                            <p className="text-4xl font-bold text-[#333333]">224²</p>
                            <p className="mt-2 text-sm text-[#3F4850]">Input image size</p>
                            <p className="mt-1 text-xs text-[#3F4850]/60">pixels</p>
                        </div>
                    </div>

                    {/* Dataset source credit */}
                    <p className="mt-8 text-sm text-[#3F4850]/70">
                        Source:{" "}
                        <span className="font-mono font-semibold text-[#3F4850]">
                            yashikota/birds-525-species-image-classification
                        </span>{" "}
                        — HuggingFace
                    </p>
                </div>
            </section>

            {/* Model Architecture — explains EfficientNetB0, transfer learning, and the layer structure */}
            <section className="bg-[#FFFFFF] px-8 py-14">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-3">
                        Model Architecture
                    </h2>
                    <p className="text-[#3F4850] mb-10">
                        AvianVision is built on top of EfficientNetB0 using a technique called
                        transfer learning. Instead of building a model from scratch, the existing
                        knowledge baked into EfficientNetB0 is reused and fine-tuned for
                        identifying bird species specifically.
                    </p>

                    {/* Two concept cards side by side */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-12">
                        <div className="rounded-xl bg-[#fffdde] p-6 border border-[#C9C9C9]">
                            <h3 className="font-serif text-lg font-bold text-[#333333] mb-3">
                                What is EfficientNetB0?
                            </h3>
                            <p className="text-sm text-[#3F4850] leading-relaxed">
                                EfficientNetB0 is a compact but powerful image classification model
                                developed by Google. It was originally trained on ImageNet — a dataset
                                of over 14 million images across 1,000 categories — which means it
                                already knows how to recognize shapes, textures, and patterns in photos
                                before any bird training begins.
                            </p>
                        </div>
                        <div className="rounded-xl bg-[#fffdde] p-6 border border-[#C9C9C9]">
                            <h3 className="font-serif text-lg font-bold text-[#333333] mb-3">
                                What is Transfer Learning?
                            </h3>
                            <p className="text-sm text-[#3F4850] leading-relaxed">
                                Transfer learning takes a model already trained on a large dataset and
                                adapts it to a new, more specific task. Rather than relearning basic
                                image recognition from zero, the model builds on what it already knows.
                                This saves time, requires less data, and typically produces better
                                results than training from scratch.
                            </p>
                        </div>
                    </div>

                    {/* Visual layer diagram — shows how the model is structured */}
                    <h3 className="font-serif text-xl font-semibold text-[#333333] mb-6">
                        Layer Structure
                    </h3>
                    <div className="flex flex-col items-center gap-1 max-w-sm mx-auto">

                        {/* Each block represents a section of the model */}
                        <div className="w-full rounded-lg bg-[#C9C9C9] px-6 py-4 text-center">
                            <p className="font-semibold text-[#333333] text-sm">ImageNet Pretrained Weights</p>
                            <p className="text-xs text-[#3F4850]/70 mt-1">Starting knowledge — 14M+ images, 1,000 categories</p>
                        </div>

                        <div className="text-[#C9C9C9] text-xl">↓</div>

                        <div className="w-full rounded-lg bg-[#3F4850] px-6 py-4 text-center text-white">
                            <p className="font-semibold text-sm">Base Layers</p>
                            <p className="text-xs text-white/60 mt-1">Low-level features — edges, textures, colors</p>
                        </div>

                        <div className="text-[#C9C9C9] text-xl">↓</div>

                        <div className="w-full rounded-lg bg-[#3F4850] px-6 py-4 text-center text-white">
                            <p className="font-semibold text-sm">Middle Layers</p>
                            <p className="text-xs text-white/60 mt-1">Mid-level features — shapes, patterns, structures</p>
                        </div>

                        <div className="text-[#C9C9C9] text-xl">↓</div>

                        <div className="w-full rounded-lg bg-[#3F4850] px-6 py-4 text-center text-white">
                            <p className="font-semibold text-sm">End Layers</p>
                            <p className="text-xs text-white/60 mt-1">High-level features — bird-specific patterns</p>
                        </div>

                        <div className="text-[#C9C9C9] text-xl">↓</div>

                        <div className="w-full rounded-lg bg-[#fff99d] px-6 py-4 text-center border border-[#3F4850]/20">
                            <p className="font-semibold text-[#333333] text-sm">Custom Output Layer</p>
                            <p className="text-xs text-[#3F4850]/70 mt-1">525 bird species — trained specifically for AvianVision</p>
                        </div>

                    </div>

                    <p className="text-xs text-center text-[#3F4850]/50 mt-6">
                        Which layers were frozen or unfrozen during training was controlled by the
                        Freeze Base, Freeze Middle, and Freeze End hyperparameters — see the
                        Hyperparameter Tuning section below for details.
                    </p>
                </div>
            </section>

            {/* Section 2: Best Model at a Glance — key test metrics from the final deployed model */}
            <section id="best-model" className="bg-[#333333] px-8 py-14 text-white">
                <h2 className="text-center font-serif text-3xl font-bold text-[#fff99d] mb-4">
                    Best Model at a Glance
                </h2>
                <p className="text-center text-[#C9C9C9] max-w-xl mx-auto mb-10">
                    The final EfficientNetB0 model after hyperparameter tuning —
                    training and validation metrics are from the best tuning run,
                    and the test score reflects the final evaluation on held-out data.
                </p>

                {/* Show a loading or error message while the fetch is in progress */}
                {loading && (
                    <p className="text-center text-[#C9C9C9]">Loading stats…</p>
                )}
                {error && (
                    <p className="text-center text-[#ffbc88]">{error}</p>
                )}

                {/* Primary metric cards — test accuracy, F1, and loss */}
                {!loading && !error && (
                    <>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-3xl mx-auto">
                            <div className="rounded-xl bg-white/10 p-6 text-center">
                                <p className="text-sm text-[#C9C9C9] mb-2">Test Accuracy</p>
                                <p className="text-4xl font-bold">{fmtPct(bestTest?.accuracy)}</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-6 text-center">
                                <p className="text-sm text-[#C9C9C9] mb-2">Test F1 Score</p>
                                <p className="text-4xl font-bold">{fmtPct(bestTest?.f1_score)}</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-6 text-center">
                                <p className="text-sm text-[#C9C9C9] mb-2">Test Loss</p>
                                <p className="text-4xl font-bold">{fmtLoss(bestTest?.loss)}</p>
                            </div>
                        </div>

                        {/* Secondary metrics — training and validation breakdown */}
                        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 max-w-3xl mx-auto">
                            <div className="rounded-xl bg-white/10 px-4 py-4 text-center">
                                <p className="text-xs text-[#C9C9C9] mb-1">Train Accuracy</p>
                                <p className="text-xl font-bold">{fmtPct(bestTrain?.accuracy)}</p>
                            </div>
                            <div className="rounded-xl bg-white/10 px-4 py-4 text-center">
                                <p className="text-xs text-[#C9C9C9] mb-1">Val Accuracy</p>
                                <p className="text-xl font-bold">{fmtPct(bestVal?.accuracy)}</p>
                            </div>
                            <div className="rounded-xl bg-white/10 px-4 py-4 text-center">
                                <p className="text-xs text-[#C9C9C9] mb-1">Val Precision</p>
                                <p className="text-xl font-bold">{fmtPct(bestVal?.precision)}</p>
                            </div>
                            <div className="rounded-xl bg-white/10 px-4 py-4 text-center">
                                <p className="text-xs text-[#C9C9C9] mb-1">Val Recall</p>
                                <p className="text-xl font-bold">{fmtPct(bestVal?.recall)}</p>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* How to Read the Results — plain-English interpretation of the model's key numbers */}
            <section className="bg-[#fffdde] px-8 py-14">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-3">
                        How to Read the Results
                    </h2>
                    <p className="text-[#3F4850] mb-10">
                        Not sure if the numbers above are good? Here is what they mean in everyday terms.
                    </p>

                    {!loading && !error && (
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

                            {/* Card 1: What accuracy means in practice */}
                            <div className="rounded-xl bg-white p-6 border border-[#C9C9C9]">
                                <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/60 mb-3">
                                    Test Accuracy
                                </p>
                                <p className="font-serif text-2xl font-bold text-[#333333] mb-4">
                                    {fmtPct(bestTest?.accuracy)}
                                </p>
                                <p className="text-sm text-[#3F4850] leading-relaxed">
                                    If you uploaded 100 random bird photos, the model would correctly
                                    identify the species in roughly{" "}
                                    <strong>
                                        {bestTest?.accuracy != null
                                            ? Math.round(bestTest.accuracy * 100)
                                            : "—"}{" "}
                                        of them
                                    </strong>{" "}
                                    — choosing from 525 possible species each time.
                                </p>
                            </div>

                            {/* Card 2: What F1 means in practice */}
                            <div className="rounded-xl bg-white p-6 border border-[#C9C9C9]">
                                <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/60 mb-3">
                                    Test F1 Score
                                </p>
                                <p className="font-serif text-2xl font-bold text-[#333333] mb-4">
                                    {fmtPct(bestTest?.f1_score)}
                                </p>
                                <p className="text-sm text-[#3F4850] leading-relaxed">
                                    F1 score rewards the model for being both accurate in its confident
                                    guesses and thorough in finding the right species. A score above 90%
                                    means the model is doing well on both fronts across all 525 classes.
                                </p>
                            </div>

                            {/* Card 3: Context — is this considered good? */}
                            <div className="rounded-xl bg-[#fff99d] p-6 border border-[#3F4850]/20">
                                <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/60 mb-3">
                                    Is this good?
                                </p>
                                <p className="font-serif text-2xl font-bold text-[#333333] mb-4">
                                    Yes.
                                </p>
                                <p className="text-sm text-[#3F4850] leading-relaxed">
                                    Random guessing across 525 species would give an accuracy of only
                                    0.19%. The AvianVision model performs far above that baseline and is
                                    competitive with published research on fine-grained bird classification.
                                </p>
                            </div>

                        </div>
                    )}

                    {loading && <p className="text-[#3F4850]/60">Loading results…</p>}
                </div>
            </section>

            {/* Section 3: Metrics Reference Table — explains each metric for non-technical visitors */}
            <section className="bg-[#FFFFFF] px-8 py-14">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-3">
                        Understanding the Metrics
                    </h2>
                    <p className="text-[#3F4850] mb-3">
                        Not sure what these numbers mean? Here is a plain-English breakdown
                        of every metric used to evaluate the AvianVision model.
                    </p>
                    <p className="text-sm text-[#3F4850]/70 mb-8 leading-relaxed max-w-3xl">
                        <strong>Note on Macro averaging:</strong> Precision, Recall, and F1 are all
                        calculated separately for each of the 525 species, then averaged together so
                        that every species is weighted equally — regardless of how many training
                        images it had.
                    </p>

                    {/* Metrics table — note: the API key is "defintions" (typo in the backend) */}
                    {!loading && !error && statsData?.defintions?.metrics?.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-[#C9C9C9]">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#3F4850] text-white">
                                    <tr>
                                        <th className="px-5 py-4 font-semibold w-40">Metric</th>
                                        <th className="px-5 py-4 font-semibold">Description</th>
                                        <th className="px-5 py-4 font-semibold w-52">Formula</th>
                                        <th className="px-5 py-4 font-semibold w-28 text-center">Better When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Each row is one metric from the API definitions list */}
                                    {statsData.defintions.metrics.map((m: any, i: number) => (
                                        <tr
                                            key={m.metric}
                                            className={i % 2 === 0 ? "bg-white" : "bg-[#fffdde]"}
                                        >
                                            <td className="px-5 py-4 font-semibold text-[#333333] align-top">
                                                {m.metric}
                                            </td>
                                            <td className="px-5 py-4 text-[#3F4850] align-top leading-relaxed">
                                                {m.definition}
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <FormulaCell m={m} />
                                            </td>
                                            <td className="px-5 py-4 text-center align-top">
                                                {/* Color the direction badge based on higher/lower */}
                                                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                                    m["Better Direction"]?.toLowerCase().includes("higher")
                                                        ? "bg-[#fff99d] text-[#333333]"
                                                        : "bg-[#ffbc88] text-[#333333]"
                                                }`}>
                                                    {m["Better Direction"] ?? "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Fallback if definitions haven't loaded yet */}
                    {loading && <p className="text-[#C9C9C9]">Loading metric definitions…</p>}
                </div>
            </section>

            {/* Section 4: Model Progression — shows how validation accuracy improved at each training stage */}
            <section className="bg-[#fffdde] px-8 py-14">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-3">
                        Model Progression
                    </h2>
                    <p className="text-[#3F4850] mb-10">
                        The AvianVision model was built in stages. Each step below shows how
                        the validation accuracy improved as new training techniques were applied.
                        The final model is evaluated on a separate held-out test set.
                    </p>

                    {!loading && !error && (() => {
                        // Gather the four stages — skip Data Augmentation if no runs exist
                        const baseAcc   = statsData?.mlflow?.base_model?.validation?.accuracy;
                        const augModels = statsData?.mlflow?.aggregation_models ?? [];
                        // Pick the best augmentation run by validation accuracy
                        const bestAug   = augModels.reduce((best: any, m: any) =>
                            (m?.validation?.accuracy ?? 0) > (best?.validation?.accuracy ?? 0) ? m : best
                        , null);
                        const htAcc     = statsData?.mlflow?.best_hyperparameter_model?.validation?.accuracy;
                        const finalAcc  = statsData?.mlflow?.best_model?.test?.accuracy;

                        // Build the list of stages, omitting the aug step if there is no data.
                        // scrollTo is the id of the section this stage links to.
                        const stages: { label: string; sub: string; acc: number | null; isFinal?: boolean; scrollTo: string }[] = [
                            { label: "Base Model",               sub: "Val Accuracy",  acc: baseAcc ?? null,                             scrollTo: "best-model" },
                            ...(bestAug ? [{ label: "+ Data Augmentation", sub: "Val Accuracy", acc: bestAug?.validation?.accuracy ?? null, scrollTo: "augmentation" }] : []),
                            { label: "+ Hyperparameter Tuning",  sub: "Val Accuracy",  acc: htAcc ?? null,                               scrollTo: "hyperparameters" },
                            { label: "Final Model",              sub: "Test Accuracy", acc: finalAcc ?? null, isFinal: true,             scrollTo: "best-model" },
                        ];

                        return (
                            <div className="flex flex-wrap items-center gap-3 justify-center">
                                {stages.map((stage, i) => (
                                    <div key={stage.label} className="flex items-center gap-3">
                                        {/* Each stage is a button that smoothly scrolls to its detail section */}
                                        <button
                                            onClick={() =>
                                                document.getElementById(stage.scrollTo)?.scrollIntoView({ behavior: "smooth" })
                                            }
                                            className={`rounded-xl px-6 py-5 text-center w-44 shadow-sm border transition-shadow hover:shadow-md cursor-pointer ${
                                            stage.isFinal
                                                ? "bg-[#fff99d] border-[#3F4850]"
                                                : "bg-white border-[#C9C9C9]"
                                        }`}>
                                            <p className="text-xs font-semibold uppercase tracking-widest text-[#3F4850]/60 mb-2">
                                                Stage {i + 1}
                                            </p>
                                            <p className="font-serif text-sm font-bold text-[#333333] leading-snug mb-3">
                                                {stage.label}
                                            </p>
                                            <p className="text-3xl font-bold text-[#333333]">
                                                {stage.acc != null ? (stage.acc * 100).toFixed(1) + "%" : "—"}
                                            </p>
                                            <p className="text-xs text-[#3F4850]/60 mt-1">{stage.sub}</p>
                                        </button>

                                        {/* Arrow between stages, hidden after the last card */}
                                        {i < stages.length - 1 && (
                                            <span className="text-2xl text-[#3F4850]/40 font-light">→</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {loading && <p className="text-[#3F4850]/60">Loading progression data…</p>}
                </div>
            </section>

            {/* Section 5: Data Augmentation — definition table + model metrics table */}
            <section id="augmentation" className="bg-[#FFFFFF] px-8 py-14">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-3">
                        Data Augmentation
                    </h2>
                    <p className="text-[#3F4850] mb-10">
                        Data augmentation artificially expands the training dataset by applying
                        random transformations to each image. This teaches the model to be more
                        flexible and reduces the chance of it memorizing the training data instead
                        of learning to truly recognize each species.
                    </p>

                    {/* Sub-section 1: What each augmentation technique is */}
                    <h3 className="font-serif text-xl font-semibold text-[#333333] mb-4">
                        Techniques Used
                    </h3>

                    {!loading && !error && statsData?.defintions?.aggregations?.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-[#C9C9C9] mb-12">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#3F4850] text-white">
                                    <tr>
                                        <th className="px-5 py-4 font-semibold w-48">Technique</th>
                                        <th className="px-5 py-4 font-semibold">What It Does</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Each row is one augmentation technique from the API definitions */}
                                    {statsData.defintions.aggregations.map((a: any, i: number) => (
                                        <tr key={a.method} className={i % 2 === 0 ? "bg-white" : "bg-[#fffdde]"}>
                                            <td className="px-5 py-4 font-semibold text-[#333333] align-top">
                                                {a.method}
                                            </td>
                                            <td className="px-5 py-4 text-[#3F4850] align-top leading-relaxed">
                                                {a.definition}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Sub-section 2: How each augmentation model run performed */}
                    <h3 className="font-serif text-xl font-semibold text-[#333333] mb-4">
                        Augmentation Run Results
                    </h3>
                    <p className="text-sm text-[#3F4850]/70 mb-6">
                        Each row below is a separate training run that tested a different
                        combination of augmentation techniques. Runs are sorted by validation
                        accuracy, best first.
                    </p>

                    {!loading && !error && (() => {
                        // Sort augmentation runs best-first by validation accuracy
                        const augModels = [...(statsData?.mlflow?.aggregation_models ?? [])]
                            .sort((a: any, b: any) =>
                                (b?.validation?.accuracy ?? 0) - (a?.validation?.accuracy ?? 0)
                            );

                        if (augModels.length === 0) {
                            return (
                                <p className="text-[#3F4850]/60 italic">
                                    No augmentation runs found.
                                </p>
                            );
                        }

                        return (
                            <div className="overflow-x-auto rounded-xl border border-[#C9C9C9]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[#3F4850] text-white">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold">Run Name</th>
                                            <th className="px-5 py-4 font-semibold text-center">Val Accuracy</th>
                                            <th className="px-5 py-4 font-semibold text-center">Val F1</th>
                                            <th className="px-5 py-4 font-semibold text-center">Val Loss</th>
                                            <th className="px-5 py-4 font-semibold text-center">Train Accuracy</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Top row (best run) is highlighted in yellow */}
                                        {augModels.map((m: any, i: number) => (
                                            <tr key={m.run_name} className={i === 0 ? "bg-[#fff99d]" : i % 2 === 1 ? "bg-[#fffdde]" : "bg-white"}>
                                                <td className="px-5 py-4 font-mono text-xs text-[#333333] align-middle">
                                                    {m.run_name}
                                                    {i === 0 && (
                                                        <span className="ml-2 inline-block rounded-full bg-[#3F4850] text-white text-xs px-2 py-0.5">
                                                            Best
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-center font-semibold text-[#333333]">{fmtPct(m?.validation?.accuracy)}</td>
                                                <td className="px-5 py-4 text-center text-[#3F4850]">{fmtPct(m?.validation?.f1_score)}</td>
                                                <td className="px-5 py-4 text-center text-[#3F4850]">{fmtLoss(m?.validation?.loss)}</td>
                                                <td className="px-5 py-4 text-center text-[#3F4850]">{fmtPct(m?.train?.accuracy)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}

                    {loading && <p className="text-[#3F4850]/60">Loading augmentation data…</p>}
                </div>
            </section>

            {/* Section 6: Hyperparameter Tuning — definition table + top runs metrics table */}
            <section id="hyperparameters" className="bg-[#fffdde] px-8 py-14">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-serif text-3xl font-bold text-[#333333] mb-3">
                        Hyperparameter Tuning
                    </h2>
                    <p className="text-[#3F4850] mb-10">
                        Hyperparameters are settings that control how the model trains — they are
                        not learned from the data, they are chosen before training begins.
                        Tuning them means running the model multiple times with different
                        combinations of settings to find the configuration that performs best.
                    </p>

                    {/* Sub-section 1: What each hyperparameter controls */}
                    <h3 className="font-serif text-xl font-semibold text-[#333333] mb-4">
                        Parameters Tuned
                    </h3>

                    {!loading && !error && statsData?.defintions?.hyperparameters?.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-[#C9C9C9] mb-12">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#3F4850] text-white">
                                    <tr>
                                        <th className="px-5 py-4 font-semibold w-44">Parameter</th>
                                        <th className="px-5 py-4 font-semibold">What It Controls</th>
                                        <th className="px-5 py-4 font-semibold">Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Each row is one hyperparameter from the API definitions */}
                                    {statsData.defintions.hyperparameters.map((h: any, i: number) => (
                                        <tr key={h.parameter} className={i % 2 === 0 ? "bg-white" : "bg-[#fffdde]"}>
                                            <td className="px-5 py-4 font-semibold text-[#333333] align-top">
                                                {h.parameter}
                                            </td>
                                            <td className="px-5 py-4 text-[#3F4850] align-top leading-relaxed">
                                                {h.definition}
                                            </td>
                                            <td className="px-5 py-4 text-[#3F4850] align-top leading-relaxed">
                                                {h.impact}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Sub-section 2: Top hyperparameter tuning runs ranked by validation accuracy */}
                    <h3 className="font-serif text-xl font-semibold text-[#333333] mb-4">
                        Top Tuning Runs
                    </h3>
                    <p className="text-sm text-[#3F4850]/70 mb-6">
                        The five best-performing hyperparameter tuning runs, ranked by
                        validation accuracy. The top run was selected as the basis for the
                        final model.
                    </p>

                    {!loading && !error && (() => {
                        const htModels = statsData?.mlflow?.top_hyperparameter_models ?? [];

                        if (htModels.length === 0) {
                            return (
                                <p className="text-[#3F4850]/60 italic">
                                    No hyperparameter tuning runs found.
                                </p>
                            );
                        }

                        return (
                            <div className="overflow-x-auto rounded-xl border border-[#C9C9C9]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[#3F4850] text-white">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold w-16 text-center">Rank</th>
                                            <th className="px-5 py-4 font-semibold">Run Name</th>
                                            <th className="px-5 py-4 font-semibold text-center">Val Accuracy</th>
                                            <th className="px-5 py-4 font-semibold text-center">Val F1</th>
                                            <th className="px-5 py-4 font-semibold text-center">Val Loss</th>
                                            <th className="px-5 py-4 font-semibold text-center">Train Accuracy</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Top run is highlighted in yellow with a Best badge */}
                                        {htModels.map((m: any, i: number) => (
                                            <tr key={m.run_name} className={i === 0 ? "bg-[#fff99d]" : i % 2 === 1 ? "bg-[#fffdde]" : "bg-white"}>
                                                <td className="px-5 py-4 text-center font-bold text-[#333333]">
                                                    {i + 1}
                                                </td>
                                                <td className="px-5 py-4 font-mono text-xs text-[#333333] align-middle">
                                                    {m.run_name}
                                                    {i === 0 && (
                                                        <span className="ml-2 inline-block rounded-full bg-[#3F4850] text-white text-xs px-2 py-0.5">
                                                            Best
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-center font-semibold text-[#333333]">{fmtPct(m?.validation?.accuracy)}</td>
                                                <td className="px-5 py-4 text-center text-[#3F4850]">{fmtPct(m?.validation?.f1_score)}</td>
                                                <td className="px-5 py-4 text-center text-[#3F4850]">{fmtLoss(m?.validation?.loss)}</td>
                                                <td className="px-5 py-4 text-center text-[#3F4850]">{fmtPct(m?.train?.accuracy)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}

                    {loading && <p className="text-[#3F4850]/60">Loading hyperparameter data…</p>}
                </div>
            </section>

            {/* Try It Yourself — closing CTA linking to the prediction page */}
            <section className="bg-[#333333] px-8 py-20 text-white text-center">
                <div className="max-w-2xl mx-auto">
                    <h2 className="font-serif text-4xl font-bold text-[#fff99d] mb-6">
                        Try It Yourself
                    </h2>
                    <p className="text-lg text-[#C9C9C9] leading-relaxed mb-10">
                        You have seen the numbers — now put the model to the test.
                        Upload a photo of a bird and see which of the 525 species
                        AvianVision thinks it is.
                    </p>
                    <a
                        href="/predict"
                        className="inline-block rounded-xl bg-[#fff99d] text-[#333333] font-serif font-bold text-lg px-10 py-4 transition hover:bg-[#ffbc88]"
                    >
                        Go to Prediction →
                    </a>
                </div>
            </section>

        </main>
    );
}
