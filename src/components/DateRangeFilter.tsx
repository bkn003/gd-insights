
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

export type DateRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'allTime' | 'custom';

interface DateRangeFilterProps {
  selectedPreset: DateRangePreset;
  dateFrom: Date | null;
  dateTo: Date | null;
  onPresetChange: (preset: DateRangePreset) => void;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  selectedPreset,
  dateFrom,
  dateTo,
  onPresetChange,
  onDateFromChange,
  onDateToChange,
}) => {
  const handlePresetChange = (preset: string) => {
    const presetValue = preset as DateRangePreset;
    onPresetChange(presetValue);

    const now = new Date();
    
    switch (presetValue) {
      case 'today':
        onDateFromChange(startOfDay(now));
        onDateToChange(endOfDay(now));
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        onDateFromChange(startOfDay(yesterday));
        onDateToChange(endOfDay(yesterday));
        break;
      case 'thisWeek':
        onDateFromChange(startOfWeek(now));
        onDateToChange(endOfWeek(now));
        break;
      case 'thisMonth':
        onDateFromChange(startOfMonth(now));
        onDateToChange(endOfMonth(now));
        break;
      case 'thisYear':
        onDateFromChange(startOfYear(now));
        onDateToChange(endOfYear(now));
        break;
      case 'allTime':
        onDateFromChange(undefined);
        onDateToChange(undefined);
        break;
      case 'custom':
        // Don't change dates, let user pick them
        break;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Date Range</label>
        <Select value={selectedPreset} onValueChange={handlePresetChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="thisWeek">This Week</SelectItem>
            <SelectItem value="thisMonth">This Month</SelectItem>
            <SelectItem value="thisYear">This Year</SelectItem>
            <SelectItem value="allTime">All Time</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedPreset === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={onDateFromChange}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={onDateToChange}
                  disabled={(date) => date > new Date() || (dateFrom && date < dateFrom)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
};
