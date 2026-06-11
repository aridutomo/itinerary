"use client";

import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
};

// Input jam format 24 jam (HH:mm) yang konsisten di semua browser/OS,
// tanpa picker AM/PM bawaan. User mengetik angka; titik dua otomatis.
export default function TimeInput({ value, onChange, className, id }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let digits = e.target.value.replace(/\D/g, "").slice(0, 4);

    // Batasi jam (0-23) dan menit (0-59) saat user mengetik.
    if (digits.length >= 1) {
      const h = parseInt(digits.slice(0, 2), 10);
      if (digits.length >= 2 && h > 23) digits = "23" + digits.slice(2);
    }
    if (digits.length > 2) {
      const m = parseInt(digits.slice(2, 4), 10);
      if (digits.length >= 4 && m > 59) digits = digits.slice(0, 2) + "59";
    }

    const formatted =
      digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
    onChange(formatted);
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="--:--"
      maxLength={5}
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      value={value}
      onChange={handleChange}
      className={className}
    />
  );
}
