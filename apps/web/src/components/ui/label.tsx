import * as React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300 ${className}`}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
