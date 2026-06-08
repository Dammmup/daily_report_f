import React, { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";

type DropdownItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
};

export function DropdownMenu({ items, triggerIcon }: { items: DropdownItem[]; triggerIcon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="dropdownContainer" ref={containerRef}>
      <button className="iconButton" type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {triggerIcon || <MoreVertical size={16} />}
      </button>
      {open && (
        <div className="dropdownMenu">
          {items.map((item, index) => (
            <button
              key={index}
              className={`dropdownItem ${item.danger ? "danger" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
