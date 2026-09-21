"use client";

import { useEffect, useRef, useState } from "react";

export type PlacePick = {
  name: string;
  lat: number;
  lng: number;
  region?: string;
  address?: string;
};

type Props = {
  label: string;
  value: PlacePick | null;
  onChange: (p: PlacePick | null) => void;
  placeholder?: string;
};

export function PlaceSearchField({
  label,
  value,
  onChange,
  placeholder = "장소명 검색",
}: Props) {
  const [q, setQ] = useState(value?.name || "");
  const [hits, setHits] = useState<PlacePick[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ(value?.name || "");
  }, [value?.name, value?.lat, value?.lng]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setErr("");
      return;
    }
    if (value && term === value.name) {
      setHits([]);
      setErr("");
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      setBusy(true);
      setErr("");
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setHits([]);
          setErr(String(data?.error || "장소 검색을 사용할 수 없어요 (KAKAO_REST_KEY)"));
          setOpen(true);
          return;
        }
        const places = (data.places || []) as Array<{
          name: string;
          lat: number;
          lng: number;
          region?: string;
          address?: string;
        }>;
        setHits(
          places.map((p) => ({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            region: p.region,
            address: p.address,
          }))
        );
        setOpen(true);
      } catch {
        if (!ac.signal.aborted) {
          setHits([]);
          setErr("검색 요청이 실패했어요");
        }
      } finally {
        if (!ac.signal.aborted) setBusy(false);
      }
    }, 280);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [q, value]);

  function pick(p: PlacePick) {
    onChange(p);
    setQ(p.name);
    setHits([]);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQ("");
    setHits([]);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-[0.72rem] font-semibold text-muted">
        {label}
        <input
          className="ui-field mt-1 !py-1.5 text-[0.8rem] font-medium text-mountain-deep"
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            if (value) onChange(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
      </label>
      {value && (
        <p className="mt-1 truncate text-[0.65rem] text-sea-deep">
          {value.region || value.address || "선택됨"}
          <button
            type="button"
            className="ml-2 underline-offset-2 hover:underline"
            onClick={clear}
          >
            지우기
          </button>
        </p>
      )}
      {open && (busy || hits.length > 0 || err || q.trim().length >= 2) && (
        <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-[600] max-h-56 overflow-auto rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white shadow-[var(--shadow-md)]">
          {busy && (
            <p className="px-2.5 py-2 text-[0.7rem] text-muted">검색 중…</p>
          )}
          {!busy && err ? (
            <p className="px-2.5 py-2 text-[0.7rem] text-red-700">{err}</p>
          ) : null}
          {!busy &&
            !err &&
            hits.map((h) => (
              <button
                key={`${h.name}-${h.lat}-${h.lng}`}
                type="button"
                onClick={() => pick(h)}
                className="block w-full px-2.5 py-2 text-left hover:bg-sea-mist"
              >
                <span className="block text-[0.78rem] font-semibold text-mountain-deep">
                  {h.name}
                </span>
                <span className="block truncate text-[0.65rem] text-muted">
                  {h.address || h.region}
                </span>
              </button>
            ))}
          {!busy && !err && q.trim().length >= 2 && !hits.length && (
            <p className="px-2.5 py-2 text-[0.7rem] text-muted">
              검색 결과가 없어요. 다른 키워드를 입력해 보세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
