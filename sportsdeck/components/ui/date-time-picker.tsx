// Prompt: DateTimePicker component — use shadcn/ui's DatePicker component,
// customize styles for SportsDeck. Add quick select presets (1 hour, 6 hours,
// 1 day, 3 days, 1 week). Use custom classNames for styling. Claude
// claude-4.6-opus-high-thinking
"use client";

import * as React from "react";
import { format, addHours, addDays, addWeeks } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
}

const PRESETS = [
  { label: "1 hour", fn: () => addHours(new Date(), 1) },
  { label: "6 hours", fn: () => addHours(new Date(), 6) },
  { label: "1 day", fn: () => addDays(new Date(), 1) },
  { label: "3 days", fn: () => addDays(new Date(), 3) },
  { label: "1 week", fn: () => addWeeks(new Date(), 1) },
];

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  className,
  minDate = new Date(),
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value
  );
  const [timeValue, setTimeValue] = React.useState<string>(
    value ? format(value, "HH:mm") : ""
  );

  React.useEffect(() => {
    if (value) {
      setSelectedDate(value);
      setTimeValue(format(value, "HH:mm"));
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      onChange(undefined);
      return;
    }

    const [hours, minutes] = timeValue.split(":").map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
    setSelectedDate(date);
    onChange(date);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeValue(newTime);

    if (selectedDate && newTime) {
      const [hours, minutes] = newTime.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const newDate = new Date(selectedDate);
        newDate.setHours(hours, minutes, 0, 0);
        setSelectedDate(newDate);
        onChange(newDate);
      }
    }
  };

  const handlePreset = (presetFn: () => Date) => {
    const date = presetFn();
    setSelectedDate(date);
    setTimeValue(format(date, "HH:mm"));
    onChange(date);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-[var(--sd-surface-raised)] border-[var(--sd-border-subtle)] hover:bg-[var(--sd-surface-raised)]/80",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "PPP 'at' p")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-w-[640px]" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="border-b sm:border-b-0 sm:border-r border-[var(--sd-border-subtle)] p-4 min-w-[140px]">
            <div className="space-y-2">
              <Label className="text-xs font-display font-semibold uppercase tracking-tight text-muted-foreground">
                Quick select
              </Label>
              <div className="flex flex-col gap-1">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="justify-start font-body text-xs hover:bg-[var(--sd-surface)]"
                    onClick={() => handlePreset(preset.fn)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date < minDate}
              initialFocus
            />
            <div className="border-t border-[var(--sd-border-subtle)] p-4">
              <Label
                htmlFor="time-picker"
                className="text-xs font-display font-semibold uppercase tracking-tight text-muted-foreground mb-2 flex items-center gap-1"
              >
                <Clock className="h-3 w-3" />
                Time
              </Label>
              <Input
                id="time-picker"
                type="time"
                value={timeValue}
                onChange={handleTimeChange}
                className="input-focus bg-[var(--sd-surface)] border-[var(--sd-border-subtle)]"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
