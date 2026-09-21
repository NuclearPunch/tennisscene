"use client";

import { useEffect } from "react";
import { useReactions } from "@/lib/reactions";

/** 서버에서 그린 목록에 "내가 반응한 것"을 채운다. 화면에 아무것도 그리지 않는다. */
export function HydrateReactions({ ids }: { ids: string[] }) {
  const { hydrate } = useReactions();
  const key = ids.join(",");

  useEffect(() => {
    if (key) void hydrate(key.split(","));
  }, [key, hydrate]);

  return null;
}
