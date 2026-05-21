"use client";

import { useState } from "react";
import {
  Activity,
  ChevronDown,
  CloudSun,
  HeartPulse,
  Leaf,
  MapPinned,
  Sparkles,
  Waves,
  Wind,
} from "lucide-react";

export const AVATAR_OPTIONS = [
  { id: "avatar:breeze", label: "Breeze", zh: "微風", icon: Wind, className: "avatar-tone-breeze" },
  { id: "avatar:sun", label: "Sun", zh: "晴空", icon: CloudSun, className: "avatar-tone-sun" },
  { id: "avatar:leaf", label: "Leaf", zh: "綠葉", icon: Leaf, className: "avatar-tone-leaf" },
  { id: "avatar:wave", label: "Wave", zh: "海風", icon: Waves, className: "avatar-tone-wave" },
  { id: "avatar:spark", label: "Spark", zh: "星光", icon: Sparkles, className: "avatar-tone-spark" },
  { id: "avatar:route", label: "Route", zh: "路線", icon: MapPinned, className: "avatar-tone-route" },
  { id: "avatar:active", label: "Active", zh: "活力", icon: Activity, className: "avatar-tone-active" },
  { id: "avatar:care", label: "Care", zh: "照護", icon: HeartPulse, className: "avatar-tone-care" },
];

const DEFAULT_AVATAR = AVATAR_OPTIONS[0];

export function getAvatarOption(value) {
  return AVATAR_OPTIONS.find((option) => option.id === value) || DEFAULT_AVATAR;
}

function isImageAvatar(value) {
  return typeof value === "string" && (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:image/")
  );
}

function imageAvatarStyle(value) {
  if (!isImageAvatar(value)) return undefined;
  return {
    backgroundImage: `url("${value.replaceAll("\"", "%22")}")`,
  };
}

export function AvatarVisual({ value, className = "" }) {
  const imageStyle = imageAvatarStyle(value);
  const option = getAvatarOption(value);
  const Icon = option.icon;

  if (imageStyle) {
    return (
      <span
        className={["avatar-visual avatar-visual-image", className].join(" ")}
        style={imageStyle}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={["avatar-visual", option.className, className].join(" ")}
      aria-hidden="true"
    >
      <Icon size={34} strokeWidth={2.6} />
    </span>
  );
}

export default function AvatarPicker({ value, onChange, chinese = false }) {
  const [open, setOpen] = useState(false);
  const selected = getAvatarOption(value);
  const selectedLabel = chinese ? selected.zh : selected.label;

  function selectAvatar(id) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className={open ? "avatar-picker avatar-picker-open" : "avatar-picker"}>
      <button
        type="button"
        className="avatar-picker-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="avatar-picker-copy">
          <span className="avatar-picker-title">
            {chinese ? "頭像" : "Avatar"}
          </span>
          <span className="avatar-picker-name">
            {selectedLabel}
          </span>
        </span>

        <span className="avatar-picker-action">
          <span>{chinese ? "更換" : "Change"}</span>
          <ChevronDown
            size={16}
            strokeWidth={3}
            className={open ? "avatar-select-chevron avatar-select-chevron-open" : "avatar-select-chevron"}
          />
        </span>
      </button>

      {open && (
        <div className="avatar-option-grid" role="listbox">
          {AVATAR_OPTIONS.map((option) => {
            const active = value === option.id || (!value && option.id === DEFAULT_AVATAR.id);

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectAvatar(option.id)}
                className={[
                  "avatar-option",
                  active ? "avatar-option-active" : "",
                ].join(" ")}
                aria-selected={active}
                role="option"
              >
                <AvatarVisual value={option.id} className="avatar-option-visual" />
                <span>{chinese ? option.zh : option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
