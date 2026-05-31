"use client";

import { use } from "react";
import HomePage from "@/app/page";

export default function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <HomePage slug={slug} />;
}
