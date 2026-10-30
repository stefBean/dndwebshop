import { useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
export function Modal({ title, children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="w-[min(840px,calc(100%-32px))] rounded-xl"
    >
      <div className="relative">
        <button
          type="button"
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-void/90 text-muted hover:text-gold"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </dialog>
  );
}
