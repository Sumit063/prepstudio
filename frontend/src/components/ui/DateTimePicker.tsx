import * as React from "react";
import DatePicker from "react-datepicker";
import { Input } from "./Input";

type DateTimePickerProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
};

const DateInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, ...props }, ref) => <Input ref={ref} className={className} {...props} />
);

DateInput.displayName = "DateInput";

export const DateTimePicker = ({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  minDate,
  maxDate,
}: DateTimePickerProps) => (
  <DatePicker
    selected={value}
    onChange={(date) => onChange(date)}
    showTimeSelect
    timeIntervals={15}
    dateFormat="yyyy-MM-dd HH:mm"
    placeholderText={placeholder}
    showPopperArrow={false}
    calendarClassName="prep-datepicker"
    popperClassName="prep-datepicker-popper"
    wrapperClassName="w-full"
    disabled={disabled}
    minDate={minDate}
    maxDate={maxDate}
    customInput={<DateInput className={className} />}
  />
);
