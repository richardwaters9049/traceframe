"use client";

import { Box, Database, HardDrive, Workflow } from "lucide-react";

const services = [
  { icon: Box, name: "Next.js", purpose: "Interface and API" },
  { icon: Database, name: "PostgreSQL", purpose: "Cases and sessions" },
  { icon: Workflow, name: "Python", purpose: "Background processing" },
  { icon: HardDrive, name: "MinIO", purpose: "Source material" },
];

export function ArchitectureWorkspace() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
      <p className="ui-eyebrow text-[#8794FF]">System design</p>
      <h1 className="ui-page-title mt-3 max-w-2xl">Four focused services. One public boundary.</h1>
      <p className="ui-body mt-5 max-w-xl text-[#B0B8C6]">Next.js owns the browser experience while data and processing remain isolated inside the application network.</p>
      <div className="relative mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="pointer-events-none absolute left-[8%] right-[8%] top-8 hidden h-px bg-[linear-gradient(90deg,transparent,#7C8DFF55,#58D6C744,transparent)] xl:block" />
        {services.map(({ icon: Icon, name, purpose }, index) => (
          <article key={name} className="relative rounded-[1.35rem] border border-white/[0.07] bg-[#10131A] p-5">
            <div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-[#7C8DFF]/10 text-[#91A0FF]"><Icon className="size-5" /></span><span className="ui-meta font-mono text-[#8791A2]">0{index + 1}</span></div>
            <h2 className="ui-section-title mt-8">{name}</h2><p className="ui-meta mt-2 text-[#B0B8C6]">{purpose}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.35rem] border border-[#58D6C7]/10 bg-[#58D6C7]/[0.035] p-6"><p className="ui-eyebrow text-[#6EDFD2]">Public surface</p><p className="ui-body mt-3 text-[#B8C0CC]">Only the web application is exposed to users.</p></div>
        <div className="rounded-[1.35rem] border border-white/[0.07] bg-white/[0.018] p-6"><p className="ui-eyebrow text-[#9AA4B5]">Core boundaries</p><p className="ui-body mt-3 text-[#B8C0CC]">Same-origin requests · server-first rendering · durable audit trail · original sources kept separate</p></div>
      </div>
    </section>
  );
}
