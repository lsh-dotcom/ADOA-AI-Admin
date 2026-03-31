"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase Realtime hook — subscribes to INSERT/UPDATE/DELETE on a table
 * and calls `onChange` whenever a relevant event occurs.
 */
export function useRealtimeSubscription(
  table: string,
  onChangeCallback: () => void,
  filter?: { column: string; value: string }
) {
  const callbackRef = useRef(onChangeCallback);
  callbackRef.current = onChangeCallback;

  useEffect(() => {
    const supabase = createClient();
    const channelName = filter
      ? `${table}-${filter.column}-${filter.value}`
      : `${table}-all`;

    let channel = supabase.channel(channelName);

    const opts: {
      event: "*";
      schema: "public";
      table: string;
      filter?: string;
    } = { event: "*", schema: "public", table };

    if (filter) {
      opts.filter = `${filter.column}=eq.${filter.value}`;
    }

    channel = channel.on("postgres_changes", opts, () => {
      callbackRef.current();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter?.column, filter?.value]);
}
