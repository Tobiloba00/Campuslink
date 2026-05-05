import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type School = { id: string; name: string };

interface Props {
  value: string;                              // selected school_id
  onChange: (id: string) => void;
  schools: School[];                          // pre-fetched list
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export const SchoolPicker = ({
  value,
  onChange,
  schools,
  placeholder = "Type to search your school…",
  className,
  inputClassName,
}: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Keep input text in sync when the parent sets / clears value
  useEffect(() => {
    if (!value) { setQuery(""); return; }
    const s = schools.find((x) => x.id === value);
    if (s) setQuery(s.name);
  }, [value, schools]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = (q
    ? schools.filter((s) => s.name.toLowerCase().includes(q))
    : schools
  ).slice(0, 8);

  const handleSelect = (s: School) => {
    onChange(s.id);
    setQuery(s.name);
    setOpen(false);
  };

  const handleType = (next: string) => {
    setQuery(next);
    setOpen(true);
    // If they edit the input away from the currently-selected name, clear the FK
    if (value) {
      const current = schools.find((s) => s.id === value);
      if (current && current.name !== next) onChange("");
    }
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(true);
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors",
          value ? "text-primary" : "text-muted-foreground"
        )}
      />
      <Input
        value={query}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={cn(
          "h-11 rounded-xl pl-10 pr-10 transition-colors",
          value && "border-primary/40 bg-primary/5",
          inputClassName
        )}
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear school"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-popover border border-border/50 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {schools.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No schools registered yet.
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Ask a platform admin to add yours first.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No schools matching "<span className="font-semibold">{query}</span>"
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Try a different name, or ask the platform admin to add it.
              </p>
            </div>
          ) : (
            <ul role="listbox" className="py-1">
              {filtered.map((s) => {
                const isPicked = s.id === value;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isPicked}
                      onClick={() => handleSelect(s)}
                      className={cn(
                        "w-full px-3.5 py-2.5 text-left text-sm transition-colors flex items-center gap-2",
                        isPicked ? "bg-primary/10 text-primary font-semibold"
                                 : "hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <span className="flex-1 truncate">{s.name}</span>
                      {isPicked && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolPicker;
