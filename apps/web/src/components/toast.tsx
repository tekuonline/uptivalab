import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../lib/utils.js";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastItem = ({ toast, onClose }: ToastProps) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(toast.id), 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5" />,
    error: <XCircle className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
  };

  const styles = {
    success: "bg-green-500/90 text-white border-green-600",
    error: "bg-red-500/90 text-white border-red-600",
    warning: "bg-yellow-500/90 text-white border-yellow-600",
    info: "bg-blue-500/90 text-white border-blue-600",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300",
        styles[toast.type],
        isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
      )}
    >
      {icons[toast.type]}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onClose(toast.id), 300);
        }}
        className="text-white/80 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

interface ToasterProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export const Toaster = ({ toasts, onClose }: ToasterProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

// Toast manager hook
let toastId = 0;
const toastListeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

const notifyListeners = () => {
  toastListeners.forEach((listener) => listener([...toasts]));
};

export const toast = {
  success: (message: string, duration?: number) => {
    const id = `toast-${++toastId}`;
    toasts.push({ id, type: "success", message, duration });
    notifyListeners();
  },
  error: (message: string, duration?: number) => {
    const id = `toast-${++toastId}`;
    toasts.push({ id, type: "error", message, duration });
    notifyListeners();
  },
  warning: (message: string, duration?: number) => {
    const id = `toast-${++toastId}`;
    toasts.push({ id, type: "warning", message, duration });
    notifyListeners();
  },
  info: (message: string, duration?: number) => {
    const id = `toast-${++toastId}`;
    toasts.push({ id, type: "info", message, duration });
    notifyListeners();
  },
  remove: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  },
};

export const useToast = () => {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setCurrentToasts(newToasts);
    };
    
    toastListeners.add(listener);
    listener([...toasts]); // Initialize with current toasts
    
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  return {
    toasts: currentToasts,
    removeToast: toast.remove,
  };
};
