import { useEffect } from 'react';
import './Toast.css';

interface Props {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, onDismiss, duration = 4000 }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  return (
    <div className="toast" onClick={onDismiss}>
      <span>{message}</span>
      <button className="toast-close" aria-label="Cerrar">✕</button>
    </div>
  );
}
