import { useGame } from "../game";

export function Toasts() {
    const { toasts, dismissToast, activeCall } = useGame();
    return (
        <div className={`toasts${activeCall ? " is-top" : ""}`} aria-live="polite">
            {toasts.map((toast) => (
                <button
                    key={toast.id}
                    type="button"
                    className={`toast toast-${toast.tone}`}
                    onClick={() => dismissToast(toast.id)}
                >
                    {toast.text}
                </button>
            ))}
        </div>
    );
}
