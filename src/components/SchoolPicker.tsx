import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Search, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type School = { id: string; name: string };

export type SchoolPickerValue = {
  id: string;     // empty string when free-text-only
  name: string;   // current displayed text
};

interface Props {
  value: SchoolPickerValue;
  onChange: (v: SchoolPickerValue) => void;
  schools: School[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Allow free-text entry — when set, user can submit a school that doesn't exist yet */
  allowProposed?: boolean;
}

export const SchoolPicker = ({
  value,
  onChange,
  schools,
  placeholder = "Type your school name…",
  className,
  inputClassName,
  allowProposed = true,
}: Props) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = value.name.trim().toLowerCase();
  const filtered = (q
    ? schools.filter((s) => s.name.toLowerCase().includes(q))
    : schools
  ).slice(0, 8);

  // Is the current typed name an exact match for an existing school?
  const exactMatch = q.length > 0 &&
    schools.find((s) => s.name.trim().toLowerCase() === q);

  // Do we have an "id locked in" right now?
  const locked = !!value.id && exactMatch && exactMatch.id === value.id;

  // Show the "use as typed" affordance when there's no exact match and we
  // allow free-text proposals
  const showProposeOption = allowProposed && q.length >= 2 && !exactMatch;

  const handleSelect = (s: School) => {
    onChange({ id: s.id, name: s.name });
    setOpen(false);
  };

  const handleProposeClose = () => {
    // We already have the typed text in value.name with id="", just close
    onChange({ id: "", name: value.name.trim() });
    setOpen(false);
  };

  const handleType = (next: string) => {
    onChange({ id: "", name: next });
    setOpen(true);
  };

  const clear = () => {
    onChange({ id: "", name: "" });
    setOpen(true);
  };

  const proposed = !!value.name.trim() && !value.id;

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors",
          locked ? "text-primary"
                 : proposed ? "text-amber-500"
                            : "text-muted-foreground"
        )}
      />
      <Input
        value={value.name}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={cn(
          "h-11 rounded-xl pl-10 pr-10 transition-colors",
          locked && "border-primary/40 bg-primary/5",
          proposed && "border-amber-500/30 bg-amber-500/5",
          inputClassName
        )}
        autoComplete="off"
      />
      {value.name && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear school"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Inline helper text below the input when in proposed-school mode */}
      {proposed && !open && (
        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-1.5">
          <Sparkles className="h-3 w-3 flex-shrink-0 mt-0.5" />
          New school. We'll add it to CampusLink once an admin verifies your application.
        </p>
      )}

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-popover border border-border/50 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {/* Existing matches */}
          {filtered.length > 0 && (
            <ul role="listbox" className="py-1">
              {filtered.map((s) => {
                const isPicked = s.id === value.id;
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

          {/* "Use as typed" affordance */}
          {showProposeOption && (
            <div className={filtered.length > 0 ? "border-t border-border/40" : ""}>
              <button
                type="button"
                onClick={handleProposeClose}
                className="w-full px-3.5 py-3 text-left hover:bg-amber-500/5 transition-colors flex items-start gap-2.5"
              >
                <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Use "<span className="text-amber-700 dark:text-amber-400">{value.name.trim()}</span>"
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    We'll add this school to CampusLink once an admin verifies you.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Empty state when nothing matches and we don't allow proposals */}
          {filtered.length === 0 && !showProposeOption && (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {q ? `No schools matching "${value.name}"` : "Start typing to find your school"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolPicker;
