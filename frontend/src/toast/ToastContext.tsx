import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from "react-icons/fa";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const TOAST_TIMEOUT_MS = 3200;

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastIcon(tone: ToastTone) {
  if (tone === "success") {
    return <FaCheckCircle />;
  }

  if (tone === "error") {
    return <FaExclamationCircle />;
  }

  return <FaInfoCircle />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timeoutIds = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id);
      }, TOAST_TIMEOUT_MS),
    );

    return () => {
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, [removeToast, toasts]);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast,
      success: (message) => {
        pushToast(message, "success");
      },
      error: (message) => {
        pushToast(message, "error");
      },
      info: (message) => {
        pushToast(message, "info");
      },
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <article className={`toast toast--${toast.tone}`} key={toast.id}>
            <div className="toast__icon">{getToastIcon(toast.tone)}</div>
            <p className="toast__message">{toast.message}</p>
            <button
              aria-label="Fermer la notification"
              className="toast__close"
              type="button"
              onClick={() => {
                removeToast(toast.id);
              }}
            >
              <FaTimes />
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}
